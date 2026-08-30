import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';
import type { Prisma, UserRole } from '@prisma/client';
import { createTRPCRouter, adminProcedure } from '../trpc.server';
import { prismaDb } from '../../prisma/prismaDb';
import { hashPassword } from '../../auth/password';
import { ensureInvitationCodeTable } from '../../services/invitation.service';
import {
  MODEL_ROUTE_OVERRIDES_CONFIG_KEY,
  RELAY_CHANNELS_CONFIG_KEY,
  RELAY_SYSTEM_CONFIG_KEYS,
  getMergedModelRouteTable,
  invalidateRelayRuntimeConfigCache,
  type RelayTransport,
} from '../../services/model-route.service';
import { env } from '../../env.server';
import { addCoins, deductCoins } from '../../services/coin.service';
import { ensureRechargePackageConfigTable, getRechargePackagesForAdmin } from '../../services/payment.service';
import {
  getReferralAdminStats,
  invalidateReferralRuntimeConfigCache,
  REFERRAL_SYSTEM_CONFIG_KEYS,
} from '../../services/referral.service';

const relayRouteIdSchema = z.string().min(1).transform((value) => value.trim().toLowerCase());
const relayTransportEnum = z.enum(['gemini-generate-content', 'openai-images', 'openai-responses', 'anthropic', 'visionary-images']);
const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const ADMIN_INVITATION_REWARD_LIMIT = 20;
const RECENT_LOGIN_WINDOW_DAYS = 7;
const shanghaiDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function assertSuperAdmin(ctx: any): void {
  if (ctx.userRole !== 'SUPER_ADMIN')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission denied: super admin only' });
}

function assertAdminInvitationRewardLimit(ctx: any, rewardCoins: number): void {
  if (ctx.userRole === 'ADMIN' && rewardCoins > ADMIN_INVITATION_REWARD_LIMIT) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `管理员创建邀请码时，赠送金币最多为 ${ADMIN_INVITATION_REWARD_LIMIT}`,
    });
  }
}

function normalizeModelId(modelId: string): string {
  return modelId.trim().replace(/^models\//, '').toLowerCase();
}

function normalizeEndpointPath(endpointPath?: string): string | undefined {
  if (!endpointPath)
    return undefined;
  const trimmed = endpointPath.trim();
  if (!trimmed)
    return undefined;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeRelayBaseUrl(baseUrl?: string): string | undefined {
  if (!baseUrl)
    return undefined;
  const trimmed = baseUrl.trim();
  if (!trimmed)
    return undefined;
  return trimmed.replace(/\/+$/, '').replace(/\/v1beta?$/, '');
}

function parseRouteOverrides(rawValue?: string): Record<string, {
  routeId: string;
  protocol: RelayTransport;
  upstreamModel: string;
  endpointPath?: string;
  baseUrl?: string;
  apiKey?: string;
  resolutionModelPolicy?: 'same' | 'suffix';
}> {
  if (!rawValue?.trim())
    return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};

    const normalized: Record<string, {
      routeId: string;
      protocol: RelayTransport;
      upstreamModel: string;
      endpointPath?: string;
      baseUrl?: string;
      apiKey?: string;
      resolutionModelPolicy?: 'same' | 'suffix';
    }> = {};

    for (const [modelId, rawDef] of Object.entries(parsed as Record<string, any>)) {
      if (!rawDef || typeof rawDef !== 'object' || Array.isArray(rawDef))
        continue;
      const routeId = String(rawDef.routeId || '').trim().toLowerCase();
      if (!routeId)
        continue;
      const transport = rawDef.protocol || rawDef.transport;
      if (!relayTransportEnum.safeParse(transport).success)
        continue;
      const upstreamModel = String(rawDef.upstreamModel || '').trim();
      const baseUrl = normalizeRelayBaseUrl(rawDef.baseUrl);
      const apiKey = String(rawDef.apiKey || '').trim();
      const resolutionModelPolicy = String(rawDef.resolutionModelPolicy || '').trim().toLowerCase() === 'suffix'
        ? 'suffix'
        : 'same';
      if (!upstreamModel)
        continue;

      normalized[normalizeModelId(modelId)] = {
        routeId,
        protocol: transport as RelayTransport,
        upstreamModel,
        endpointPath: normalizeEndpointPath(rawDef.endpointPath),
        ...(baseUrl ? { baseUrl } : {}),
        ...(apiKey ? { apiKey } : {}),
        resolutionModelPolicy,
      };
    }

    return normalized;
  } catch {
    return {};
  }
}

function parseRelayChannels(rawValue?: string): Record<string, { label: string; baseUrl: string; apiKey: string }> {
  if (!rawValue?.trim())
    return {};
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    const channels: Record<string, { label: string; baseUrl: string; apiKey: string }> = {};
    for (const [rawId, rawDef] of Object.entries(parsed as Record<string, any>)) {
      const id = String(rawId || '').trim().toLowerCase();
      if (!id || !rawDef || typeof rawDef !== 'object' || Array.isArray(rawDef))
        continue;
      const baseUrl = normalizeRelayBaseUrl(rawDef.baseUrl);
      const apiKey = String(rawDef.apiKey || '').trim();
      const label = String(rawDef.label || id.toUpperCase()).trim() || id.toUpperCase();
      if (!baseUrl && !apiKey)
        continue;
      channels[id] = {
        label,
        baseUrl: baseUrl || '',
        apiKey,
      };
    }
    return channels;
  } catch {
    return {};
  }
}

function toShanghaiDateKey(date: Date): string {
  const parts = shanghaiDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, days: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match)
    return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function shanghaiDateKeyToUtcStart(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match)
    return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day) - SHANGHAI_UTC_OFFSET_MS);
}

function normalizeRedeemCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

export const adminRouter = createTRPCRouter({

  getAllUsers: adminProcedure
    .input(z.object({
      limit: z.number().optional().default(50),
      offset: z.number().optional().default(0),
      search: z.string().trim().optional(),
      role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']).optional(),
      createdFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      createdTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      loginState: z.enum(['RECENT', 'NEVER']).optional(),
      balanceState: z.enum(['POSITIVE', 'ZERO']).optional(),
      privilegedOnly: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const { limit, offset, search, role, createdFrom, createdTo, loginState, balanceState, privilegedOnly } = input;
      const normalizedSearch = search?.trim();
      const shortIdSearch = normalizedSearch && /^\d+$/.test(normalizedSearch)
        ? Number(normalizedSearch)
        : undefined;
      const createdFromUtc = createdFrom ? shanghaiDateKeyToUtcStart(createdFrom) : null;
      const createdToExclusiveUtc = createdTo ? shanghaiDateKeyToUtcStart(addDaysToDateKey(createdTo, 1) || '') : null;
      const recentLoginThreshold = new Date(Date.now() - RECENT_LOGIN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const privilegedRoles: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];
      const where: Prisma.UserWhereInput = {};

      if (privilegedOnly)
        where.role = role || { in: privilegedRoles };
      else if (role)
        where.role = role;

      if (createdFromUtc || createdToExclusiveUtc) {
        where.createdAt = {
          ...(createdFromUtc ? { gte: createdFromUtc } : {}),
          ...(createdToExclusiveUtc ? { lt: createdToExclusiveUtc } : {}),
        };
      }

      if (loginState === 'NEVER')
        where.lastLoginAt = null;
      else if (loginState === 'RECENT')
        where.lastLoginAt = { gte: recentLoginThreshold };

      if (balanceState === 'POSITIVE')
        where.coinBalance = { gt: 0 };
      else if (balanceState === 'ZERO')
        where.coinBalance = 0;

      if (normalizedSearch) {
        where.OR = [
          { email: { contains: normalizedSearch, mode: 'insensitive' } },
          { nickname: { contains: normalizedSearch, mode: 'insensitive' } },
          { username: { contains: normalizedSearch, mode: 'insensitive' } },
          ...(shortIdSearch !== undefined ? [{ shortId: shortIdSearch }] : []),
        ];
      }

      const users = await prismaDb.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          nickname: true,
          username: true,
          shortId: true,
          role: true,
          coinBalance: true,
          isActive: true,
          lastLoginAt: true,
          lastLoginIP: true,
          adminNotes: true,
          tags: true,
          createdAt: true,
        },
      });

      const total = await prismaDb.user.count({ where });
      return { users, total };
    }),

  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']),
    }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      const { userId, role } = input;
      const currentUserId = (ctx as any).userId;

      const targetUser = await prismaDb.user.findUnique({ where: { id: userId } });
      if (!targetUser)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      if (currentUserId === userId)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot change your own role' });

      return await prismaDb.user.update({
        where: { id: userId },
        data: { role },
      });
    }),

  resetUserPassword: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      const passwordHash = await hashPassword('123456');
      return await prismaDb.user.update({
        where: { id: input.userId },
        data: { passwordHash },
      });
    }),

  updateUserBalance: adminProcedure
    .input(z.object({
      userId: z.string(),
      amount: z.number(),
      description: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      const { userId, amount, description } = input;
      const targetUser = await prismaDb.user.findUnique({ where: { id: userId } });
      if (!targetUser)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      const finalDescription = `[Admin Manual] ${description}`;
      try {
        if (amount > 0) {
          await addCoins(userId, amount, 'GIFT', finalDescription, {
            sourceType: 'ADMIN',
          });
        } else if (amount < 0) {
          await deductCoins(userId, Math.abs(amount), null, finalDescription);
        }
      } catch (error: any) {
        if (error?.message?.includes('余额不足') || error?.message?.toLowerCase?.().includes('balance'))
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Insufficient balance' });
        throw error;
      }

      return await prismaDb.user.findUnique({ where: { id: userId } });
    }),

  updateUserAdminFields: adminProcedure
    .input(z.object({
      userId: z.string(),
      adminNotes: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await prismaDb.user.update({
        where: { id: input.userId },
        data: {
          adminNotes: input.adminNotes,
          tags: input.tags,
        },
      });
    }),

  updateUserStatus: adminProcedure
    .input(z.object({ userId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      return await prismaDb.user.update({
        where: { id: input.userId },
        data: { isActive: input.isActive },
      });
    }),

  getInvitationCodes: adminProcedure.query(async () => {
    await ensureInvitationCodeTable();
    return await prismaDb.invitationCode.findMany({ orderBy: { createdAt: 'desc' } });
  }),

  getReferralAdminStats: adminProcedure.query(async () => {
    return await getReferralAdminStats();
  }),

  createInvitationCode: adminProcedure
    .input(z.object({
      code: z.string(),
      maxUses: z.number().int().positive().default(1),
      rewardCoins: z.number().int().nonnegative().default(0),
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertAdminInvitationRewardLimit(ctx, input.rewardCoins);
      await ensureInvitationCodeTable();
      return await prismaDb.invitationCode.create({
        data: {
          ...input,
          createdBy: (ctx as any).userId,
        },
      });
    }),

  deleteInvitationCode: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await ensureInvitationCodeTable();
      return await prismaDb.invitationCode.delete({ where: { id: input.id } });
    }),

  getRedeemCodes: adminProcedure
    .query(async ({ ctx }) => {
      assertSuperAdmin(ctx);
      const rows = await prismaDb.redeemCode.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { claims: true },
          },
        },
      });

      return rows.map((row) => ({
        ...row,
        claimCount: row._count.claims,
        remainingUses: row.totalUseLimit === null ? null : Math.max(0, row.totalUseLimit - row.usedCount),
      }));
    }),

  upsertRedeemCode: adminProcedure
    .input(z.object({
      code: z.string().min(4).max(64),
      coinAmount: z.number().int().positive(),
      totalUseLimit: z.number().int().positive().nullable().optional(),
      coinExpireDays: z.number().int().positive().nullable().optional(),
      validFrom: z.date().nullable().optional(),
      expiresAt: z.date().nullable().optional(),
      onlyExistingUsers: z.boolean().default(false),
      description: z.string().max(200).optional(),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      const code = normalizeRedeemCode(input.code);
      const validFrom = input.validFrom ?? null;
      const expiresAt = input.expiresAt ?? null;
      if (validFrom && expiresAt && expiresAt <= validFrom)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'expiresAt must be later than validFrom' });

      const existing = await prismaDb.redeemCode.findUnique({
        where: { code },
        select: { id: true, existingUsersCutoff: true },
      });
      const now = new Date();
      const existingUsersCutoff = input.onlyExistingUsers
        ? existing?.existingUsersCutoff || now
        : null;

      return await prismaDb.redeemCode.upsert({
        where: { code },
        update: {
          coinAmount: input.coinAmount,
          totalUseLimit: input.totalUseLimit ?? null,
          coinExpireDays: input.coinExpireDays ?? null,
          validFrom,
          expiresAt,
          onlyExistingUsers: input.onlyExistingUsers,
          existingUsersCutoff,
          description: input.description?.trim() || null,
          isActive: input.isActive,
        },
        create: {
          code,
          coinAmount: input.coinAmount,
          totalUseLimit: input.totalUseLimit ?? null,
          coinExpireDays: input.coinExpireDays ?? null,
          validFrom,
          expiresAt,
          onlyExistingUsers: input.onlyExistingUsers,
          existingUsersCutoff,
          description: input.description?.trim() || null,
          isActive: input.isActive,
          createdBy: ctx.userId,
        },
      });
    }),

  setRedeemCodeStatus: adminProcedure
    .input(z.object({
      id: z.string(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      return await prismaDb.redeemCode.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),

  deleteRedeemCode: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      await prismaDb.redeemCode.delete({
        where: { id: input.id },
      });
      return { ok: true };
    }),

  getDashboardStats: adminProcedure.query(async () => {
    const totalUsers = await prismaDb.user.count();
    const adminCount = await prismaDb.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
    const coinSum = await prismaDb.user.aggregate({ _sum: { coinBalance: true } });
    const totalCoins = coinSum._sum.coinBalance || 0;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newUsersToday = await prismaDb.user.count({ where: { createdAt: { gte: dayAgo } } });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUsers = await prismaDb.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });
    const daily: Record<string, number> = {};
    recentUsers.forEach((u) => {
      const d = u.createdAt.toISOString().split('T')[0];
      daily[d] = (daily[d] || 0) + 1;
    });
    const trend = Object.entries(daily).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    return { totalUsers, adminCount, totalCoins, newUsersToday, dailyNewUsers: trend };
  }),

  getAllTransactions: adminProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      type: z.string().optional(),
      userId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { limit, offset, type, userId } = input;
      const where = { ...(type ? { type: type as any } : {}), ...(userId ? { userId } : {}) };
      const items = await prismaDb.coinTransaction.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { nickname: true, email: true } } },
      });
      const total = await prismaDb.coinTransaction.count({ where });
      return { items, total };
    }),

  getAllPricing: adminProcedure.query(async ({ ctx }) => {
    assertSuperAdmin(ctx);
    return await prismaDb.modelPricing.findMany({ orderBy: { modelId: 'asc' } });
  }),
  updatePricing: adminProcedure
    .input(z.object({
      id: z.string().optional(),
      modelId: z.string(),
      modelName: z.string(),
      category: z.enum(['CHAT', 'IMAGE', 'VIDEO']),
      coinCost: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      const { id, ...data } = input;
      return id
        ? prismaDb.modelPricing.update({ where: { id }, data })
        : prismaDb.modelPricing.create({ data });
    }),

  getRechargePackageConfigs: adminProcedure
    .query(async ({ ctx }) => {
      assertSuperAdmin(ctx);
      return await getRechargePackagesForAdmin();
    }),

  upsertRechargePackageConfig: adminProcedure
    .input(z.object({
      packageId: z.string().min(1),
      label: z.string().min(1),
      amountYuan: z.number().positive(),
      coinAmount: z.number().int().positive(),
      expiresInDays: z.number().int().positive().nullable().optional(),
      isActive: z.boolean().default(true),
      popular: z.boolean().default(false),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      await ensureRechargePackageConfigTable();
      const packageId = input.packageId.trim();
      const expiresInDays = input.expiresInDays && input.expiresInDays > 0 ? input.expiresInDays : null;
      return await prismaDb.rechargePackageConfig.upsert({
        where: { packageId },
        update: {
          label: input.label.trim(),
          amountYuan: input.amountYuan,
          coinAmount: input.coinAmount,
          expiresInDays,
          isActive: input.isActive,
          popular: input.popular,
          sortOrder: input.sortOrder,
        },
        create: {
          packageId,
          label: input.label.trim(),
          amountYuan: input.amountYuan,
          coinAmount: input.coinAmount,
          expiresInDays,
          isActive: input.isActive,
          popular: input.popular,
          sortOrder: input.sortOrder,
        },
      });
    }),

  deleteRechargePackageConfig: adminProcedure
    .input(z.object({ packageId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      await ensureRechargePackageConfigTable();
      await prismaDb.rechargePackageConfig.deleteMany({
        where: { packageId: input.packageId.trim() },
      });
      return { ok: true };
    }),

  getUserCoinGrants: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      return await prismaDb.coinGrant.findMany({
        where: { userId: input.userId },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
      });
    }),

  getRelayModelConfig: adminProcedure
    .query(async ({ ctx }) => {
      assertSuperAdmin(ctx);
      const keysToRead = [
        RELAY_SYSTEM_CONFIG_KEYS.aittco.hostKey,
        RELAY_SYSTEM_CONFIG_KEYS.aittco.apiKey,
        RELAY_SYSTEM_CONFIG_KEYS.bltcy.hostKey,
        RELAY_SYSTEM_CONFIG_KEYS.bltcy.apiKey,
        RELAY_CHANNELS_CONFIG_KEY,
        MODEL_ROUTE_OVERRIDES_CONFIG_KEY,
      ];
      const configRows = await prismaDb.systemConfig.findMany({
        where: { key: { in: keysToRead } },
        select: { key: true, value: true },
      });
      const configMap = new Map(configRows.map((row) => [row.key, row.value]));

      const routeOverrides = parseRouteOverrides(configMap.get(MODEL_ROUTE_OVERRIDES_CONFIG_KEY));
      const dynamicChannels = parseRelayChannels(configMap.get(RELAY_CHANNELS_CONFIG_KEY));
      const legacyChannels = {
        aittco: {
          label: 'AITTCO',
          baseUrl: configMap.get(RELAY_SYSTEM_CONFIG_KEYS.aittco.hostKey) || env.AITTCO_API_HOST || '',
          apiKey: configMap.get(RELAY_SYSTEM_CONFIG_KEYS.aittco.apiKey) || env.AITTCO_API_KEY || '',
        },
        bltcy: {
          label: 'BLTCY',
          baseUrl: configMap.get(RELAY_SYSTEM_CONFIG_KEYS.bltcy.hostKey) || env.BLTCY_API_HOST || 'https://api.bltcy.ai',
          apiKey: configMap.get(RELAY_SYSTEM_CONFIG_KEYS.bltcy.apiKey) || env.BLTCY_API_KEY || '',
        },
      };
      const imagePricing = await prismaDb.modelPricing.findMany({
        where: { category: 'IMAGE' },
        orderBy: { modelId: 'asc' },
      });
      const videoPricing = await prismaDb.modelPricing.findMany({
        where: { category: 'VIDEO' },
        orderBy: { modelId: 'asc' },
      });
      const chatPricing = await prismaDb.modelPricing.findMany({
        where: { category: 'CHAT' },
        orderBy: { modelId: 'asc' },
      });
      const mergedRouteTable = await getMergedModelRouteTable();

      return {
        channels: {
          ...legacyChannels,
          ...dynamicChannels,
        },
        routeOverrides,
        imagePricing,
        videoPricing,
        chatPricing,
        mergedRouteTable,
      };
    }),

  upsertRelayModelConfig: adminProcedure
    .input(z.object({
      modelId: z.string().min(1),
      modelName: z.string().min(1),
      coinCost: z.number().int().nonnegative(),
      category: z.enum(['IMAGE', 'VIDEO', 'CHAT']).default('IMAGE'),
      isActive: z.boolean().default(true),
      routeId: relayRouteIdSchema,
      transport: relayTransportEnum.default('openai-images'),
      resolutionModelPolicy: z.enum(['same', 'suffix']).default('same'),
      upstreamModel: z.string().optional(),
      endpointPath: z.string().optional(),
      baseUrl: z.string().url(),
      apiKey: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);

      const normalizedModelId = normalizeModelId(input.modelId);
      const normalizedRouteId = input.routeId.trim().toLowerCase();
      const upstreamModel = input.upstreamModel?.trim() || input.modelId.trim();
      const endpointPath = normalizeEndpointPath(input.endpointPath)
        || (input.transport === 'openai-images' ? '/v1/images/generations' : undefined);
      const normalizedBaseUrl = normalizeRelayBaseUrl(input.baseUrl) || input.baseUrl.trim();
      const normalizedApiKey = input.apiKey.trim();

      await prismaDb.$transaction(async (tx) => {
        const channelRow = await tx.systemConfig.findUnique({
          where: { key: RELAY_CHANNELS_CONFIG_KEY },
          select: { value: true },
        });
        const channels = parseRelayChannels(channelRow?.value);
        const channelLabel = channels[normalizedRouteId]?.label || normalizedRouteId.toUpperCase();
        channels[normalizedRouteId] = {
          label: channelLabel,
          baseUrl: normalizedBaseUrl,
          apiKey: normalizedApiKey,
        };
        await tx.systemConfig.upsert({
          where: { key: RELAY_CHANNELS_CONFIG_KEY },
          update: {
            value: JSON.stringify(channels),
            group: 'relay',
            description: 'Relay channels in JSON format',
          },
          create: {
            key: RELAY_CHANNELS_CONFIG_KEY,
            value: JSON.stringify(channels),
            group: 'relay',
            description: 'Relay channels in JSON format',
          },
        });

        if (normalizedRouteId === 'aittco' || normalizedRouteId === 'bltcy') {
          const legacyKeys = RELAY_SYSTEM_CONFIG_KEYS[normalizedRouteId];
          await tx.systemConfig.upsert({
            where: { key: legacyKeys.hostKey },
            update: {
              value: normalizedBaseUrl,
              description: `${normalizedRouteId.toUpperCase()} relay host`,
              group: 'relay',
            },
            create: {
              key: legacyKeys.hostKey,
              value: normalizedBaseUrl,
              description: `${normalizedRouteId.toUpperCase()} relay host`,
              group: 'relay',
            },
          });
          await tx.systemConfig.upsert({
            where: { key: legacyKeys.apiKey },
            update: {
              value: normalizedApiKey,
              description: `${normalizedRouteId.toUpperCase()} relay api key`,
              group: 'relay',
            },
            create: {
              key: legacyKeys.apiKey,
              value: normalizedApiKey,
              description: `${normalizedRouteId.toUpperCase()} relay api key`,
              group: 'relay',
            },
          });
        }

        const overrideRow = await tx.systemConfig.findUnique({
          where: { key: MODEL_ROUTE_OVERRIDES_CONFIG_KEY },
          select: { value: true },
        });
        const overrides = parseRouteOverrides(overrideRow?.value);
        overrides[normalizedModelId] = {
          routeId: normalizedRouteId,
          protocol: input.transport,
          upstreamModel,
          ...(endpointPath ? { endpointPath } : {}),
          baseUrl: normalizeRelayBaseUrl(input.baseUrl),
          apiKey: normalizedApiKey,
          resolutionModelPolicy: input.resolutionModelPolicy,
        };

        await tx.systemConfig.upsert({
          where: { key: MODEL_ROUTE_OVERRIDES_CONFIG_KEY },
          update: {
            value: JSON.stringify(overrides),
            group: 'relay',
            description: 'Model route overrides in JSON format',
          },
          create: {
            key: MODEL_ROUTE_OVERRIDES_CONFIG_KEY,
            value: JSON.stringify(overrides),
            group: 'relay',
            description: 'Model route overrides in JSON format',
          },
        });

        await tx.modelPricing.upsert({
          where: { modelId: input.modelId.trim() },
          update: {
            modelName: input.modelName.trim(),
            category: input.category,
            coinCost: input.coinCost,
            isActive: input.isActive,
          },
          create: {
            modelId: input.modelId.trim(),
            modelName: input.modelName.trim(),
            category: input.category,
            coinCost: input.coinCost,
            isActive: input.isActive,
          },
        });
      });

      invalidateRelayRuntimeConfigCache();
      return { ok: true, modelId: input.modelId.trim() };
    }),

  deleteRelayModelConfig: adminProcedure
    .input(z.object({ modelId: z.string().min(1), category: z.enum(['IMAGE', 'VIDEO', 'CHAT']).optional() }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      const normalizedModelId = normalizeModelId(input.modelId);
      await prismaDb.$transaction(async (tx) => {
        const overrideRow = await tx.systemConfig.findUnique({
          where: { key: MODEL_ROUTE_OVERRIDES_CONFIG_KEY },
          select: { value: true },
        });
        const overrides = parseRouteOverrides(overrideRow?.value);
        if (overrides[normalizedModelId]) {
          delete overrides[normalizedModelId];
          await tx.systemConfig.upsert({
            where: { key: MODEL_ROUTE_OVERRIDES_CONFIG_KEY },
            update: { value: JSON.stringify(overrides) },
            create: {
              key: MODEL_ROUTE_OVERRIDES_CONFIG_KEY,
              value: JSON.stringify(overrides),
              group: 'relay',
              description: 'Model route overrides in JSON format',
            },
          });
        }

        await tx.modelPricing.deleteMany({
          where: {
            modelId: input.modelId.trim(),
            ...(input.category ? { category: input.category } : {}),
          },
        });
      });

      invalidateRelayRuntimeConfigCache();
      return { ok: true };
    }),

  getConfigs: adminProcedure.query(async ({ ctx }) => {
    assertSuperAdmin(ctx);
    return await prismaDb.systemConfig.findMany();
  }),
  updateConfig: adminProcedure
    .input(z.object({ key: z.string(), value: z.string(), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      assertSuperAdmin(ctx);
      const result = await prismaDb.systemConfig.upsert({
        where: { key: input.key },
        update: { value: input.value, description: input.description },
        create: { key: input.key, value: input.value, description: input.description, group: 'general' },
      });

      if (
        input.key === MODEL_ROUTE_OVERRIDES_CONFIG_KEY
        || input.key === RELAY_CHANNELS_CONFIG_KEY
        || input.key === RELAY_SYSTEM_CONFIG_KEYS.aittco.hostKey
        || input.key === RELAY_SYSTEM_CONFIG_KEYS.aittco.apiKey
        || input.key === RELAY_SYSTEM_CONFIG_KEYS.bltcy.hostKey
        || input.key === RELAY_SYSTEM_CONFIG_KEYS.bltcy.apiKey
      ) {
        invalidateRelayRuntimeConfigCache();
      }

      if (
        input.key === REFERRAL_SYSTEM_CONFIG_KEYS.signupRewardCoins
        || input.key === REFERRAL_SYSTEM_CONFIG_KEYS.rechargeRewardRate
        || input.key === REFERRAL_SYSTEM_CONFIG_KEYS.rechargeRewardLimit
      ) {
        invalidateReferralRuntimeConfigCache();
      }

      return result;
    }),

  getAnnouncements: adminProcedure.query(async () => prismaDb.siteAnnouncement.findMany({ orderBy: { createdAt: 'desc' } })),
  createAnnouncement: adminProcedure
    .input(z.object({ title: z.string().min(1), content: z.string().min(1), type: z.string().default('info'), imageUrl: z.string().optional(), isActive: z.boolean().default(true) }))
    .mutation(async ({ input }) => prismaDb.siteAnnouncement.create({ data: input as any })),
  deleteAnnouncement: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => prismaDb.siteAnnouncement.delete({ where: { id: input.id } })),

  getTransactionStats: adminProcedure
    .input(z.object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      type: z.enum(['RECHARGE', 'CONSUME', 'GIFT', 'REFUND']).optional(),
    }))
    .query(async ({ input }) => {
      const { startDate, endDate, type } = input;
      let rangeStart: Date | null = null;
      let rangeEndExclusive: Date | null = null;
      const where: any = {};
      if (startDate || endDate) {
        const startDateKey = startDate ? toShanghaiDateKey(startDate) : null;
        const endDateKey = endDate ? toShanghaiDateKey(endDate) : null;
        const endExclusiveKey = endDateKey ? addDaysToDateKey(endDateKey, 1) : null;
        rangeStart = startDateKey ? shanghaiDateKeyToUtcStart(startDateKey) : null;
        rangeEndExclusive = endExclusiveKey ? shanghaiDateKeyToUtcStart(endExclusiveKey) : null;
        where.createdAt = {
          ...(rangeStart ? { gte: rangeStart } : {}),
          ...(rangeEndExclusive ? { lt: rangeEndExclusive } : {}),
        };
      }
      if (type)
        where.type = type;

      const transactions = await prismaDb.coinTransaction.findMany({
        where,
        select: {
          createdAt: true,
          amount: true,
          type: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const stats: Record<string, { recharge: number; consume: number; gift: number; paidYuan: number }> = {};
      transactions.forEach((t) => {
        const dateStr = toShanghaiDateKey(t.createdAt);
        if (!stats[dateStr])
          stats[dateStr] = { recharge: 0, consume: 0, gift: 0, paidYuan: 0 };
        const absAmount = Math.abs(t.amount);
        if (t.type === 'RECHARGE') stats[dateStr].recharge += absAmount;
        else if (t.type === 'CONSUME') stats[dateStr].consume += absAmount;
        else if (t.type === 'GIFT') stats[dateStr].gift += absAmount;
      });

      if (!type || type === 'RECHARGE') {
        const paidOrders = await prismaDb.paymentOrder.findMany({
          where: {
            status: 'PAID',
            paidAt: {
              not: null,
              ...(rangeStart ? { gte: rangeStart } : {}),
              ...(rangeEndExclusive ? { lt: rangeEndExclusive } : {}),
            },
          },
          select: {
            paidAt: true,
            amountYuan: true,
          },
          orderBy: { paidAt: 'asc' },
        });

        for (const order of paidOrders) {
          const paidAt = order.paidAt || new Date();
          const dateStr = toShanghaiDateKey(paidAt);
          if (!stats[dateStr])
            stats[dateStr] = { recharge: 0, consume: 0, gift: 0, paidYuan: 0 };
          stats[dateStr].paidYuan += Number(order.amountYuan || 0);
        }
      }

      return Object.entries(stats).map(([date, data]) => ({
        date,
        recharge: data.recharge,
        consume: data.consume,
        gift: data.gift,
        paidYuan: Number(data.paidYuan.toFixed(2)),
      })).sort((a, b) => a.date.localeCompare(b.date));
    }),
});
