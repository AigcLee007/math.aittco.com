import type { PayChannel } from '@prisma/client';

export type RechargePackage = {
  id: string;
  amountYuan: number;
  coinAmount: number;
  label: string;
  expiresInDays?: number | null;
  sortOrder?: number;
  popular?: boolean;
  isActive?: boolean;
};

export const RECHARGE_PACKAGES: RechargePackage[] = [
  { id: 'starter_1', amountYuan: 1, coinAmount: 30, label: 'Starter Pack', expiresInDays: null, sortOrder: 1, isActive: true },
  { id: 'basic_10', amountYuan: 10, coinAmount: 300, label: 'Basic Pack', popular: true, expiresInDays: null, sortOrder: 2, isActive: true },
  { id: 'hot_30', amountYuan: 30, coinAmount: 900, label: 'Hot Pack', expiresInDays: null, sortOrder: 3, isActive: true },
  { id: 'plus_50', amountYuan: 50, coinAmount: 1600, label: 'Plus Pack', expiresInDays: null, sortOrder: 4, isActive: true },
  { id: 'pro_100', amountYuan: 100, coinAmount: 3500, label: 'Pro Pack', expiresInDays: null, sortOrder: 5, isActive: true },
  { id: 'ultra_200', amountYuan: 200, coinAmount: 7500, label: 'Ultra Pack', expiresInDays: null, sortOrder: 6, isActive: true },
];

export const PAYMENT_CHANNELS: PayChannel[] = ['ALIPAY', 'WECHAT'];
