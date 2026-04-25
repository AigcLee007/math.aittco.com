import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouterEdge } from '~/server/trpc/trpc.router-edge';
import { createTRPCFetchContext } from '~/server/trpc/trpc.server';
import { posthogServerSendException } from '~/server/posthog/posthog.server';

const handlerEdgeRoutes = (req: Request) => fetchRequestHandler({
  endpoint: '/api/trpc-edge',
  router: appRouterEdge,
  req,
  createContext: createTRPCFetchContext,
  onError: async function({ path, error, type, ctx }) {

    if (process.env.NODE_ENV === 'development')
      console.error(`❌ tRPC-edge failed on ${path ?? 'unk-path'}: ${error.message}`);

    await posthogServerSendException(error, undefined, {
      domain: 'trpc-onerror',
      runtime: 'edge',
      endpoint: path ?? 'unknown',
      method: req.method,
      url: req.url,
      additionalProperties: {
        error_code: error.code,
        error_type: type,
      },
    });
  },
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { handlerEdgeRoutes as GET, handlerEdgeRoutes as POST };
