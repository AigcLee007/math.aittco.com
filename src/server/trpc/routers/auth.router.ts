import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc.server';
import { prismaDb } from '../../prisma/prismaDb';
import { hashPassword, verifyPassword } from '../../auth/password';
import { signAccessToken, signRefreshToken } from '../../auth/jwt';
import { sendVerificationCode } from '../../auth/resend';
import { nanoid } from 'nanoid';
import { ensureInvitationCodeTable } from '../../services/invitation.service';
import {
  getReferralRuntimeConfig,
  grantShareSignupRewardInTx,
  resolveReferralUserByCode,
} from '../../services/referral.service';

export const authRouter = createTRPCRouter({
  me: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await prismaDb.user.findUnique({
        where: { id: ctx.userId },
        select: {
          id: true,
          shortId: true,
          email: true,
          nickname: true,
          avatar: true,
          role: true,
          coinBalance: true,
        },
      });

      if (!user)
        throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });

      return user;
    }),

  previewInvitationCode: publicProcedure
    .input(z.object({
      code: z.string().min(1),
    }))
    .query(async ({ input }) => {
      await ensureInvitationCodeTable();
      const normalizedCode = input.code.trim().toUpperCase();
      if (!normalizedCode)
        return { valid: false as const, reason: 'empty' as const };

      const invite = await (prismaDb.invitationCode.findUnique({
        where: { code: normalizedCode },
      }) as Promise<any>);

      if (!invite) {
        return {
          valid: false as const,
          reason: 'not_found' as const,
        };
      }

      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return {
          valid: false as const,
          reason: 'expired' as const,
          code: invite.code,
          rewardCoins: invite.rewardCoins ?? 0,
          expiresAt: invite.expiresAt,
        };
      }

      if (invite.usedCount >= invite.maxUses) {
        return {
          valid: false as const,
          reason: 'limit_reached' as const,
          code: invite.code,
          rewardCoins: invite.rewardCoins ?? 0,
          expiresAt: invite.expiresAt,
          remainingUses: 0,
        };
      }

      return {
        valid: true as const,
        code: invite.code,
        rewardCoins: invite.rewardCoins ?? 0,
        expiresAt: invite.expiresAt,
        remainingUses: invite.maxUses === 999999 ? null : Math.max(0, invite.maxUses - invite.usedCount),
      };
    }),

  previewReferralShare: publicProcedure
    .input(z.object({
      ref: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const referrer = await resolveReferralUserByCode(input.ref);
      const referralConfig = await getReferralRuntimeConfig();
      if (!referrer) {
        return {
          valid: false as const,
          reason: 'not_found' as const,
        };
      }

      return {
        valid: true as const,
        referrerNickname: referrer.nickname,
        referrerShortId: referrer.shortId,
        signupRewardCoins: referralConfig.signupRewardCoins,
      };
    }),

  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      nickname: z.string().min(2),
      username: z.string().min(3).optional(),
      invitationCode: z.string().optional(),
      shareRef: z.string().optional(),
      code: z.string().length(6),
    }))
    .mutation(async ({ input }) => {
      const { email, password, nickname, username, invitationCode, shareRef, code } = input;
      await ensureInvitationCodeTable();
      const referralConfig = await getReferralRuntimeConfig();

      let invite = null as any;
      let shareReferrer = null as Awaited<ReturnType<typeof resolveReferralUserByCode>>;
      if (invitationCode) {
        invite = await prismaDb.invitationCode.findUnique({
          where: { code: invitationCode },
        });
        if (!invite)
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀请码无效' });
        if (invite.expiresAt && invite.expiresAt < new Date())
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀请码已过期' });
        if (invite.usedCount >= invite.maxUses)
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀请码使用次数已达上限' });
      }

      if (shareRef) {
        shareReferrer = await resolveReferralUserByCode(shareRef);
        if (!shareReferrer)
          throw new TRPCError({ code: 'BAD_REQUEST', message: '分享链接无效或已失效' });
      }

      const inviteRewardCoins = invite?.rewardCoins && invite.rewardCoins > 0 ? invite.rewardCoins : 0;
      const shareRewardCoins = shareReferrer ? referralConfig.signupRewardCoins : 0;
      const initialCoins = 1 + inviteRewardCoins + shareRewardCoins;

      const existingUser = await prismaDb.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '该邮箱已注册',
        });
      }

      const passwordHash = await hashPassword(password);
      const lastUser = await prismaDb.user.findFirst({
        orderBy: { shortId: 'desc' },
        where: { NOT: { shortId: null } },
      });
      const nextShortId = lastUser?.shortId ? lastUser.shortId + 1 : 10001;
      const finalUsername = username || email.split('@')[0];

      const verificationCode = await prismaDb.verificationCode.findFirst({
        where: { email, code },
      });

      if (!verificationCode || verificationCode.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '验证码无效或已过期',
        });
      }

      const newUser = await prismaDb.$transaction(async (tx) => {
        const existingSuperAdmin = await tx.user.findFirst({
          where: { role: 'SUPER_ADMIN' },
          select: { id: true },
        });
        const assignedRole = existingSuperAdmin ? 'USER' : 'SUPER_ADMIN';

        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            nickname,
            username: finalUsername,
            shortId: nextShortId,
            role: assignedRole,
            coinBalance: initialCoins,
            inviterId: shareReferrer?.id || invite?.createdBy || null,
            emailVerified: new Date(),
          },
        });

        if (invite) {
          await tx.invitationCode.update({
            where: { id: invite.id },
            data: { usedCount: { increment: 1 } },
          });
        }

        await tx.coinTransaction.create({
          data: {
            userId: user.id,
            type: 'GIFT',
            amount: 1,
            balance: 1,
            description: '新用户注册赠送',
          },
        });

        await tx.coinGrant.create({
          data: {
            userId: user.id,
            sourceType: 'GIFT',
            totalCoins: 1,
            remainingCoins: 1,
          },
        });

        if (inviteRewardCoins > 0) {
          await tx.coinTransaction.create({
            data: {
              userId: user.id,
              type: 'GIFT',
              amount: inviteRewardCoins,
              balance: initialCoins,
              description: `邀请码注册奖励 ${inviteRewardCoins} 金币`,
            },
          });

          await tx.coinGrant.create({
            data: {
              userId: user.id,
              sourceType: 'GIFT',
              totalCoins: inviteRewardCoins,
              remainingCoins: inviteRewardCoins,
            },
          });
        }

        if (shareRewardCoins > 0 && shareReferrer) {
          await tx.coinTransaction.create({
            data: {
              userId: user.id,
              type: 'GIFT',
              amount: shareRewardCoins,
              balance: initialCoins,
              description: `分享链接注册奖励 ${shareRewardCoins} 金币`,
            },
          });

          await tx.coinGrant.create({
            data: {
              userId: user.id,
              sourceType: 'GIFT',
              totalCoins: shareRewardCoins,
              remainingCoins: shareRewardCoins,
            },
          });

          await grantShareSignupRewardInTx(tx, {
            referrerUserId: shareReferrer.id,
            referredUserId: user.id,
          });
        }

        return user;
      });

      await prismaDb.verificationCode.deleteMany({ where: { email } });

      const accessToken = signAccessToken({ userId: newUser.id, role: newUser.role });
      const refreshToken = signRefreshToken({ userId: newUser.id });

      await prismaDb.refreshToken.create({
        data: {
          userId: newUser.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        user: {
          id: newUser.id,
          shortId: newUser.shortId,
          email: newUser.email,
          nickname: newUser.nickname,
          avatar: newUser.avatar,
          role: newUser.role,
          coinBalance: newUser.coinBalance,
        },
        accessToken,
        refreshToken,
      };
    }),

  login: publicProcedure
    .input(z.object({
      identifier: z.string(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { identifier, password } = input;
      const user = await prismaDb.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { username: identifier },
          ],
        },
      });

      if (!user)
        throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });

      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid)
        throw new TRPCError({ code: 'UNAUTHORIZED', message: '密码错误' });

      if (!user.emailVerified) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '请先完成邮箱验证。如未收到邮件，请尝试重新发送验证邮件。',
        });
      }

      if (!user.isActive)
        throw new TRPCError({ code: 'FORBIDDEN', message: '账号已被禁用' });

      const ip = (ctx as any).headers?.get('x-forwarded-for')?.split(',')[0]
        || (ctx as any).headers?.get('cf-connecting-ip')
        || 'unknown';

      await prismaDb.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIP: ip,
        },
      });

      const accessToken = signAccessToken({ userId: user.id, role: user.role });
      const refreshToken = signRefreshToken({ userId: user.id });

      await prismaDb.refreshToken.upsert({
        where: { token: refreshToken },
        update: {
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        create: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        user: {
          id: user.id,
          shortId: user.shortId,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
          role: user.role,
          coinBalance: user.coinBalance,
        },
        accessToken,
        refreshToken,
      };
    }),

  refresh: publicProcedure
    .input(z.object({
      refreshToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { refreshToken } = input;
      const storedToken = await prismaDb.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        if (storedToken) {
          await prismaDb.refreshToken.delete({ where: { id: storedToken.id } });
        }
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: '凭证已过期，请重新登录',
        });
      }

      if (!storedToken.user.isActive) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '账号已被禁用',
        });
      }

      const accessToken = signAccessToken({
        userId: storedToken.user.id,
        role: storedToken.user.role,
      });
      return { accessToken };
    }),

  logout: publicProcedure
    .input(z.object({
      refreshToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        await prismaDb.refreshToken.delete({
          where: { token: input.refreshToken },
        });
      } catch {
        // keep idempotent
      }
      return { success: true };
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      userId: z.string(),
      nickname: z.string().min(2).optional(),
      avatar: z.union([
        z.literal(''),
        z.string().regex(/^\/avatars\/builtin\/[^?#]+$/),
      ]).optional(),
      currentPassword: z.string().min(1).optional(),
      newPassword: z.string().min(6).optional(),
      code: z.string().length(6).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { userId, nickname, avatar, currentPassword, newPassword, code } = input;
      if (ctx.userId !== userId)
        throw new TRPCError({ code: 'FORBIDDEN', message: '无权修改该用户资料' });

      const currentUser = await prismaDb.user.findUnique({
        where: { id: userId },
        select: { id: true, shortId: true, passwordHash: true },
      });
      if (!currentUser)
        throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });

      if (newPassword) {
        if (!code)
          throw new TRPCError({ code: 'BAD_REQUEST', message: '修改密码需要输入验证码' });

        const userWithEmail = await prismaDb.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });

        if (!userWithEmail) throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });

        const verificationRecord = await prismaDb.verificationCode.findFirst({
          where: { email: userWithEmail.email, code },
        });

        if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '验证码无效或已过期',
          });
        }

        if (!currentPassword)
          throw new TRPCError({ code: 'BAD_REQUEST', message: '请输入旧密码' });

        const isPasswordValid = await verifyPassword(currentPassword, currentUser.passwordHash);
        if (!isPasswordValid)
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '旧密码错误' });
      }

      const updateData: any = {
        ...(nickname ? { nickname } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      };
      if (newPassword)
        updateData.passwordHash = await hashPassword(newPassword);

      const updatedUser = await prismaDb.user.update({
        where: { id: userId },
        data: updateData,
      });

      return {
        id: updatedUser.id,
        shortId: currentUser.shortId,
        nickname: updatedUser.nickname,
        avatar: updatedUser.avatar,
      };
    }),

  sendPasswordResetCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const { email } = input;
      const user = await prismaDb.user.findUnique({ where: { email } });
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '该邮箱未注册',
        });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await prismaDb.verificationCode.deleteMany({ where: { email } });
      await prismaDb.verificationCode.create({
        data: {
          email,
          code,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const sendResult = await sendVerificationCode(email, code);
      if (!sendResult.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '验证码邮件发送失败，请稍后重试',
        });
      }
      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
      code: z.string().length(6),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const { email, code, newPassword } = input;
      const verificationRecord = await prismaDb.verificationCode.findFirst({
        where: { email, code },
      });

      if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '验证码无效或已过期',
        });
      }

      const passwordHash = await hashPassword(newPassword);
      await prismaDb.$transaction([
        prismaDb.user.update({
          where: { email },
          data: { passwordHash },
        }),
        prismaDb.verificationCode.deleteMany({ where: { email } }),
        prismaDb.refreshToken.deleteMany({ where: { user: { email } } }),
      ]);

      return { success: true };
    }),

  sendChangePasswordCode: protectedProcedure
    .mutation(async ({ ctx }) => {
      const user = await prismaDb.user.findUnique({
        where: { id: ctx.userId },
        select: { email: true },
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await prismaDb.verificationCode.deleteMany({ where: { email: user.email } });
      await prismaDb.verificationCode.create({
        data: {
          email: user.email,
          code,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const sendResult = await sendVerificationCode(user.email, code);
      if (!sendResult.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '验证码邮件发送失败，请稍后重试',
        });
      }
      return { success: true };
    }),

  sendRegisterCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const { email } = input;

      const existingUser = await prismaDb.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '该邮箱已注册',
        });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();

      await prismaDb.verificationCode.deleteMany({ where: { email } });
      await prismaDb.verificationCode.create({
        data: {
          email,
          code,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      const sendResult = await sendVerificationCode(email, code);
      if (!sendResult.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: '验证码邮件发送失败，请稍后重试',
        });
      }

      return { success: true };
    }),

  verifyEmail: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { token } = input;
      
      const verificationRecord = await prismaDb.verificationCode.findFirst({
        where: { code: token },
      });

      if (!verificationRecord || verificationRecord.expiresAt < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '验证链接无效或已过期',
        });
      }

      await prismaDb.$transaction([
        prismaDb.user.update({
          where: { email: verificationRecord.email },
          data: { emailVerified: new Date() },
        }),
        prismaDb.verificationCode.deleteMany({
          where: { email: verificationRecord.email },
        }),
      ]);

      return { success: true };
    }),
});
