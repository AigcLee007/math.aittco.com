// noinspection JSUnresolvedReference

/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import { createTRPCClient, httpBatchStreamLink, httpLink, loggerLink, splitLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';

import type { AppRouterEdge } from '~/server/trpc/trpc.router-edge';
import type { AppRouterCloud } from '~/server/trpc/trpc.router-cloud';
import { transformer } from '~/server/trpc/trpc.transformer';

import { getBaseUrl } from './urlUtils';
import { reactQueryClientSingleton } from '../app.queryclient';
import { useAuthStore } from '../stores/auth/useAuthStore';


/**
 * 辅助函数：获取认证头
 */
function getAuthHeaders() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Avoid stale query responses from browser/proxy caches on sensitive pages
 * such as payment/coin balance refresh.
 */
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    cache: 'no-store',
  });


// configuration
const VERCEL_WORKAROUND_EDGE_1MB_PAYLOAD_LIMIT = true;

const EDGE_ENDPOINT = `${getBaseUrl()}/api/trpc-edge`;
const CLOUD_ENDPOINT = `${getBaseUrl()}/api/cloud`;


const enableLoggerLink = (opts: any) => {
  return process.env.NODE_ENV === 'development' ||
    (opts.direction === 'down' && opts.result instanceof Error);
};


/**
 * 判断是否应该路由到 Edge Endpoint
 * Edge Router 包含: aix, llm*, googleSearch, youtube, backend
 * Cloud Router 包含: auth, coin, admin, trade, backend
 */
function isEdgeRoute(path: string): boolean {
  const edgePrefixes = ['aix.', 'llm', 'googleSearch.', 'youtube.'];
  return edgePrefixes.some(prefix => path.startsWith(prefix));
}


/// Edge APIs: async, query, and stream

/** Typesafe async/await hooks for the the Edge-Runtime API */
export const apiAsync = createTRPCClient<AppRouterEdge>({
  links: [
    loggerLink({ enabled: enableLoggerLink }),
    splitLink({
      condition: (op) => isEdgeRoute(op.path),
      true: httpLink({
        url: EDGE_ENDPOINT,
        transformer: transformer,
        headers: () => getAuthHeaders(),
        fetch: noStoreFetch,
      }),
      false: httpLink({
        url: CLOUD_ENDPOINT,
        transformer: transformer,
        headers: () => getAuthHeaders(),
        fetch: noStoreFetch,
      }),
    }),
  ],
});

/** Typesafe React Query hooks for the tRPC Edge-Runtime API */
export const apiQuery = createTRPCNext<AppRouterEdge>({
  config() {
    return {
      queryClient: reactQueryClientSingleton(),
      links: [
        loggerLink({ enabled: enableLoggerLink }),
        splitLink({
          condition: (op) => isEdgeRoute(op.path),
          true: httpLink({
            url: EDGE_ENDPOINT,
            transformer: transformer,
            fetch: noStoreFetch,
            async headers() {
              return getAuthHeaders();
            },
          }),
          false: httpLink({
            url: CLOUD_ENDPOINT,
            transformer: transformer,
            fetch: noStoreFetch,
            async headers() {
              return getAuthHeaders();
            },
          }),
        }),
      ],
    };
  },
  ssr: false,
  transformer: transformer,
});

/** Stream API: uses tRPC streaming to transfer partial updates to the client */
export const apiStream = createTRPCClient<AppRouterEdge>({
  links: [
    loggerLink({ enabled: enableLoggerLink }),
    splitLink({
      condition: (op) => isEdgeRoute(op.path),
      true: httpBatchStreamLink({
        url: EDGE_ENDPOINT,
        transformer: transformer,
        headers: () => getAuthHeaders(),
        ...(VERCEL_WORKAROUND_EDGE_1MB_PAYLOAD_LIMIT && { maxItems: 1 }),
      }),
      false: httpBatchStreamLink({
        url: CLOUD_ENDPOINT,
        transformer: transformer,
        headers: () => getAuthHeaders(),
        ...(VERCEL_WORKAROUND_EDGE_1MB_PAYLOAD_LIMIT && { maxItems: 1 }),
      }),
    }),
  ],
});


/// Node.js runtime APIs

/** Node/Immediate API: Typesafe async/await hooks for the the Node functions API */
export const apiAsyncNode = createTRPCClient<AppRouterCloud>({
  links: [
    loggerLink({ enabled: enableLoggerLink }),
    httpLink({
      url: CLOUD_ENDPOINT,
      transformer: transformer,
      headers: () => getAuthHeaders(),
    }),
  ],
});

/** Node/Streaming API: typesafe async generator hooks */
export const apiStreamNode = createTRPCClient<AppRouterCloud>({
  links: [
    loggerLink({ enabled: enableLoggerLink }),
    httpBatchStreamLink({
      url: CLOUD_ENDPOINT,
      transformer: transformer,
      headers: () => getAuthHeaders(),
      maxItems: 1,
    }),
  ],
});
