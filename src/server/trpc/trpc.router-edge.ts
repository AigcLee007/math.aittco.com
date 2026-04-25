import { createTRPCRouter } from './trpc.server';

// Edge routers
import { aixRouter } from '~/modules/aix/server/api/aix.router';
import { backendRouter } from '~/modules/backend/backend.router';
import { googleSearchRouter } from '~/modules/google/search.router';
import { llmAnthropicRouter } from '~/modules/llms/server/anthropic/anthropic.router';
import { llmGeminiRouter } from '~/modules/llms/server/gemini/gemini.router';
import { llmOllamaRouter } from '~/modules/llms/server/ollama/ollama.router';
import { llmOpenAIRouter } from '~/modules/llms/server/openai/openai.router';

import { authRouter } from '~/server/trpc/routers/auth.router';
import { coinRouter } from '~/server/trpc/routers/coin.router';
import { adminRouter } from '~/server/trpc/routers/admin.router';
import { paymentRouter } from '~/server/trpc/routers/payment.router';
import { chatSyncRouter } from '~/server/trpc/routers/chat-sync.router';
import { youtubeRouter } from '~/modules/youtube/youtube.router';

/**
 * Primary rooter, and will be sitting on an Edge Runtime.
 */
export const appRouterEdge = createTRPCRouter({
  aix: aixRouter,
  auth: authRouter,
  coin: coinRouter,
  payment: paymentRouter,
  chatSync: chatSyncRouter,
  admin: adminRouter,
  backend: backendRouter,
  googleSearch: googleSearchRouter,
  llmAnthropic: llmAnthropicRouter,
  llmGemini: llmGeminiRouter,
  llmOllama: llmOllamaRouter,
  llmOpenAI: llmOpenAIRouter,
  youtube: youtubeRouter,
});

// export type definition of API
export type AppRouterEdge = typeof appRouterEdge;
