import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc.server';
import { createPaymentOrder, getLatestUserOrderStatus, getRechargePackages, getUserOrderStatus, settlePaymentOrderPaid, verifyPaymentNotifyToken } from '../../services/payment.service';
import { PAYMENT_CHANNELS } from '../../services/payment.constants';

const channelEnum = z.enum(PAYMENT_CHANNELS);

export const paymentRouter = createTRPCRouter({

  getRechargePackages: protectedProcedure
    .query(async () => {
      return { items: await getRechargePackages() };
    }),

  createOrder: protectedProcedure
    .input(z.object({
      packageId: z.string().min(1),
      channel: channelEnum,
    }))
    .mutation(async ({ input, ctx }) => {
      return createPaymentOrder({
        userId: ctx.userId,
        packageId: input.packageId,
        channel: input.channel,
      });
    }),

  getOrderStatus: protectedProcedure
    .input(z.object({
      orderNo: z.string().min(1),
    }))
    .query(async ({ input, ctx }) => {
      return getUserOrderStatus(ctx.userId, input.orderNo);
    }),

  getLatestOrder: protectedProcedure
    .query(async ({ ctx }) => {
      return getLatestUserOrderStatus(ctx.userId);
    }),

  notifyPaid: publicProcedure
    .input(z.object({
      orderNo: z.string().min(1),
      transactionId: z.string().optional(),
      paidAmountYuan: z.number().positive().optional(),
      notifyToken: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const headerToken = ctx.headers.get('x-payment-notify-token');
      const bodyToken = input.notifyToken;
      if (!verifyPaymentNotifyToken(headerToken || bodyToken)) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid notify token' });
      }
      return settlePaymentOrderPaid({
        orderNo: input.orderNo,
        transactionId: input.transactionId,
        paidAmountYuan: input.paidAmountYuan,
      });
    }),
});
