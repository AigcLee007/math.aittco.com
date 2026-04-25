import { randomUUID } from 'node:crypto';
import { CoinGrantSourceType, TransactionType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prismaDb } from '../prisma/prismaDb';

type TxClient = Prisma.TransactionClient;

type GrantCoinsParams = {
  userId: string;
  amount: number;
  type: TransactionType;
  description: string;
  modelId?: string | null;
  expiresAt?: Date | null;
  sourceRef?: string | null;
  sourceType?: CoinGrantSourceType;
};

type ReservationRow = {
  taskKey: string;
  userId: string;
  modelId: string | null;
  amount: number;
  status: 'PENDING' | 'SETTLED' | 'RELEASED';
};

type PendingReservationTaskRow = {
  taskKey: string;
};

const RESERVATION_TTL_MINUTES = 60;
let reservationTableReady = false;

function mapTransactionTypeToGrantSource(type: TransactionType): CoinGrantSourceType {
  switch (type) {
    case 'RECHARGE':
      return 'RECHARGE';
    case 'REFUND':
      return 'REFUND';
    case 'GIFT':
      return 'GIFT';
    default:
      return 'ADMIN';
  }
}

async function ensureCoinReservationTable(): Promise<void> {
  if (reservationTableReady)
    return;

  await prismaDb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CoinReservation" (
      id TEXT PRIMARY KEY,
      "taskKey" TEXT UNIQUE NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "modelId" TEXT,
      amount INTEGER NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL CHECK (status IN ('PENDING','SETTLED','RELEASED')),
      description TEXT,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "settledAt" TIMESTAMPTZ,
      "releasedAt" TIMESTAMPTZ,
      "releaseReason" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prismaDb.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CoinReservation_user_status_created_idx" ON "CoinReservation"("userId", status, "createdAt");');
  await prismaDb.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CoinReservation_status_expires_idx" ON "CoinReservation"(status, "expiresAt");');

  reservationTableReady = true;
}

async function lockUserRowInTx(tx: TxClient, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

async function getUserBalanceInTx(tx: TxClient, userId: string): Promise<number> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { coinBalance: true },
  });
  return user?.coinBalance ?? 0;
}

async function setUserBalanceInTx(tx: TxClient, userId: string, balance: number): Promise<number> {
  const updated = await tx.user.update({
    where: { id: userId },
    data: { coinBalance: balance },
    select: { coinBalance: true },
  });
  return updated.coinBalance;
}

async function getPendingReservationSumInTx(tx: TxClient, userId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ total: number | null }[]>`
    SELECT COALESCE(SUM(amount), 0)::int AS total
    FROM "CoinReservation"
    WHERE "userId" = ${userId}
      AND status = 'PENDING'
      AND "expiresAt" > NOW()
  `;
  return Number(rows[0]?.total ?? 0);
}

async function releaseExpiredReservationsInTx(tx: TxClient, userId?: string): Promise<void> {
  if (userId) {
    await tx.$executeRaw`
      UPDATE "CoinReservation"
      SET status = 'RELEASED',
          "releasedAt" = NOW(),
          "updatedAt" = NOW(),
          "releaseReason" = COALESCE("releaseReason", 'Reservation timeout')
      WHERE status = 'PENDING'
        AND "expiresAt" <= NOW()
        AND "userId" = ${userId}
    `;
    return;
  }

  await tx.$executeRawUnsafe(`
    UPDATE "CoinReservation"
    SET status = 'RELEASED',
        "releasedAt" = NOW(),
        "updatedAt" = NOW(),
        "releaseReason" = COALESCE("releaseReason", 'Reservation timeout')
    WHERE status = 'PENDING'
      AND "expiresAt" <= NOW();
  `);
}

async function getAvailableBalanceInTx(tx: TxClient, userId: string, knownTotalBalance?: number): Promise<number> {
  const totalBalance = typeof knownTotalBalance === 'number'
    ? knownTotalBalance
    : await getUserBalanceInTx(tx, userId);

  const pending = await getPendingReservationSumInTx(tx, userId);
  return Math.max(0, totalBalance - pending);
}

async function expireUserCoinsInTx(tx: TxClient, userId: string): Promise<number> {
  const now = new Date();
  const expiredGrants = await tx.coinGrant.findMany({
    where: {
      userId,
      remainingCoins: { gt: 0 },
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      remainingCoins: true,
    },
  });

  if (!expiredGrants.length)
    return await getUserBalanceInTx(tx, userId);

  const expireAmount = expiredGrants.reduce((sum, grant) => sum + grant.remainingCoins, 0);
  await tx.coinGrant.updateMany({
    where: { id: { in: expiredGrants.map((grant) => grant.id) } },
    data: { remainingCoins: 0 },
  });

  const beforeBalance = await getUserBalanceInTx(tx, userId);
  const pendingReservations = await getPendingReservationSumInTx(tx, userId);
  const maxDeductible = Math.max(0, beforeBalance - pendingReservations);
  const deducted = Math.min(maxDeductible, expireAmount);
  const afterBalance = await setUserBalanceInTx(tx, userId, beforeBalance - deducted);

  if (deducted > 0) {
    await tx.coinTransaction.create({
      data: {
        userId,
        type: 'CONSUME',
        amount: -deducted,
        balance: afterBalance,
        description: '金币过期作废',
      },
    });
  }

  return afterBalance;
}

async function consumeCoinsFromGrantsInTx(tx: TxClient, userId: string, amount: number, currentBalance: number): Promise<void> {
  const now = new Date();
  const grants = await tx.coinGrant.findMany({
    where: {
      userId,
      remainingCoins: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      remainingCoins: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const sortedGrants = [...grants].sort((a, b) => {
    const aExpires = a.expiresAt ? a.expiresAt.getTime() : Number.MAX_SAFE_INTEGER;
    const bExpires = b.expiresAt ? b.expiresAt.getTime() : Number.MAX_SAFE_INTEGER;
    if (aExpires !== bExpires)
      return aExpires - bExpires;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const grantTotal = sortedGrants.reduce((sum, grant) => sum + grant.remainingCoins, 0);
  const legacyBalance = Math.max(0, currentBalance - grantTotal);
  const totalAvailable = grantTotal + legacyBalance;

  if (totalAvailable < amount)
    throw new Error('余额不足');

  let need = amount;
  for (const grant of sortedGrants) {
    if (need <= 0)
      break;

    const consume = Math.min(grant.remainingCoins, need);
    if (consume <= 0)
      continue;

    await tx.coinGrant.update({
      where: { id: grant.id },
      data: {
        remainingCoins: {
          decrement: consume,
        },
      },
    });

    need -= consume;
  }
}

export async function grantCoinsInTx(tx: TxClient, params: GrantCoinsParams): Promise<number> {
  const {
    userId,
    amount,
    type,
    description,
    modelId,
    expiresAt,
    sourceRef,
    sourceType,
  } = params;

  if (amount <= 0)
    return await getAvailableBalanceInTx(tx, userId);

  await ensureCoinReservationTable();
  await lockUserRowInTx(tx, userId);
  await releaseExpiredReservationsInTx(tx, userId);

  const currentBalance = await expireUserCoinsInTx(tx, userId);
  const nextBalance = currentBalance + amount;
  await setUserBalanceInTx(tx, userId, nextBalance);

  await tx.coinTransaction.create({
    data: {
      userId,
      type,
      amount,
      balance: nextBalance,
      modelId: modelId || undefined,
      description,
    },
  });

  await tx.coinGrant.create({
    data: {
      userId,
      sourceType: sourceType || mapTransactionTypeToGrantSource(type),
      sourceRef: sourceRef || undefined,
      totalCoins: amount,
      remainingCoins: amount,
      expiresAt: expiresAt || null,
    },
  });

  return await getAvailableBalanceInTx(tx, userId, nextBalance);
}

export async function getCoinBalance(userId: string): Promise<number> {
  await ensureCoinReservationTable();

  return await prismaDb.$transaction(async (tx) => {
    await lockUserRowInTx(tx, userId);
    await releaseExpiredReservationsInTx(tx, userId);
    const currentBalance = await expireUserCoinsInTx(tx, userId);
    return await getAvailableBalanceInTx(tx, userId, currentBalance);
  });
}

export async function checkBalance(userId: string, requiredAmount: number): Promise<{
  isEnough: boolean;
  currentBalance: number;
}> {
  const currentBalance = await getCoinBalance(userId);
  return {
    isEnough: currentBalance >= requiredAmount,
    currentBalance,
  };
}

export async function reserveCoins(
  userId: string,
  amount: number,
  modelId: string | null,
  taskKey: string,
  description = '',
): Promise<number> {
  if (amount <= 0)
    return await getCoinBalance(userId);

  await ensureCoinReservationTable();

  return await prismaDb.$transaction(async (tx) => {
    await lockUserRowInTx(tx, userId);
    await releaseExpiredReservationsInTx(tx, userId);
    await expireUserCoinsInTx(tx, userId);

    const existing = await tx.$queryRaw<ReservationRow[]>`
      SELECT "taskKey", "userId", "modelId", amount, status
      FROM "CoinReservation"
      WHERE "taskKey" = ${taskKey}
      LIMIT 1
    `;

    if (existing.length > 0)
      return await getAvailableBalanceInTx(tx, userId);

    const available = await getAvailableBalanceInTx(tx, userId);
    if (available < amount)
      throw new Error('余额不足');

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
    await tx.$executeRaw`
      INSERT INTO "CoinReservation" (
        id, "taskKey", "userId", "modelId", amount, status, description, "expiresAt", "createdAt", "updatedAt"
      )
      VALUES (
        ${randomUUID()}, ${taskKey}, ${userId}, ${modelId}, ${amount}, 'PENDING', ${description || null}, ${expiresAt}, NOW(), NOW()
      )
    `;

    return available - amount;
  });
}

export async function rebindReservedTaskKey(oldTaskKey: string, newTaskKey: string): Promise<boolean> {
  if (!oldTaskKey || !newTaskKey || oldTaskKey === newTaskKey)
    return false;

  await ensureCoinReservationTable();

  return await prismaDb.$transaction(async (tx) => {
    const existingNew = await tx.$queryRaw<ReservationRow[]>`
      SELECT "taskKey", "userId", "modelId", amount, status
      FROM "CoinReservation"
      WHERE "taskKey" = ${newTaskKey}
      LIMIT 1
    `;

    if (existingNew.length > 0)
      return false;

    const updated = await tx.$executeRaw`
      UPDATE "CoinReservation"
      SET "taskKey" = ${newTaskKey}, "updatedAt" = NOW()
      WHERE "taskKey" = ${oldTaskKey}
        AND status = 'PENDING'
    `;

    return Number(updated) > 0;
  });
}

export async function settleReservedCoins(taskKey: string, description = ''): Promise<boolean> {
  if (!taskKey)
    return false;

  await ensureCoinReservationTable();

  return await prismaDb.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ReservationRow[]>`
      SELECT "taskKey", "userId", "modelId", amount, status
      FROM "CoinReservation"
      WHERE "taskKey" = ${taskKey}
      LIMIT 1
      FOR UPDATE
    `;

    if (!rows.length)
      return false;

    const row = rows[0];
    if (row.status === 'SETTLED')
      return true;
    if (row.status !== 'PENDING')
      return false;

    await lockUserRowInTx(tx, row.userId);
    const currentBalance = await getUserBalanceInTx(tx, row.userId);
    if (currentBalance < row.amount)
      throw new Error('余额不足，无法完成结算');

    await consumeCoinsFromGrantsInTx(tx, row.userId, row.amount, currentBalance);
    const nextBalance = await setUserBalanceInTx(tx, row.userId, currentBalance - row.amount);

    await tx.coinTransaction.create({
      data: {
        userId: row.userId,
        type: 'CONSUME',
        amount: -row.amount,
        balance: nextBalance,
        modelId: row.modelId || undefined,
        description: description || `生图消费: ${row.modelId || 'image-model'}`,
      },
    });

    await tx.$executeRaw`
      UPDATE "CoinReservation"
      SET status = 'SETTLED', "settledAt" = NOW(), "updatedAt" = NOW()
      WHERE "taskKey" = ${taskKey}
    `;

    return true;
  });
}

export async function releaseReservedCoins(taskKey: string, reason = ''): Promise<boolean> {
  if (!taskKey)
    return false;

  await ensureCoinReservationTable();

  return await prismaDb.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ReservationRow[]>`
      SELECT "taskKey", "userId", "modelId", amount, status
      FROM "CoinReservation"
      WHERE "taskKey" = ${taskKey}
      LIMIT 1
      FOR UPDATE
    `;

    if (!rows.length)
      return false;

    const row = rows[0];
    if (row.status !== 'PENDING')
      return false;

    await tx.$executeRaw`
      UPDATE "CoinReservation"
      SET status = 'RELEASED',
          "releasedAt" = NOW(),
          "updatedAt" = NOW(),
          "releaseReason" = ${reason || '任务失败，自动解冻'}
      WHERE "taskKey" = ${taskKey}
    `;

    return true;
  });
}

export async function listPendingReservationTaskKeys(limit = 200): Promise<string[]> {
  await ensureCoinReservationTable();

  const safeLimit = Math.max(1, Math.min(limit, 1000));
  const rows = await prismaDb.$queryRaw<PendingReservationTaskRow[]>`
    SELECT "taskKey"
    FROM "CoinReservation"
    WHERE status = 'PENDING'
      AND "expiresAt" > NOW()
    ORDER BY "createdAt" ASC
    LIMIT ${safeLimit}
  `;

  return rows
    .map((row) => row.taskKey)
    .filter((taskKey) => typeof taskKey === 'string' && !!taskKey.trim());
}

export async function deductCoins(
  userId: string,
  amount: number,
  modelId: string | null,
  description: string,
): Promise<number> {
  if (amount <= 0)
    return await getCoinBalance(userId);

  await ensureCoinReservationTable();

  return await prismaDb.$transaction(async (tx) => {
    await lockUserRowInTx(tx, userId);
    await releaseExpiredReservationsInTx(tx, userId);

    const currentBalance = await expireUserCoinsInTx(tx, userId);
    const availableBalance = await getAvailableBalanceInTx(tx, userId, currentBalance);
    if (availableBalance < amount)
      throw new Error('余额不足');

    await consumeCoinsFromGrantsInTx(tx, userId, amount, currentBalance);
    const nextBalance = currentBalance - amount;
    await setUserBalanceInTx(tx, userId, nextBalance);

    await tx.coinTransaction.create({
      data: {
        userId,
        type: 'CONSUME',
        amount: -amount,
        balance: nextBalance,
        modelId: modelId || undefined,
        description,
      },
    });

    return await getAvailableBalanceInTx(tx, userId, nextBalance);
  });
}

export async function addCoins(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
  options?: {
    expiresAt?: Date | null;
    sourceRef?: string | null;
    sourceType?: CoinGrantSourceType;
    modelId?: string | null;
  },
): Promise<number> {
  if (amount <= 0)
    return await getCoinBalance(userId);

  await ensureCoinReservationTable();

  return await prismaDb.$transaction(async (tx) => {
    return await grantCoinsInTx(tx, {
      userId,
      amount,
      type,
      description,
      modelId: options?.modelId,
      expiresAt: options?.expiresAt ?? null,
      sourceRef: options?.sourceRef ?? null,
      sourceType: options?.sourceType,
    });
  });
}

export async function expireUserCoins(userId: string): Promise<number> {
  await ensureCoinReservationTable();

  return await prismaDb.$transaction(async (tx) => {
    await lockUserRowInTx(tx, userId);
    await releaseExpiredReservationsInTx(tx, userId);
    const currentBalance = await expireUserCoinsInTx(tx, userId);
    return await getAvailableBalanceInTx(tx, userId, currentBalance);
  });
}
