import * as z from 'zod/v4';

import { createTRPCRouter, protectedProcedure } from '../trpc.server';
import { prismaDb } from '../../prisma/prismaDb';

const CHAT_SYNC_KEY_PREFIX = 'chat-sync-v1:';
const CHAT_SYNC_MAX_BYTES = 32 * 1024 * 1024; // 32MB safety guard for larger chat histories

function makeChatSyncKey(userId: string): string {
  return `${CHAT_SYNC_KEY_PREFIX}${userId}`;
}

export const chatSyncRouter = createTRPCRouter({

  pull: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.userId;
      const key = makeChatSyncKey(userId);

      const row = await prismaDb.systemConfig.findUnique({
        where: { key },
        select: {
          value: true,
          updatedAt: true,
        },
      });

      return {
        snapshot: row?.value ?? null,
        serverUpdatedAt: row?.updatedAt?.getTime() ?? null,
      };
    }),

  push: protectedProcedure
    .input(z.object({
      snapshot: z.string().min(2).max(CHAT_SYNC_MAX_BYTES),
      clientUpdatedAt: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const key = makeChatSyncKey(userId);

      const updated = await prismaDb.systemConfig.upsert({
        where: { key },
        update: {
          value: input.snapshot,
          group: 'chat-sync',
          description: input.clientUpdatedAt
            ? `chat snapshot from client @${input.clientUpdatedAt}`
            : 'chat snapshot from client',
        },
        create: {
          key,
          value: input.snapshot,
          group: 'chat-sync',
          description: input.clientUpdatedAt
            ? `chat snapshot from client @${input.clientUpdatedAt}`
            : 'chat snapshot from client',
        },
        select: {
          updatedAt: true,
        },
      });

      return {
        ok: true,
        serverUpdatedAt: updated.updatedAt.getTime(),
      };
    }),
});
