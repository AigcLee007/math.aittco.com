import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prismaDb } from '../prisma/prismaDb';
import { grantCoinsInTx } from './coin.service';

type TxClient = Prisma.TransactionClient;

export const REFERRAL_SYSTEM_CONFIG_KEYS = {
  signupRewardCoins: 'REFERRAL_SIGNUP_REWARD_COINS',
  rechargeRewardRate: 'REFERRAL_RECHARGE_REWARD_RATE',
  rechargeRewardLimit: 'REFERRAL_RECHARGE_REWARD_LIMIT',
} as const;

export const DEFAULT_SHARE_REGISTRATION_REWARD_COINS = 20;
export const DEFAULT_REFERRAL_RECHARGE_REWARD_RATE = 0.05;
export const DEFAULT_REFERRAL_RECHARGE_REWARD_LIMIT = 3;

type ReferralUserPreview = {
  id: string;
  shortId: number | null;
  nickname: string;
};

type ReferralSummaryRow = {
  totalRewardCoins: number | null;
  signupRewardCoins: number | null;
  rechargeRewardCoins: number | null;
  signupRewardCount: number | null;
  rechargeRewardCount: number | null;
};

type ReferralRecentRewardRow = {
  referredUserId: string;
  referredNickname: string;
  rewardCoins: number;
  type: 'SIGNUP' | 'RECHARGE';
  rechargeSequence: number | null;
  createdAt: Date;
};

type ReferralRuntimeConfig = {
  signupRewardCoins: number;
  rechargeRewardRate: number;
  rechargeRewardLimit: number;
};

type ReferralOverviewRow = {
  totalRewardCoins: number | null;
  signupRewardCoins: number | null;
  rechargeRewardCoins: number | null;
  signupRewardCount: number | null;
  rechargeRewardCount: number | null;
};

type ReferralTopReferrerRow = {
  referrerUserId: string;
  referrerNickname: string;
  referrerShortId: number | null;
  invitedUsers: number | null;
  totalRewardCoins: number | null;
  signupRewardCoins: number | null;
  rechargeRewardCoins: number | null;
};

type ReferralRecentInvitationRow = {
  referredUserId: string;
  referredNickname: string;
  referredEmail: string;
  referredShortId: number | null;
  inviterUserId: string;
  inviterNickname: string;
  inviterShortId: number | null;
  createdAt: Date;
};

let referralRewardTableReady = false;
let referralRuntimeConfigCache: ReferralRuntimeConfig | null = null;

function normalizeNonNegativeInt(rawValue: string | null | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed))
    return fallback;
  return Math.max(0, Math.round(parsed));
}

function normalizeRate(rawValue: string | null | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed))
    return fallback;
  return Math.max(0, parsed);
}

export async function ensureReferralRewardTable(): Promise<void> {
  if (referralRewardTableReady)
    return;

  await prismaDb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralReward" (
      id TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "referredUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "paymentOrderId" TEXT UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('SIGNUP', 'RECHARGE')),
      "rewardCoins" INTEGER NOT NULL CHECK ("rewardCoins" >= 0),
      "rechargeSequence" INTEGER,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prismaDb.$executeRawUnsafe(`ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "referrerUserId" TEXT;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "referredUserId" TEXT;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "paymentOrderId" TEXT;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS type TEXT;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "rewardCoins" INTEGER NOT NULL DEFAULT 0;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "rechargeSequence" INTEGER;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "ReferralReward" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`);

  await prismaDb.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ReferralReward_paymentOrderId_key" ON "ReferralReward"("paymentOrderId");`);
  await prismaDb.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReferralReward_referrerUserId_createdAt_idx" ON "ReferralReward"("referrerUserId", "createdAt");`);
  await prismaDb.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReferralReward_referredUserId_createdAt_idx" ON "ReferralReward"("referredUserId", "createdAt");`);
  await prismaDb.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReferralReward_type_createdAt_idx" ON "ReferralReward"(type, "createdAt");`);

  referralRewardTableReady = true;
}

export function invalidateReferralRuntimeConfigCache(): void {
  referralRuntimeConfigCache = null;
}

export async function getReferralRuntimeConfig(): Promise<ReferralRuntimeConfig> {
  if (referralRuntimeConfigCache)
    return referralRuntimeConfigCache;

  const rows = await prismaDb.systemConfig.findMany({
    where: {
      key: {
        in: [
          REFERRAL_SYSTEM_CONFIG_KEYS.signupRewardCoins,
          REFERRAL_SYSTEM_CONFIG_KEYS.rechargeRewardRate,
          REFERRAL_SYSTEM_CONFIG_KEYS.rechargeRewardLimit,
        ],
      },
    },
    select: { key: true, value: true },
  });

  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  referralRuntimeConfigCache = {
    signupRewardCoins: normalizeNonNegativeInt(
      byKey.get(REFERRAL_SYSTEM_CONFIG_KEYS.signupRewardCoins),
      DEFAULT_SHARE_REGISTRATION_REWARD_COINS,
    ),
    rechargeRewardRate: normalizeRate(
      byKey.get(REFERRAL_SYSTEM_CONFIG_KEYS.rechargeRewardRate),
      DEFAULT_REFERRAL_RECHARGE_REWARD_RATE,
    ),
    rechargeRewardLimit: Math.max(
      1,
      normalizeNonNegativeInt(
        byKey.get(REFERRAL_SYSTEM_CONFIG_KEYS.rechargeRewardLimit),
        DEFAULT_REFERRAL_RECHARGE_REWARD_LIMIT,
      ),
    ),
  };

  return referralRuntimeConfigCache;
}

export async function resolveReferralUserByCode(rawCode: string): Promise<ReferralUserPreview | null> {
  const code = String(rawCode || '').trim();
  if (!code)
    return null;

  const byShortId = /^\d+$/.test(code)
    ? await prismaDb.user.findFirst({
        where: { shortId: Number(code), isActive: true },
        select: { id: true, shortId: true, nickname: true },
      })
    : null;

  if (byShortId)
    return byShortId;

  const normalized = code.toLowerCase();
  return await prismaDb.user.findFirst({
    where: {
      id: normalized,
      isActive: true,
    },
    select: { id: true, shortId: true, nickname: true },
  });
}

export async function grantShareSignupRewardInTx(tx: TxClient, params: {
  referrerUserId: string;
  referredUserId: string;
}): Promise<void> {
  await ensureReferralRewardTable();
  const runtimeConfig = await getReferralRuntimeConfig();

  const existing = await tx.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "ReferralReward"
    WHERE "referrerUserId" = ${params.referrerUserId}
      AND "referredUserId" = ${params.referredUserId}
      AND type = 'SIGNUP'
    LIMIT 1
  `;

  if (existing.length)
    return;

  await tx.$executeRaw`
    INSERT INTO "ReferralReward" (
      id, "referrerUserId", "referredUserId", "paymentOrderId", type, "rewardCoins", "rechargeSequence", "createdAt"
    )
    VALUES (
      ${randomUUID()}, ${params.referrerUserId}, ${params.referredUserId}, NULL, 'SIGNUP', ${runtimeConfig.signupRewardCoins}, NULL, NOW()
    )
  `;
}

export async function settleReferralRechargeRewardInTx(tx: TxClient, params: {
  paymentOrderId: string;
  orderNo: string;
  referredUserId: string;
  coinAmount: number;
}): Promise<{ rewardCoins: number; sequence: number } | null> {
  await ensureReferralRewardTable();
  const runtimeConfig = await getReferralRuntimeConfig();

  const referredUser = await tx.user.findUnique({
    where: { id: params.referredUserId },
    select: {
      id: true,
      inviterId: true,
      nickname: true,
    },
  });

  if (!referredUser?.inviterId || referredUser.inviterId === referredUser.id)
    return null;

  const duplicate = await tx.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "ReferralReward"
    WHERE "paymentOrderId" = ${params.paymentOrderId}
    LIMIT 1
  `;

  if (duplicate.length)
    return null;

  const rows = await tx.$queryRaw<{ count: number | null }[]>`
    SELECT COUNT(*)::int AS count
    FROM "ReferralReward"
    WHERE "referredUserId" = ${params.referredUserId}
      AND type = 'RECHARGE'
  `;

  const completedRechargeRewards = Number(rows[0]?.count ?? 0);
  if (completedRechargeRewards >= runtimeConfig.rechargeRewardLimit)
    return null;

  const sequence = completedRechargeRewards + 1;
  const rewardCoins = Math.max(1, Math.round(params.coinAmount * runtimeConfig.rechargeRewardRate));

  await tx.$executeRaw`
    INSERT INTO "ReferralReward" (
      id, "referrerUserId", "referredUserId", "paymentOrderId", type, "rewardCoins", "rechargeSequence", "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${referredUser.inviterId},
      ${params.referredUserId},
      ${params.paymentOrderId},
      'RECHARGE',
      ${rewardCoins},
      ${sequence},
      NOW()
    )
  `;

  await grantCoinsInTx(tx, {
    userId: referredUser.inviterId,
    amount: rewardCoins,
    type: 'GIFT',
    description: `邀请返佣：好友前${runtimeConfig.rechargeRewardLimit}次充值奖励（第${sequence}次）`,
    sourceType: 'GIFT',
    sourceRef: params.orderNo,
  });

  return {
    rewardCoins,
    sequence,
  };
}

export async function getReferralSummary(userId: string) {
  await ensureReferralRewardTable();
  const runtimeConfig = await getReferralRuntimeConfig();

  const [user, invitedCountRows, summaryRows, recentRows] = await Promise.all([
    prismaDb.user.findUnique({
      where: { id: userId },
      select: { id: true, shortId: true, nickname: true },
    }),
    prismaDb.$queryRaw<{ count: number | null }[]>`
      SELECT COUNT(*)::int AS count
      FROM "User"
      WHERE "inviterId" = ${userId}
    `,
    prismaDb.$queryRaw<ReferralSummaryRow[]>`
      SELECT
        COALESCE(SUM("rewardCoins"), 0)::int AS "totalRewardCoins",
        COALESCE(SUM(CASE WHEN type = 'SIGNUP' THEN "rewardCoins" ELSE 0 END), 0)::int AS "signupRewardCoins",
        COALESCE(SUM(CASE WHEN type = 'RECHARGE' THEN "rewardCoins" ELSE 0 END), 0)::int AS "rechargeRewardCoins",
        COALESCE(SUM(CASE WHEN type = 'SIGNUP' THEN 1 ELSE 0 END), 0)::int AS "signupRewardCount",
        COALESCE(SUM(CASE WHEN type = 'RECHARGE' THEN 1 ELSE 0 END), 0)::int AS "rechargeRewardCount"
      FROM "ReferralReward"
      WHERE "referrerUserId" = ${userId}
    `,
    prismaDb.$queryRaw<ReferralRecentRewardRow[]>`
      SELECT
        rr."referredUserId" AS "referredUserId",
        u.nickname AS "referredNickname",
        rr."rewardCoins" AS "rewardCoins",
        rr.type AS type,
        rr."rechargeSequence" AS "rechargeSequence",
        rr."createdAt" AS "createdAt"
      FROM "ReferralReward" rr
      JOIN "User" u ON u.id = rr."referredUserId"
      WHERE rr."referrerUserId" = ${userId}
      ORDER BY rr."createdAt" DESC
      LIMIT 10
    `,
  ]);

  if (!user)
    return null;

  const shareCode = user.shortId ? String(user.shortId) : user.id;
  const summary = summaryRows[0];

  return {
    shareCode,
    invitedUsers: Number(invitedCountRows[0]?.count ?? 0),
    totalRewardCoins: Number(summary?.totalRewardCoins ?? 0),
    signupRewardCoins: Number(summary?.signupRewardCoins ?? 0),
    rechargeRewardCoins: Number(summary?.rechargeRewardCoins ?? 0),
    signupRewardCount: Number(summary?.signupRewardCount ?? 0),
    rechargeRewardCount: Number(summary?.rechargeRewardCount ?? 0),
    signupRewardPerUser: runtimeConfig.signupRewardCoins,
    rechargeRewardRate: runtimeConfig.rechargeRewardRate,
    rechargeRewardLimit: runtimeConfig.rechargeRewardLimit,
    recentRewards: recentRows.map((row) => ({
      referredUserId: row.referredUserId,
      referredNickname: row.referredNickname,
      rewardCoins: Number(row.rewardCoins ?? 0),
      type: row.type,
      rechargeSequence: row.rechargeSequence ? Number(row.rechargeSequence) : null,
      createdAt: row.createdAt,
    })),
  };
}

export async function getReferralAdminStats() {
  await ensureReferralRewardTable();
  const runtimeConfig = await getReferralRuntimeConfig();

  const [invitedCountRows, overviewRows, topReferrerRows, recentInvitationRows, recentRewardRows] = await Promise.all([
    prismaDb.$queryRaw<{ count: number | null }[]>`
      SELECT COUNT(*)::int AS count
      FROM "User"
      WHERE "inviterId" IS NOT NULL
    `,
    prismaDb.$queryRaw<ReferralOverviewRow[]>`
      SELECT
        COALESCE(SUM("rewardCoins"), 0)::int AS "totalRewardCoins",
        COALESCE(SUM(CASE WHEN type = 'SIGNUP' THEN "rewardCoins" ELSE 0 END), 0)::int AS "signupRewardCoins",
        COALESCE(SUM(CASE WHEN type = 'RECHARGE' THEN "rewardCoins" ELSE 0 END), 0)::int AS "rechargeRewardCoins",
        COALESCE(SUM(CASE WHEN type = 'SIGNUP' THEN 1 ELSE 0 END), 0)::int AS "signupRewardCount",
        COALESCE(SUM(CASE WHEN type = 'RECHARGE' THEN 1 ELSE 0 END), 0)::int AS "rechargeRewardCount"
      FROM "ReferralReward"
    `,
    prismaDb.$queryRaw<ReferralTopReferrerRow[]>`
      WITH invited AS (
        SELECT "inviterId" AS "referrerUserId", COUNT(*)::int AS "invitedUsers"
        FROM "User"
        WHERE "inviterId" IS NOT NULL
        GROUP BY "inviterId"
      ),
      reward AS (
        SELECT
          "referrerUserId",
          COALESCE(SUM("rewardCoins"), 0)::int AS "totalRewardCoins",
          COALESCE(SUM(CASE WHEN type = 'SIGNUP' THEN "rewardCoins" ELSE 0 END), 0)::int AS "signupRewardCoins",
          COALESCE(SUM(CASE WHEN type = 'RECHARGE' THEN "rewardCoins" ELSE 0 END), 0)::int AS "rechargeRewardCoins"
        FROM "ReferralReward"
        GROUP BY "referrerUserId"
      )
      SELECT
        u.id AS "referrerUserId",
        u.nickname AS "referrerNickname",
        u."shortId" AS "referrerShortId",
        COALESCE(invited."invitedUsers", 0)::int AS "invitedUsers",
        COALESCE(reward."totalRewardCoins", 0)::int AS "totalRewardCoins",
        COALESCE(reward."signupRewardCoins", 0)::int AS "signupRewardCoins",
        COALESCE(reward."rechargeRewardCoins", 0)::int AS "rechargeRewardCoins"
      FROM "User" u
      LEFT JOIN invited ON invited."referrerUserId" = u.id
      LEFT JOIN reward ON reward."referrerUserId" = u.id
      WHERE invited."referrerUserId" IS NOT NULL OR reward."referrerUserId" IS NOT NULL
      ORDER BY "totalRewardCoins" DESC, "invitedUsers" DESC, "referrerNickname" ASC
      LIMIT 20
    `,
    prismaDb.$queryRaw<ReferralRecentInvitationRow[]>`
      SELECT
        invited.id AS "referredUserId",
        invited.nickname AS "referredNickname",
        invited.email AS "referredEmail",
        invited."shortId" AS "referredShortId",
        inviter.id AS "inviterUserId",
        inviter.nickname AS "inviterNickname",
        inviter."shortId" AS "inviterShortId",
        invited."createdAt" AS "createdAt"
      FROM "User" invited
      JOIN "User" inviter ON inviter.id = invited."inviterId"
      ORDER BY invited."createdAt" DESC
      LIMIT 20
    `,
    prismaDb.$queryRaw<ReferralRecentRewardRow[]>`
      SELECT
        rr."referredUserId" AS "referredUserId",
        u.nickname AS "referredNickname",
        rr."rewardCoins" AS "rewardCoins",
        rr.type AS type,
        rr."rechargeSequence" AS "rechargeSequence",
        rr."createdAt" AS "createdAt"
      FROM "ReferralReward" rr
      JOIN "User" u ON u.id = rr."referredUserId"
      ORDER BY rr."createdAt" DESC
      LIMIT 20
    `,
  ]);

  const overview = overviewRows[0];

  return {
    config: runtimeConfig,
    overview: {
      invitedUsers: Number(invitedCountRows[0]?.count ?? 0),
      totalRewardCoins: Number(overview?.totalRewardCoins ?? 0),
      signupRewardCoins: Number(overview?.signupRewardCoins ?? 0),
      rechargeRewardCoins: Number(overview?.rechargeRewardCoins ?? 0),
      signupRewardCount: Number(overview?.signupRewardCount ?? 0),
      rechargeRewardCount: Number(overview?.rechargeRewardCount ?? 0),
    },
    topReferrers: topReferrerRows.map((row) => ({
      referrerUserId: row.referrerUserId,
      referrerNickname: row.referrerNickname,
      referrerShortId: row.referrerShortId ? Number(row.referrerShortId) : null,
      invitedUsers: Number(row.invitedUsers ?? 0),
      totalRewardCoins: Number(row.totalRewardCoins ?? 0),
      signupRewardCoins: Number(row.signupRewardCoins ?? 0),
      rechargeRewardCoins: Number(row.rechargeRewardCoins ?? 0),
    })),
    recentInvitations: recentInvitationRows.map((row) => ({
      referredUserId: row.referredUserId,
      referredNickname: row.referredNickname,
      referredEmail: row.referredEmail,
      referredShortId: row.referredShortId ? Number(row.referredShortId) : null,
      inviterUserId: row.inviterUserId,
      inviterNickname: row.inviterNickname,
      inviterShortId: row.inviterShortId ? Number(row.inviterShortId) : null,
      createdAt: row.createdAt,
    })),
    recentRewards: recentRewardRows.map((row) => ({
      referredUserId: row.referredUserId,
      referredNickname: row.referredNickname,
      rewardCoins: Number(row.rewardCoins ?? 0),
      type: row.type,
      rechargeSequence: row.rechargeSequence ? Number(row.rechargeSequence) : null,
      createdAt: row.createdAt,
    })),
  };
}
