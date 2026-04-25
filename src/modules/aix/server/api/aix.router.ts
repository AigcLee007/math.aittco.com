import * as z from 'zod/v4';

import { createTRPCRouter, edgeProcedure } from '~/server/trpc/trpc.server';

import { _createDebugConfig } from '../dispatch/chatGenerate/chatGenerate.debug';
import { createChatGenerateDispatch, createChatGenerateResumeDispatch } from '../dispatch/chatGenerate/chatGenerate.dispatch';
import { executeChatGenerateWithRetry } from '../dispatch/chatGenerate/chatGenerate.retrier';

import { AixAPI_Access, AixWire_API, AixWire_API_ChatContentGenerate } from './aix.wiretypes';
import { getModelPrice } from '~/server/services/pricing.service';
import { releaseReservedCoins, reserveCoins, settleReservedCoins } from '~/server/services/coin.service';
import { resolvePromptModelRoute } from '~/server/services/model-route.service';

function createChatReservationKey(userId: string, modelId: string): string {
  return `chat:${userId}:${modelId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

async function applyRelayAccessFallback(access: AixAPI_Access, modelId: string): Promise<AixAPI_Access> {
  const relayRoute = await resolvePromptModelRoute(modelId);
  if (!relayRoute?.apiKey || !relayRoute?.baseUrl)
    return access;

  const shouldUseOpenAICompatForClaude = access.dialect === 'anthropic' && (
    relayRoute.transport === 'openai-images'
    || (relayRoute.endpointPath || '').includes('/v1/chat/completions')
  );

  if (shouldUseOpenAICompatForClaude) {
    return {
      dialect: 'openai',
      oaiKey: relayRoute.apiKey,
      oaiOrg: '',
      oaiHost: relayRoute.baseUrl,
      heliKey: '',
      clientSideFetch: access.clientSideFetch,
    };
  }

  switch (access.dialect) {
    case 'gemini':
      return {
        ...access,
        geminiKey: access.geminiKey || relayRoute.apiKey,
        geminiHost: access.geminiHost || relayRoute.baseUrl,
      };
    case 'anthropic':
      return {
        ...access,
        anthropicKey: access.anthropicKey || relayRoute.apiKey,
        anthropicHost: access.anthropicHost || relayRoute.baseUrl,
      };
    default:
      // OpenAI-compatible and xAI: reuse oaiKey/oaiHost
      return {
        ...access,
        oaiKey: (access as any).oaiKey || relayRoute.apiKey,
        oaiHost: (access as any).oaiHost || relayRoute.baseUrl,
      } as AixAPI_Access;
  }
}

// --- AIX tRPC Router ---

export const aixRouter = createTRPCRouter({

  /**
   * Chat content generation, streaming, multipart.
   * Architecture: Client <-- (intake) --> Server <-- (dispatch) --> AI Service
   */
  chatGenerateContent: edgeProcedure
    .input(z.object({
      access: AixWire_API.Access_schema,
      model: AixWire_API.Model_schema,
      chatGenerate: AixWire_API_ChatContentGenerate.Request_schema,
      context: AixWire_API.ContextChatGenerate_schema,
      streaming: z.boolean(),
      connectionOptions: AixWire_API.ConnectionOptionsChatGenerate_schema.optional(), // debugDispatchRequest, debugProfilePerformance, enableResumability
    }))
    .mutation(async function* ({ input, ctx }) {
      const hydratedAccess = await applyRelayAccessFallback(input.access, input.model.id);
      const userId = (ctx as any).userId;
      let reservationTaskKey: string | null = null;

      if (userId) {
        const modelId = input.model.id;
        const price = await getModelPrice(modelId);
        if (price > 0) {
          reservationTaskKey = createChatReservationKey(userId, modelId);
          await reserveCoins(userId, price, modelId, reservationTaskKey, `聊天额度预占: ${modelId}`);
        }
      }

      const _d = _createDebugConfig(hydratedAccess, input.connectionOptions, input.context.name);
      const chatGenerateDispatchCreator = () => createChatGenerateDispatch(hydratedAccess, input.model, input.chatGenerate, input.streaming, !!input.connectionOptions?.enableResumability);

      try {
        yield* executeChatGenerateWithRetry(chatGenerateDispatchCreator, input.streaming, ctx.reqSignal, _d);
      } catch (error) {
        if (reservationTaskKey)
          await releaseReservedCoins(reservationTaskKey, (error as Error)?.message || '聊天生成失败，自动解冻');
        throw error;
      }

      if (reservationTaskKey)
        await settleReservedCoins(reservationTaskKey, `聊天消费: ${input.model.id}`);
    }),

  /**
   * Chat content generation RESUME, streaming only.
   * Reconnects to an in-progress response by its ID - OpenAI Responses API only.
   */
  reattachContent: edgeProcedure
    .input(z.object({
      access: AixWire_API.Access_schema,
      resumeHandle: AixWire_API.ResumeHandle_schema, // resume has a handle instead of 'model + chatGenerate'
      context: AixWire_API.ContextChatGenerate_schema,
      streaming: z.literal(true), // resume is always streaming
      connectionOptions: AixWire_API.ConnectionOptionsChatGenerate_schema.pick({ debugDispatchRequest: true }).optional(), // debugDispatchRequest
    }))
    .mutation(async function* ({ input, ctx }) {
      const _d = _createDebugConfig(input.access, input.connectionOptions, input.context.name);
      const resumeDispatchCreator = () => createChatGenerateResumeDispatch(input.access, input.resumeHandle, input.streaming);

      yield* executeChatGenerateWithRetry(resumeDispatchCreator, input.streaming, ctx.reqSignal, _d);
    }),

});
