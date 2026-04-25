import { TRPCError } from '@trpc/server';
import type { PayChannel, PaymentOrder } from '@prisma/client';
import { createHash } from 'crypto';
import { prismaDb } from '~/server/prisma/prismaDb';
import { env } from '~/server/env.server';
import { RECHARGE_PACKAGES, type RechargePackage } from './payment.constants';
import { grantCoinsInTx } from './coin.service';
import { settleReferralRechargeRewardInTx } from './referral.service';

type CheckoutData = {
  payUrl: string | null;
  payload: Record<string, string>;
  message: string;
};

type QueryOrderResult = {
  ok: boolean;
  successPaid: boolean;
  transactionId?: string;
  paidAmountYuan?: number;
  statusRaw?: string;
  providerOrderId?: string;
  errorMessage?: string;
};

type SettlePaidInput = {
  orderNo: string;
  transactionId?: string | null;
  paidAmountYuan?: number | null;
};

type RuntimeRechargePackage = RechargePackage & {
  expiresInDays: number | null;
  isActive: boolean;
  sortOrder: number;
};

let rechargePackageTableReady = false;

export async function ensureRechargePackageConfigTable(): Promise<void> {
  if (rechargePackageTableReady)
    return;

  await prismaDb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RechargePackageConfig" (
      id TEXT PRIMARY KEY,
      "packageId" TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      "amountYuan" DOUBLE PRECISION NOT NULL,
      "coinAmount" INTEGER NOT NULL,
      "expiresInDays" INTEGER,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      popular BOOLEAN NOT NULL DEFAULT false,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prismaDb.$executeRawUnsafe(`ALTER TABLE "RechargePackageConfig" ADD COLUMN IF NOT EXISTS label TEXT;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "RechargePackageConfig" ADD COLUMN IF NOT EXISTS "amountYuan" DOUBLE PRECISION;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "RechargePackageConfig" ADD COLUMN IF NOT EXISTS "coinAmount" INTEGER;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "RechargePackageConfig" ADD COLUMN IF NOT EXISTS "expiresInDays" INTEGER;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "RechargePackageConfig" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "RechargePackageConfig" ADD COLUMN IF NOT EXISTS popular BOOLEAN NOT NULL DEFAULT false;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "RechargePackageConfig" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "RechargePackageConfig" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
  await prismaDb.$executeRawUnsafe(`ALTER TABLE "RechargePackageConfig" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();`);

  await prismaDb.$executeRawUnsafe(`UPDATE "RechargePackageConfig" SET popular = false WHERE popular IS NULL;`);
  await prismaDb.$executeRawUnsafe(`UPDATE "RechargePackageConfig" SET "sortOrder" = 0 WHERE "sortOrder" IS NULL;`);
  await prismaDb.$executeRawUnsafe(`UPDATE "RechargePackageConfig" SET "isActive" = true WHERE "isActive" IS NULL;`);
  await prismaDb.$executeRawUnsafe(`UPDATE "RechargePackageConfig" SET "createdAt" = NOW() WHERE "createdAt" IS NULL;`);
  await prismaDb.$executeRawUnsafe(`UPDATE "RechargePackageConfig" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL;`);

  await prismaDb.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RechargePackageConfig_packageId_key" ON "RechargePackageConfig"("packageId");`);
  await prismaDb.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RechargePackageConfig_isActive_sortOrder_idx" ON "RechargePackageConfig"("isActive", "sortOrder");`);

  rechargePackageTableReady = true;
}

function normalizeExpiresInDays(days?: number | null): number | null {
  if (days === null || days === undefined)
    return null;
  if (!Number.isFinite(days))
    return null;
  const normalized = Math.trunc(days);
  return normalized > 0 ? normalized : null;
}

function packageFromDefault(item: RechargePackage, index: number): RuntimeRechargePackage {
  return {
    id: item.id,
    label: item.label,
    amountYuan: item.amountYuan,
    coinAmount: item.coinAmount,
    popular: !!item.popular,
    expiresInDays: normalizeExpiresInDays(item.expiresInDays),
    isActive: item.isActive !== false,
    sortOrder: item.sortOrder ?? index + 1,
  };
}

async function listRuntimePackages(includeInactive = false): Promise<RuntimeRechargePackage[]> {
  try {
    await ensureRechargePackageConfigTable();
    const rows = await prismaDb.rechargePackageConfig.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (rows.length) {
      return rows.map((row) => ({
        id: row.packageId,
        label: row.label,
        amountYuan: row.amountYuan,
        coinAmount: row.coinAmount,
        popular: row.popular,
        expiresInDays: normalizeExpiresInDays(row.expiresInDays),
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      }));
    }
  } catch {
    // Fallback to constants while DB/table is not ready.
  }

  const defaults = RECHARGE_PACKAGES.map(packageFromDefault);
  return includeInactive ? defaults : defaults.filter((item) => item.isActive);
}

async function findPackageById(packageId: string): Promise<RuntimeRechargePackage> {
  const items = await listRuntimePackages(false);
  const found = items.find((item) => item.id === packageId);
  if (!found)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid recharge package' });
  return found;
}

function newOrderNo(): string {
  const now = Date.now().toString();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RC${now}${rand}`;
}

function signWithSecret(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params)
    .filter((key) => key !== 'hash' && key !== 'sign' && key !== 'sign_type' && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return createHash('md5').update(`${sorted}${secret}`, 'utf8').digest('hex').toLowerCase();
}

function appendQueryParam(url: string, key: string, value: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

function parseJsonObjects(raw: string): any[] {
  const chunks: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0)
        start = i;
      depth += 1;
      continue;
    }
    if (ch === '}') {
      if (depth > 0)
        depth -= 1;
      if (depth === 0 && start >= 0) {
        chunks.push(raw.slice(start, i + 1));
        start = -1;
      }
    }
  }

  const objects: any[] = [];
  for (const chunk of chunks) {
    try {
      objects.push(JSON.parse(chunk));
    } catch {
      // ignore invalid segment
    }
  }
  return objects;
}

function xunhuType(channel: PayChannel): 'alipay' | 'wechat' {
  return channel === 'ALIPAY' ? 'alipay' : 'wechat';
}

function zpayType(channel: PayChannel): 'alipay' | 'wxpay' {
  return channel === 'ALIPAY' ? 'alipay' : 'wxpay';
}

function extractXunhuPayUrl(data: any): string {
  const payload = data?.data && typeof data.data === 'object' ? data.data : data;
  const candidates = [
    payload?.url,
    payload?.url_qrcode,
    payload?.pay_url,
    payload?.code_url,
    payload?.qrcode,
    payload?.mweb_url,
    data?.url,
    data?.url_qrcode,
    data?.pay_url,
    data?.code_url,
    data?.qrcode,
    data?.mweb_url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim())
      return candidate.trim();
  }

  return '';
}

async function buildXunhuCheckoutData(order: PaymentOrder): Promise<CheckoutData> {
  const commonPayload = {
    orderNo: order.orderNo,
    amountYuan: order.amountYuan.toFixed(2),
  };

  const gateway = env.XUNHU_GATEWAY?.trim() || 'https://api.xunhupay.com/payment/do.html';
  const appid = env.XUNHU_APP_ID?.trim() || '';
  const appSecret = env.XUNHU_APP_SECRET?.trim() || '';
  const notifyUrl = order.channel === 'ALIPAY' ? env.ALIPAY_NOTIFY_URL : env.WECHAT_PAY_NOTIFY_URL;
  const baseReturnUrl = env.PAYMENT_RETURN_URL;

  if (!gateway || !appid || !appSecret || !notifyUrl || !baseReturnUrl) {
    return {
      payUrl: null,
      payload: commonPayload,
      message: 'XunhuPay is not fully configured. Please set XUNHU_GATEWAY/XUNHU_APP_ID/XUNHU_APP_SECRET/PAYMENT_RETURN_URL/notify URLs.',
    };
  }
  const returnUrl = appendQueryParam(baseReturnUrl, 'orderNo', order.orderNo);
  const notifyLooksLocal = /localhost|127\.0\.0\.1/i.test(notifyUrl);

  const nonceStr = Math.random().toString(36).slice(2, 14);
  const time = String(Math.floor(Date.now() / 1000));
  const requestParams: Record<string, string> = {
    version: '1.1',
    appid,
    trade_order_id: order.orderNo,
    total_fee: order.amountYuan.toFixed(2),
    title: `金币充值-${order.coinAmount}金币`,
    time,
    notify_url: notifyUrl,
    return_url: returnUrl,
    plugins: 'math.aittco.com',
    param: order.userId,
    attach: order.userId,
    nonce_str: nonceStr,
    type: xunhuType(order.channel),
  };
  requestParams.hash = signWithSecret(requestParams, appSecret);

  const formBody = new URLSearchParams(requestParams).toString();
  const response = await fetch(gateway, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
    signal: AbortSignal.timeout(30_000),
  });

  const rawText = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = null;
  }

  if (!response.ok || !data) {
    return {
      payUrl: null,
      payload: commonPayload,
      message: `XunhuPay request failed: ${rawText || response.status}`,
    };
  }

  if (typeof data.hash === 'string') {
    const verifyParams: Record<string, string> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined)
        return;
      verifyParams[key] = String(value);
    });
    const expectedHash = signWithSecret(verifyParams, appSecret);
    if (expectedHash !== String(data.hash).toLowerCase()) {
      return {
        payUrl: null,
        payload: commonPayload,
        message: 'XunhuPay response signature verification failed.',
      };
    }
  }

  if (Number(data.errcode) !== 0) {
    return {
      payUrl: null,
      payload: commonPayload,
      message: `XunhuPay error: ${data.errmsg || 'unknown error'}`,
    };
  }

  const payUrl = extractXunhuPayUrl(data);
  const payload = data?.data && typeof data.data === 'object' ? data.data : data;
  const responseKeys = payload && typeof payload === 'object'
    ? Object.keys(payload).join(', ')
    : '';

  return {
    payUrl: payUrl || null,
    payload: commonPayload,
    message: payUrl
      ? notifyLooksLocal
        ? 'Order created. Redirect to XunhuPay checkout page. Warning: notify_url looks local and may be unreachable from provider.'
        : 'Order created. Redirect to XunhuPay checkout page.'
      : `XunhuPay did not return a valid payment URL.${responseKeys ? ` Response keys: ${responseKeys}` : ''}`,
  };
}

async function queryXunhuOrderByOrderNo(orderNo: string): Promise<QueryOrderResult> {
  const queryUrl = env.XUNHU_QUERY_URL?.trim() || 'https://api.xunhupay.com/payment/query.html';
  const appid = env.XUNHU_APP_ID?.trim() || '';
  const appSecret = env.XUNHU_APP_SECRET?.trim() || '';
  if (!queryUrl || !appid || !appSecret)
    return { ok: false, successPaid: false, errorMessage: 'xunhu query not configured' };

  const nonceStr = Math.random().toString(36).slice(2, 14);
  const time = String(Math.floor(Date.now() / 1000));
  const reqParams: Record<string, string> = {
    version: '1.1',
    appid,
    out_trade_order: orderNo,
    time,
    nonce_str: nonceStr,
  };
  reqParams.hash = signWithSecret(reqParams, appSecret);

  const body = new URLSearchParams(reqParams).toString();
  let raw = '';
  try {
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    raw = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        successPaid: false,
        errorMessage: `xunhu query http ${response.status}: ${raw}`,
      };
    }
  } catch (error: any) {
    return {
      ok: false,
      successPaid: false,
      errorMessage: error?.message || 'xunhu query network failed',
    };
  }

  const objects = parseJsonObjects(raw);
  const preferred = objects.find((item) => Number(item?.errcode) === 0) || objects[objects.length - 1];
  if (!preferred) {
    return {
      ok: false,
      successPaid: false,
      errorMessage: `xunhu query parse failed: ${raw}`,
    };
  }
  const data = preferred;

  if (typeof data?.hash === 'string') {
    const verifyParams: Record<string, string> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined)
        return;
      verifyParams[key] = String(value);
    });
    const expectedHash = signWithSecret(verifyParams, appSecret);
    if (expectedHash !== String(data.hash).toLowerCase()) {
      return {
        ok: false,
        successPaid: false,
        errorMessage: 'xunhu query signature mismatch',
      };
    }
  }

  const payload = data?.data && typeof data.data === 'object' ? data.data : data;
  const errCode = Number(data?.errcode ?? 0);
  const statusRaw = String(payload?.status || payload?.trade_status || data?.status || data?.trade_status || '');
  const isPaid = statusRaw === 'OD' || statusRaw === 'TRADE_SUCCESS';
  const amountRaw = payload?.total_amount ?? payload?.total_fee ?? payload?.money ?? data?.total_amount ?? data?.total_fee ?? data?.money;
  const amount = amountRaw === undefined ? undefined : Number(amountRaw);
  const paidAmountYuan = Number.isFinite(amount) ? amount : undefined;
  const transactionId =
    payload?.transaction_id
    || payload?.trade_no
    || data?.transaction_id
    || data?.trade_no
    || undefined;
  const providerOrderId = payload?.open_order_id || payload?.order_id || data?.open_order_id || data?.order_id || undefined;

  return {
    ok: errCode === 0,
    successPaid: errCode === 0 && isPaid,
    transactionId: transactionId ? String(transactionId) : undefined,
    paidAmountYuan,
    statusRaw,
    providerOrderId: providerOrderId ? String(providerOrderId) : undefined,
    errorMessage: errCode === 0 ? undefined : String(data?.errmsg || 'xunhu query error'),
  };
}

export async function getRechargePackages() {
  return await listRuntimePackages(false);
}

export async function getRechargePackagesForAdmin() {
  return await listRuntimePackages(true);
}

export async function createPaymentOrder(params: {
  userId: string;
  packageId: string;
  channel: PayChannel;
}) {
  const pkg = await findPackageById(params.packageId);

  const order = await prismaDb.paymentOrder.create({
    data: {
      userId: params.userId,
      orderNo: newOrderNo(),
      packageId: pkg.id,
      channel: params.channel,
      amountYuan: pkg.amountYuan,
      coinAmount: pkg.coinAmount,
      coinExpireDays: pkg.expiresInDays,
      status: 'PENDING',
    },
  });

  const checkout = await buildXunhuCheckoutData(order);

  return {
    orderNo: order.orderNo,
    status: order.status,
    channel: order.channel,
    amountYuan: order.amountYuan,
    coinAmount: order.coinAmount,
    coinExpireDays: order.coinExpireDays,
    payUrl: checkout.payUrl,
    payPayload: checkout.payload,
    message: checkout.message,
  };
}

export async function getUserOrderStatus(userId: string, orderNo: string) {
  let order = await prismaDb.paymentOrder.findUnique({
    where: { orderNo },
    select: {
      orderNo: true,
      userId: true,
      packageId: true,
      channel: true,
      amountYuan: true,
      coinAmount: true,
      coinExpireDays: true,
      status: true,
      transactionId: true,
      paidAt: true,
      createdAt: true,
    },
  });

  if (!order || order.userId !== userId)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });

  // Reconcile pending orders via provider-side query, to avoid missing credits when async notify is delayed/lost.
  if (order.status === 'PENDING') {
    const queried = await queryXunhuOrderByOrderNo(orderNo);
    if (queried.successPaid) {
      try {
        await settlePaymentOrderPaid({
          orderNo,
          transactionId: queried.transactionId,
          paidAmountYuan: queried.paidAmountYuan,
        });
      } catch (error) {
        console.error('[payment] reconcile settle failed', {
          orderNo,
          queried,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      order = await prismaDb.paymentOrder.findUnique({
        where: { orderNo },
        select: {
          orderNo: true,
          userId: true,
          packageId: true,
          channel: true,
          amountYuan: true,
          coinAmount: true,
          coinExpireDays: true,
          status: true,
          transactionId: true,
          paidAt: true,
          createdAt: true,
        },
      });
      if (!order || order.userId !== userId)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    } else if (!queried.ok && queried.errorMessage) {
      console.warn('[payment] reconcile query failed', { orderNo, error: queried.errorMessage });
    }
  }

  const user = await prismaDb.user.findUnique({
    where: { id: userId },
    select: { coinBalance: true },
  });

  return {
    ...order,
    currentBalance: user?.coinBalance ?? 0,
  };
}

export async function getLatestUserOrderStatus(userId: string) {
  const order = await prismaDb.paymentOrder.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      orderNo: true,
      userId: true,
      packageId: true,
      channel: true,
      amountYuan: true,
      coinAmount: true,
      coinExpireDays: true,
      status: true,
      transactionId: true,
      paidAt: true,
      createdAt: true,
    },
  });

  if (!order)
    return null;

  if (order.status === 'PENDING') {
    const queried = await queryXunhuOrderByOrderNo(order.orderNo);
    if (queried.successPaid) {
      try {
        await settlePaymentOrderPaid({
          orderNo: order.orderNo,
          transactionId: queried.transactionId,
          paidAmountYuan: queried.paidAmountYuan,
        });
      } catch (error) {
        console.error('[payment] latest-order reconcile settle failed', {
          orderNo: order.orderNo,
          queried,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const refreshedOrder = await prismaDb.paymentOrder.findUnique({
        where: { orderNo: order.orderNo },
        select: {
          orderNo: true,
          userId: true,
          packageId: true,
          channel: true,
          amountYuan: true,
          coinAmount: true,
          coinExpireDays: true,
          status: true,
          transactionId: true,
          paidAt: true,
          createdAt: true,
        },
      });
      if (!refreshedOrder)
        return null;

      const user = await prismaDb.user.findUnique({
        where: { id: userId },
        select: { coinBalance: true },
      });
      return {
        ...refreshedOrder,
        currentBalance: user?.coinBalance ?? 0,
      };
    } else if (!queried.ok && queried.errorMessage) {
      console.warn('[payment] latest-order reconcile query failed', { orderNo: order.orderNo, error: queried.errorMessage });
    }
  }

  const user = await prismaDb.user.findUnique({
    where: { id: userId },
    select: { coinBalance: true },
  });
  return {
    ...order,
    currentBalance: user?.coinBalance ?? 0,
  };
}

export async function settlePaymentOrderPaid(input: SettlePaidInput) {
  return prismaDb.$transaction(async (tx) => {
    const order = await tx.paymentOrder.findUnique({
      where: { orderNo: input.orderNo },
      select: {
        id: true,
        userId: true,
        orderNo: true,
        packageId: true,
        amountYuan: true,
        coinAmount: true,
        coinExpireDays: true,
        status: true,
      },
    });

    if (!order)
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });

    if (order.status === 'PAID') {
      return {
        ok: true,
        status: 'PAID' as const,
        duplicated: true,
        orderNo: order.orderNo,
      };
    }

    if (order.status !== 'PENDING')
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Order status is ${order.status}` });

    if (typeof input.paidAmountYuan === 'number') {
      const delta = Math.abs(input.paidAmountYuan - order.amountYuan);
      if (delta > 0.01)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Paid amount mismatch' });
    }

    const updated = await tx.paymentOrder.updateMany({
      where: {
        id: order.id,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        transactionId: input.transactionId || undefined,
      },
    });

    if (updated.count !== 1) {
      return {
        ok: true,
        status: 'PAID' as const,
        duplicated: true,
        orderNo: order.orderNo,
      };
    }

    const paidAt = new Date();
    const expiresAt = order.coinExpireDays && order.coinExpireDays > 0
      ? new Date(paidAt.getTime() + order.coinExpireDays * 24 * 60 * 60 * 1000)
      : null;

    await grantCoinsInTx(tx, {
      userId: order.userId,
      amount: order.coinAmount,
      type: 'RECHARGE',
      description: `Recharge order ${order.orderNo}`,
      expiresAt,
      sourceRef: order.orderNo,
      sourceType: 'RECHARGE',
    });

    await settleReferralRechargeRewardInTx(tx, {
      paymentOrderId: order.id,
      orderNo: order.orderNo,
      referredUserId: order.userId,
      coinAmount: order.coinAmount,
    });

    return {
      ok: true,
      status: 'PAID' as const,
      duplicated: false,
      orderNo: order.orderNo,
    };
  });
}

export function verifyPaymentNotifyToken(candidate: string | null | undefined) {
  const expected = env.PAYMENT_NOTIFY_TOKEN?.trim() || '';
  if (!expected)
    return false;
  return !!candidate && candidate === expected;
}

export function verifyZPaySign(params: Record<string, string>, signature: string | null | undefined) {
  const pkey = env.ZPAY_PKEY?.trim() || '';
  if (!pkey || !signature)
    return false;
  return signWithSecret(params, pkey) === signature.toLowerCase();
}

export function verifyXunhuSign(params: Record<string, string>, signature: string | null | undefined) {
  const secret = env.XUNHU_APP_SECRET?.trim() || '';
  if (!secret || !signature)
    return false;
  return signWithSecret(params, secret) === signature.toLowerCase();
}
