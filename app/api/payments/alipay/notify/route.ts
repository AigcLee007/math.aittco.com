import { NextResponse } from 'next/server';
import { env } from '~/server/env.server';
import { settlePaymentOrderPaid, verifyPaymentNotifyToken, verifyXunhuSign, verifyZPaySign } from '~/server/services/payment.service';
import { normalizeNotifyPayload, parseNotifyBody, parseNotifyQuery, toSignableParams } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleNotify(req: Request, method: 'GET' | 'POST') {
  try {
    const body = method === 'GET' ? parseNotifyQuery(req) : await parseNotifyBody(req);
    const payload = normalizeNotifyPayload(body);
    console.info('[payment][alipay][notify] received', {
      method,
      orderNo: payload.orderNo,
      tradeStatus: payload.tradeStatus,
      paymentType: payload.paymentType,
      appId: payload.appId || undefined,
      pid: payload.pid || undefined,
    });
    const headerToken = req.headers.get('x-payment-notify-token');
    const expectedAppId = env.XUNHU_APP_ID?.trim() || '';
    const expectedPid = env.ZPAY_PID?.trim() || '';

    if (!payload.orderNo) {
      console.warn('[payment][alipay][notify] rejected: missing orderNo');
      return new Response('missing orderNo', { status: 400 });
    }

    if (expectedAppId && payload.appId && payload.appId !== expectedAppId) {
      console.warn('[payment][alipay][notify] rejected: invalid appid', { expectedAppId, got: payload.appId });
      return new Response('invalid appid', { status: 400 });
    }

    if (payload.pid && expectedPid && payload.pid !== expectedPid) {
      console.warn('[payment][alipay][notify] rejected: invalid pid', { expectedPid, got: payload.pid });
      return new Response('invalid pid', { status: 400 });
    }

    if (payload.tradeStatus !== 'TRADE_SUCCESS' && payload.tradeStatus !== 'OD') {
      console.warn('[payment][alipay][notify] rejected: invalid trade status', { tradeStatus: payload.tradeStatus });
      return new Response('invalid trade_status', { status: 400 });
    }

    if (payload.paymentType && payload.paymentType !== 'alipay') {
      console.warn('[payment][alipay][notify] rejected: invalid payment type', { paymentType: payload.paymentType });
      return new Response('invalid payment type', { status: 400 });
    }

    const signable = toSignableParams(body);
    if (payload.sign && (verifyXunhuSign(signable, payload.sign) || verifyZPaySign(signable, payload.sign))) {
      // ZPay MD5 signature verified
    } else if (!verifyPaymentNotifyToken(headerToken || payload.notifyToken)) {
      console.warn('[payment][alipay][notify] rejected: invalid signature and notify token');
      return new Response('invalid signature', { status: 401 });
    }

    await settlePaymentOrderPaid({
      orderNo: payload.orderNo,
      transactionId: payload.transactionId,
      paidAmountYuan: payload.paidAmountYuan,
    });
    console.info('[payment][alipay][notify] settled', { orderNo: payload.orderNo, transactionId: payload.transactionId });

    return new Response('success', { status: 200 });
  } catch (error: any) {
    console.error('[payment][alipay][notify] failed', error);
    const message = typeof error?.message === 'string' ? error.message : 'notify failed';
    return new Response(message, { status: 400 });
  }
}

export async function POST(req: Request) {
  return handleNotify(req, 'POST');
}

export async function GET(req: Request) {
  const query = parseNotifyQuery(req);
  if (query.out_trade_no || query.orderNo)
    return handleNotify(req, 'GET');
  return NextResponse.json({ ok: true, channel: 'ALIPAY', endpoint: '/api/payments/alipay/notify' });
}
