import * as z from 'zod/v4';

import { createTRPCRouter, edgeProcedure, publicProcedure } from '~/server/trpc/trpc.server';
import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { ListModelsResponse_schema } from '../llm.server.types';
import { listModelsRunDispatch } from '../listModels.dispatch';

import { geminiAccess, geminiAccessSchema, GeminiAccessSchema } from './gemini.access';


// Mappers

async function geminiGET<TOut extends object>(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string /*, signal?: AbortSignal*/, useV1Alpha: boolean): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath, useV1Alpha);
  return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Gemini' });
}

async function geminiPOST<TOut extends object, TPostBody extends object>(access: GeminiAccessSchema, modelRefId: string | null, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/, useV1Alpha: boolean): Promise<TOut> {
  const { headers, url } = geminiAccess(access, modelRefId, apiPath, useV1Alpha);
  return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Gemini' });
}


// Router Input/Output Schemas

const accessOnlySchema = z.object({
  access: geminiAccessSchema,
});


/**
 * See https://github.com/google/generative-ai-js/tree/main/packages/main/src for
 * the official Google implementation.
 */
export const llmGeminiRouter = createTRPCRouter({

  /* [Gemini] models.list = /v1beta/models */
  listModels: publicProcedure
    .input(accessOnlySchema)
    .output(ListModelsResponse_schema)
    .query(async ({ input, signal }) => {

      const models = await listModelsRunDispatch(input.access, signal);

      return { models };
    }),

  /* [Gemini] models.generateContent (Image Mode) */
  createImages: edgeProcedure
    .input(z.object({
      access: geminiAccessSchema,
      model: z.object({
        id: z.string(),
      }),
      prompt: z.string(),
      count: z.number().min(1).max(4), // Gemini usually supports 1 or 4
      generationConfig: z.object({
        aspectRatio: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, signal }) => {
      const { access, model, prompt, count, generationConfig } = input;

      // Construct payload for generateContent with IMAGE modality
      const body = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          candidateCount: count, // NOTE: Gemini might only support 1 for images, need verification
          imageConfig: generationConfig?.aspectRatio ? {
            aspectRatio: generationConfig.aspectRatio, // '1:1', '3:4', '4:3', '9:16', '16:9'
          } : undefined,
        },
      };

      // Call Gemini API
      // endpoint: /v1beta/models/{model}:generateContent
      const apiPath = `/v1beta/${model.id}:generateContent`;
      const response = await geminiPOST<any, any>(access, model.id, body, apiPath, false);

      // Map response to T2iCreateImageOutput
      const images: any[] = [];
      if (response.candidates) {
        for (const candidate of response.candidates) {
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                images.push({
                  mimeType: part.inlineData.mimeType,
                  base64Data: part.inlineData.data,
                  altText: prompt, // Gemini doesn't always return revised prompt in metadata
                  width: 0, // Unknown, client will determine
                  height: 0, // Unknown, client will determine
                  generatorName: model.id,
                  parameters: {},
                  generatedAt: new Date().toISOString(),
                });
              }
            }
          }
        }
      }

      return images;
    }),

});
