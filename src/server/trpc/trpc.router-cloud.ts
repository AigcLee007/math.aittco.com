import { createTRPCRouter } from './trpc.server';

import { authRouter } from '~/server/trpc/routers/auth.router';
import { coinRouter } from '~/server/trpc/routers/coin.router';
import { adminRouter } from '~/server/trpc/routers/admin.router';
import { paymentRouter } from '~/server/trpc/routers/payment.router';
import { chatSyncRouter } from '~/server/trpc/routers/chat-sync.router';
import { tradeRouter } from '~/modules/trade/server/trade.router';
import { backendRouter } from '~/modules/backend/backend.router';

/**
 * Cloud rooter, which is geolocated in 1 location and separate from the other routers.
 * NOTE: at the time of writing, the location is aws|us-east-1
 */
export const appRouterCloud = createTRPCRouter({
  auth: authRouter,
  coin: coinRouter,
  payment: paymentRouter,
  chatSync: chatSyncRouter,
  admin: adminRouter,
  backend: backendRouter,
  trade: tradeRouter,
});

// export type definition of API
export type AppRouterCloud = typeof appRouterCloud;
