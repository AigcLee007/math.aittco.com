import { prismaDb } from '~/server/prisma/prismaDb';

let invitationCodeTableReady = false;

export async function ensureInvitationCodeTable(): Promise<void> {
  if (invitationCodeTableReady)
    return;

  await prismaDb.$executeRawUnsafe(`
    ALTER TABLE "InvitationCode"
    ADD COLUMN IF NOT EXISTS "rewardCoins" INTEGER NOT NULL DEFAULT 0;
  `);

  await prismaDb.$executeRawUnsafe(`
    ALTER TABLE "InvitationCode"
    ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
  `);

  await prismaDb.$executeRawUnsafe(`
    UPDATE "InvitationCode"
    SET "rewardCoins" = 0
    WHERE "rewardCoins" IS NULL;
  `);

  invitationCodeTableReady = true;
}
