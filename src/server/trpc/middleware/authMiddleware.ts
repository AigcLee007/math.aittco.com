import { TRPCError } from '@trpc/server';
import { verifyAccessToken } from '../../auth/jwt';
import { initTRPC } from '@trpc/server';
import { createTRPCFetchContext } from '../trpc.server';
import { transformer } from '../trpc.transformer';
import { prismaDb } from '../../prisma/prismaDb';

/**
 * Re-initialize t to get access to middleware (or import it if possible)
 */
const t = initTRPC.context<typeof createTRPCFetchContext>().create({
  transformer: transformer,
});

/**
 * Auth Middleware
 * 1. 从 Header 提取 Bearer Token
 * 2. 验证 JWT
 * 3. 实时检查数据库状态 (isActive)
 * 4. 将 userId 和 role 注入 Context
 */
export const authMiddleware = t.middleware(async ({ ctx, next }) => {
  const authHeader = (ctx as any).headers?.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '未登录或登录已过期',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    // 实时校验用户状态（核心：支持后台立即封禁生效）
    const user = await prismaDb.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true, role: true }
    });

    if (!user || !user.isActive) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: '账号已被禁用或不存在',
      });
    }

    return next({
      ctx: {
        ...ctx,
        userId: payload.userId,
        userRole: user.role, // 使用数据库最新的角色，实现即时提权/降权
      },
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error('JWT Verification Error:', error);
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '登录凭证无效',
    });
  }
});
