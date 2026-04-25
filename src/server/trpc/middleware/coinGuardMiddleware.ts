import { TRPCError } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import { createTRPCFetchContext } from '../trpc.server';
import { transformer } from '../trpc.transformer';
import { getModelPrice } from '../../services/pricing.service';
import { checkBalance } from '../../services/coin.service';

const t = initTRPC.context<typeof createTRPCFetchContext>().create({
  transformer: transformer,
});

/**
 * CoinGuard Middleware
 * 1. 从输入中提取 modelId
 * 2. 预检查用户余额是否足够
 * 3. 不足则抛出 PAYMENT_REQUIRED (402) 错误
 */
export const coinGuardMiddleware = t.middleware(async ({ ctx, next, input }) => {
  const userId = (ctx as any).userId;
  
  // 如果没有 userId (未通过 authMiddleware)，则跳过或报错
  if (!userId) {
    return next();
  }

  // 尝试获取模型 ID
  // 在中间件中，如果 input 已被解析，则可以直接使用
  const modelId = (input as any)?.model?.id || (input as any)?.modelId;
  
  if (!modelId) {
    return next();
  }

  // 1. 获取模型价格
  const price = await getModelPrice(modelId);
  
  // 2. 如果模型免费 (价格 <= 0)，直接放行
  if (price <= 0) {
    return next();
  }

  // 3. 检查余额
  const { isEnough, currentBalance } = await checkBalance(userId, price);
  
  if (!isEnough) {
    throw new TRPCError({
      code: 'PAYMENT_REQUIRED', // HTTP 402
      message: `余额不足。当前余额: ${currentBalance}，调用该模型需 ${price} 金币。请充值。`,
    });
  }

  // 4. 余额充足，放行
  return next();
});
