import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc.server';
import { getCoinBalance, grantCoinsInTx } from '../../services/coin.service';
import { prismaDb } from '../../prisma/prismaDb';
import { getReferralSummary } from '../../services/referral.service';

const VIP_IMAGE_MODELS_CONFIG_KEY = 'ENABLE_VIP_IMAGE_MODELS';
const VIP_VISIBLE_MODEL_IDS = new Set([
  'nano-banana-2-vip',
  'gemini-3.1-flash-image-preview-vip',
]);
const VIP_CHILD_MODEL_TO_PARENT: Record<string, { parentId: string; resolution: '2K' | '4K' }> = {
  'nano-banana-2-vip-2k': { parentId: 'nano-banana-2-vip', resolution: '2K' },
  'nano-banana-2-vip-4k': { parentId: 'nano-banana-2-vip', resolution: '4K' },
  'gemini-3.1-flash-image-preview-vip-2k': { parentId: 'gemini-3.1-flash-image-preview-vip', resolution: '2K' },
  'gemini-3.1-flash-image-preview-vip-4k': { parentId: 'gemini-3.1-flash-image-preview-vip', resolution: '4K' },
};
const HIDDEN_IMAGE_MODEL_IDS = new Set([
  'nano-banana-2-vip-2k',
  'nano-banana-2-vip-4k',
  'gemini-3.1-flash-image-preview-vip-2k',
  'gemini-3.1-flash-image-preview-vip-4k',
]);

function parseResolutionChildModelId(
  modelId: string,
  modelName?: string,
  knownParentIds?: Set<string>,
): { parentId: string; resolution: '2K' | '4K' } | null {
  const normalized = normalizeModelId(modelId);
  const normalizedName = String(modelName || '').trim().toLowerCase();
  const explicitLineMatch = normalizedName.match(/^(.*?)\s*[(\uFF08]([^()\uFF08\uFF09]+)[)\uFF09]\s*$/u);
  if (explicitLineMatch) {
    const suffixLabel = String(explicitLineMatch[2] || '').trim().toLowerCase();
    const isResolutionLabel = suffixLabel === '2k' || suffixLabel === '4k';
    if (!isResolutionLabel)
      return null;
  }

  if (normalized.endsWith('-2k')) {
    const parentId = normalized.slice(0, -3);
    if (!knownParentIds || knownParentIds.has(parentId))
      return { parentId, resolution: '2K' };
  }
  if (normalized.endsWith('-4k')) {
    const parentId = normalized.slice(0, -3);
    if (!knownParentIds || knownParentIds.has(parentId))
      return { parentId, resolution: '4K' };
  }
  return null;
}

function normalizeModelId(modelId: string): string {
  return modelId.trim().replace(/^models\//, '').toLowerCase();
}

function normalizeRedeemCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

/**
 * Coin Router: Frontend APIs for balance and transactions
 */
export const coinRouter = createTRPCRouter({

  /**
   * Get current user coin balance
   */
  getBalance: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      const balance = await getCoinBalance(userId);
      return { balance };
    }),

  getReferralSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const summary = await getReferralSummary(ctx.userId);
      if (!summary)
        throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
      return summary;
    }),

  /**
   * Get transactions with cursor pagination
   */
  getTransactions: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().nullish(),
      type: z.enum(['RECHARGE', 'CONSUME', 'GIFT', 'REFUND']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { limit, cursor, type } = input;
      const userId = ctx.userId;

      const items = await prismaDb.coinTransaction.findMany({
        take: limit + 1,
        where: {
          userId,
          ...(type ? { type } : {}),
        },
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: 'desc',
        },
      });

      let nextCursor: typeof cursor | undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Return active chat models from admin pricing config.
   * No hardcoded allowlist/order: backend admin settings are the single source of truth.
   */
  getChatModels: protectedProcedure
    .query(async () => {
      const rows = await prismaDb.modelPricing.findMany({
        where: {
          category: 'CHAT',
          isActive: true,
        },
        select: {
          modelId: true,
          modelName: true,
          coinCost: true,
          updatedAt: true,
        },
      });

      return rows
        .sort((a, b) => {
          if (a.updatedAt.getTime() !== b.updatedAt.getTime())
            return b.updatedAt.getTime() - a.updatedAt.getTime();

          return a.modelId.localeCompare(b.modelId);
        })
        .map(({ modelId, modelName, coinCost }) => ({
          modelId,
          modelName,
          coinCost,
        }));
    }),

  /**
   * Return all active image models available to current user.
   */
  getImageModels: protectedProcedure
    .query(async () => {
      const [rows, vipModelConfig] = await Promise.all([
        prismaDb.modelPricing.findMany({
          where: {
            category: 'IMAGE',
            isActive: true,
          },
          select: {
            modelId: true,
            modelName: true,
            coinCost: true,
          },
          orderBy: [{ coinCost: 'asc' }, { modelId: 'asc' }],
        }),
        prismaDb.systemConfig.findUnique({
          where: { key: VIP_IMAGE_MODELS_CONFIG_KEY },
          select: { value: true },
        }),
      ]);

      const vipEnabled = vipModelConfig?.value === 'true';
      const normalizedIds = new Set(rows.map((row) => normalizeModelId(row.modelId)));
      const priceByResolutionMap = new Map<string, Partial<Record<'1K' | '2K' | '4K', number>>>();

      for (const row of rows) {
        const normalizedModelId = normalizeModelId(row.modelId);
        const childModelMeta = VIP_CHILD_MODEL_TO_PARENT[normalizedModelId]
          || parseResolutionChildModelId(normalizedModelId, row.modelName, normalizedIds);
        if (!childModelMeta)
          continue;

        const current = priceByResolutionMap.get(childModelMeta.parentId) || {};
        current[childModelMeta.resolution] = row.coinCost;
        priceByResolutionMap.set(childModelMeta.parentId, current);
      }

      return rows.filter((row) => {
        const normalizedModelId = normalizeModelId(row.modelId);
        if (parseResolutionChildModelId(normalizedModelId, row.modelName, normalizedIds))
          return false;
        if (HIDDEN_IMAGE_MODEL_IDS.has(normalizedModelId))
          return false;
        if (!vipEnabled && VIP_VISIBLE_MODEL_IDS.has(normalizedModelId))
          return false;
        return true;
      }).map((row) => {
        const normalizedModelId = normalizeModelId(row.modelId);
        const priceByResolution = priceByResolutionMap.get(normalizedModelId);

        if (priceByResolution)
          priceByResolution['1K'] = row.coinCost;

        return {
          ...row,
          priceByResolution,
        };
      });
    }),

  /**
   * Return all active generation models (image + video), used by Banana studio.
   * Supports dynamic line/channel extension from admin panel.
   */
  getGenerateModels: protectedProcedure
    .query(async () => {
      const [rows, vipModelConfig] = await Promise.all([
        prismaDb.modelPricing.findMany({
          where: {
            category: { in: ['IMAGE', 'VIDEO'] },
            isActive: true,
          },
          select: {
            modelId: true,
            modelName: true,
            coinCost: true,
            category: true,
          },
          orderBy: [{ coinCost: 'asc' }, { modelId: 'asc' }],
        }),
        prismaDb.systemConfig.findUnique({
          where: { key: VIP_IMAGE_MODELS_CONFIG_KEY },
          select: { value: true },
        }),
      ]);

      const vipEnabled = vipModelConfig?.value === 'true';
      const normalizedIds = new Set(rows.map((row) => normalizeModelId(row.modelId)));
      const priceByResolutionMap = new Map<string, Partial<Record<'1K' | '2K' | '4K', number>>>();

      for (const row of rows) {
        const normalizedModelId = normalizeModelId(row.modelId);
        const childModelMeta = VIP_CHILD_MODEL_TO_PARENT[normalizedModelId]
          || parseResolutionChildModelId(normalizedModelId, row.modelName, normalizedIds);
        if (!childModelMeta)
          continue;

        const current = priceByResolutionMap.get(childModelMeta.parentId) || {};
        current[childModelMeta.resolution] = row.coinCost;
        priceByResolutionMap.set(childModelMeta.parentId, current);
      }

      return rows.filter((row) => {
        if (row.category !== 'IMAGE')
          return true;
        const normalizedModelId = normalizeModelId(row.modelId);
        if (parseResolutionChildModelId(normalizedModelId, row.modelName, normalizedIds))
          return false;
        if (HIDDEN_IMAGE_MODEL_IDS.has(normalizedModelId))
          return false;
        if (!vipEnabled && VIP_VISIBLE_MODEL_IDS.has(normalizedModelId))
          return false;
        return true;
      }).map((row) => {
        const normalizedModelId = normalizeModelId(row.modelId);
        const priceByResolution = row.category === 'IMAGE'
          ? priceByResolutionMap.get(normalizedModelId)
          : undefined;

        if (priceByResolution)
          priceByResolution['1K'] = row.coinCost;

        return {
          modelId: row.modelId,
          modelName: row.modelName,
          coinCost: row.coinCost,
          category: row.category,
          priceByResolution,
        };
      });
    }),

  /**
   * Get active site announcements for current user, with read-state and unread count.
   */
  getAnnouncements: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const items = await prismaDb.siteAnnouncement.findMany({
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const announcementIds = items.map((item) => item.id);
      const reads = announcementIds.length
        ? await prismaDb.announcementRead.findMany({
            where: {
              userId: ctx.userId,
              announcementId: { in: announcementIds },
            },
            select: { announcementId: true },
          })
        : [];
      const readSet = new Set(reads.map((r) => r.announcementId));

      const announcements = items.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        type: item.type,
        imageUrl: item.imageUrl,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        isRead: readSet.has(item.id),
      }));
      const unreadCount = announcements.reduce((count, a) => count + (a.isRead ? 0 : 1), 0);

      return { announcements, unreadCount };
    }),

  /**
   * Mark one announcement as read.
   */
  markAnnouncementRead: protectedProcedure
    .input(z.object({ announcementId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const announcement = await prismaDb.siteAnnouncement.findUnique({
        where: { id: input.announcementId },
        select: { id: true },
      });
      if (!announcement)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' });

      await prismaDb.announcementRead.upsert({
        where: {
          userId_announcementId: {
            userId: ctx.userId,
            announcementId: input.announcementId,
          },
        },
        update: { readAt: new Date() },
        create: {
          userId: ctx.userId,
          announcementId: input.announcementId,
        },
      });

      return { ok: true };
    }),

  /**
   * Mark all active announcements as read for current user.
   */
  markAllAnnouncementsRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      const now = new Date();
      const active = await prismaDb.siteAnnouncement.findMany({
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        select: { id: true },
      });

      if (!active.length)
        return { ok: true, count: 0 };

      const result = await prismaDb.announcementRead.createMany({
        data: active.map((a) => ({
          userId: ctx.userId,
          announcementId: a.id,
        })),
        skipDuplicates: true,
      });

      return { ok: true, count: result.count };
    }),

  /**
   * Redeem a coin code.
   */
  redeemCode: protectedProcedure
    .input(z.object({
      code: z.string().min(4).max(64),
    }))
    .mutation(async ({ input, ctx }) => {
      const normalizedCode = normalizeRedeemCode(input.code);
      const now = new Date();

      return await prismaDb.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: ctx.userId },
          select: { id: true, createdAt: true },
        });
        if (!user)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

        const redeemCode = await tx.redeemCode.findUnique({
          where: { code: normalizedCode },
        });
        if (!redeemCode || !redeemCode.isActive)
          throw new TRPCError({ code: 'NOT_FOUND', message: '兑换码不存在或已失效' });
        if (redeemCode.validFrom && redeemCode.validFrom > now)
          throw new TRPCError({ code: 'BAD_REQUEST', message: '兑换码尚未生效' });
        if (redeemCode.expiresAt && redeemCode.expiresAt <= now)
          throw new TRPCError({ code: 'BAD_REQUEST', message: '兑换码已过期' });
        if (redeemCode.onlyExistingUsers && redeemCode.existingUsersCutoff && user.createdAt > redeemCode.existingUsersCutoff)
          throw new TRPCError({ code: 'FORBIDDEN', message: '该兑换码仅限老用户使用' });

        const existedClaim = await tx.redeemCodeClaim.findUnique({
          where: {
            redeemCodeId_userId: {
              redeemCodeId: redeemCode.id,
              userId: user.id,
            },
          },
          select: { id: true },
        });
        if (existedClaim)
          throw new TRPCError({ code: 'BAD_REQUEST', message: '你已兑换过该兑换码' });

        if (redeemCode.totalUseLimit !== null) {
          const updated = await tx.redeemCode.updateMany({
            where: {
              id: redeemCode.id,
              usedCount: {
                lt: redeemCode.totalUseLimit,
              },
            },
            data: {
              usedCount: { increment: 1 },
            },
          });
          if (updated.count === 0)
            throw new TRPCError({ code: 'BAD_REQUEST', message: '兑换码可用次数已耗尽' });
        } else {
          await tx.redeemCode.update({
            where: { id: redeemCode.id },
            data: { usedCount: { increment: 1 } },
          });
        }

        const coinExpiresAt = redeemCode.coinExpireDays && redeemCode.coinExpireDays > 0
          ? new Date(now.getTime() + redeemCode.coinExpireDays * 24 * 60 * 60 * 1000)
          : null;

        const newBalance = await grantCoinsInTx(tx, {
          userId: user.id,
          amount: redeemCode.coinAmount,
          type: 'GIFT',
          description: `Redeem code ${redeemCode.code}`,
          sourceType: 'GIFT',
          sourceRef: redeemCode.id,
          expiresAt: coinExpiresAt,
        });

        await tx.redeemCodeClaim.create({
          data: {
            redeemCodeId: redeemCode.id,
            userId: user.id,
            claimedCoins: redeemCode.coinAmount,
          },
        });

        return {
          success: true,
          code: redeemCode.code,
          coinAmount: redeemCode.coinAmount,
          newBalance,
        };
      });
    }),

  // For demo/testing only
  rechargeMock: protectedProcedure
    .input(z.object({
      amount: z.number().positive(),
      label: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { addCoins } = await import('../../services/coin.service');
      const newBalance = await addCoins(
        ctx.userId,
        input.amount,
        'RECHARGE',
        `Mock recharge ${input.label || 'coins'}`,
      );
      return {
        success: true,
        newBalance,
      };
    }),
});
