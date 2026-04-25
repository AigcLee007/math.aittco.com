export type PaymentNotifyBody = {
  version?: string;
  appid?: string;
  pid?: string;
  name?: string;
  title?: string;
  money?: number | string;
  total_fee?: number | string;
  trade_order_id?: string;
  orderNo?: string;
  out_trade_no?: string;
  trade_no?: string;
  transaction_id?: string;
  trade_status?: string;
  status?: string;
  type?: string;
  transactionId?: string;
  paidAmountYuan?: number | string;
  total_amount?: number | string;
  notifyToken?: string;
  notify_token?: string;
  hash?: string;
  sign?: string;
  sign_type?: string;
};

export async function parseNotifyBody(req: Request): Promise<PaymentNotifyBody> {
  const contentType = req.headers.get('content-type')?.toLowerCase() || '';

  if (contentType.includes('application/json')) {
    const json = await req.json();
    return (json ?? {}) as PaymentNotifyBody;
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    return Object.fromEntries(form.entries()) as PaymentNotifyBody;
  }

  const text = await req.text();
  if (!text)
    return {};

  try {
    return JSON.parse(text) as PaymentNotifyBody;
  } catch {
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries()) as PaymentNotifyBody;
  }
}

export function parseNotifyQuery(req: Request): PaymentNotifyBody {
  const url = new URL(req.url);
  return Object.fromEntries(url.searchParams.entries()) as PaymentNotifyBody;
}

export function normalizeNotifyPayload(body: PaymentNotifyBody) {
  const orderNo = body.trade_order_id || body.orderNo || body.out_trade_no || '';
  const transactionId = body.trade_no || body.transactionId || body.transaction_id || undefined;
  const notifyToken = body.notifyToken || body.notify_token || undefined;
  const amountRaw = body.money ?? body.paidAmountYuan ?? body.total_amount ?? body.total_fee;
  const amountValue = amountRaw === undefined ? undefined : Number(amountRaw);
  const paidAmountYuan = Number.isFinite(amountValue) ? amountValue : undefined;

  return {
    appId: body.appid || '',
    pid: body.pid || '',
    orderNo,
    tradeStatus: body.trade_status || body.status || '',
    paymentType: body.type || '',
    sign: body.sign || body.hash || '',
    signType: body.sign_type || '',
    transactionId,
    notifyToken,
    paidAmountYuan,
  };
}

export function toSignableParams(body: PaymentNotifyBody): Record<string, string> {
  const params: Record<string, string> = {};
  Object.entries(body).forEach(([key, value]) => {
    if (value === undefined || value === null)
      return;
    const stringValue = typeof value === 'string' ? value : String(value);
    if (!stringValue)
      return;
    params[key] = stringValue;
  });
  return params;
}
