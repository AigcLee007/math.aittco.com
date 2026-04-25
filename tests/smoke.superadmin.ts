import fs from 'node:fs';
import path from 'node:path';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { PrismaClient } from '@prisma/client';
import { transformer } from '../src/server/trpc/trpc.transformer';
import type { AppRouterCloud } from '../src/server/trpc/trpc.router-cloud';

const BASE_URL = 'http://localhost:3000/api/cloud';
const ADMIN_IDENTIFIER = 'aigclee@sina.com';
const ADMIN_PASSWORD = 'Hmy050203!';

function readEnvValue(key: string): string {
  const envPath = path.resolve(process.cwd(), '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const line = content.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line)
    return '';
  const raw = line.slice(key.length + 1).trim();
  return raw.replace(/^"(.*)"$/, '$1');
}

const PAYMENT_NOTIFY_TOKEN = readEnvValue('PAYMENT_NOTIFY_TOKEN');
const LOCAL_DB_URL = 'postgresql://mathuser:mathpassword@localhost:5432/mathdb?schema=public';

function createClient(token?: string) {
  return createTRPCProxyClient<AppRouterCloud>({
    links: [
      httpBatchLink({
        url: BASE_URL,
        transformer,
        headers() {
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}

function logStep(message: string) {
  console.log(`\n[STEP] ${message}`);
}

function assert(condition: any, message: string) {
  if (!condition)
    throw new Error(message);
}

async function main() {
  const runId = `smoke_${Date.now()}`;
  const testEmail = `${runId}@example.com`;
  const initPassword = 'Smoke123!a';
  const smokeConfigKey = `SMOKE_CONFIG_${runId}`;
  const smokeInviteCode = `INV_${Date.now()}`;
  const smokeRelayModelId = `smoke-image-${Date.now()}`;
  const smokePricingModelId = `smoke-pricing-${Date.now()}`;
  const smokePackageId = `smoke_pkg_${Date.now()}`;
  const smokeUnlimitedPackageId = `smoke_pkg_unlimited_${Date.now()}`;
  const smokeAnnouncementTitle = `Smoke Announcement ${runId}`;

  if (!PAYMENT_NOTIFY_TOKEN) {
    throw new Error('PAYMENT_NOTIFY_TOKEN is missing in .env, cannot run secure payment notify tests');
  }

  let testUserId = '';
  let createdAnnouncementId = '';
  const cleanupSql: string[] = [];

  const prisma = new PrismaClient({
    datasources: { db: { url: LOCAL_DB_URL } },
  });

  try {
    logStep('Login as super admin');
    const publicClient = createClient();
    const adminLogin = await publicClient.auth.login.mutate({
      identifier: ADMIN_IDENTIFIER,
      password: ADMIN_PASSWORD,
    });
    assert(adminLogin?.user?.role === 'SUPER_ADMIN', 'Admin account is not SUPER_ADMIN');
    const adminClient = createClient(adminLogin.accessToken);

    logStep('Run dashboard and user list checks');
    const stats = await adminClient.admin.getDashboardStats.query();
    assert(typeof stats.totalUsers === 'number', 'Dashboard stats invalid');
    const usersData = await adminClient.admin.getAllUsers.query({ limit: 20, offset: 0 });
    assert(Array.isArray(usersData.users), 'User list invalid');

    logStep('Create a dedicated test user');
    const reg = await publicClient.auth.register.mutate({
      email: testEmail,
      password: initPassword,
      nickname: runId,
      username: runId.slice(0, 18),
      code: '123456',
    });
    testUserId = reg.user.id;
    cleanupSql.push(`DELETE FROM "User" WHERE id='${testUserId}';`);

    const testClient = createClient(reg.accessToken);
    const initBalance = await testClient.coin.getBalance.query();
    assert(typeof initBalance.balance === 'number', 'Initial balance query failed');

    logStep('Permission checks: USER cannot access admin APIs');
    let userDenied = false;
    try {
      await testClient.admin.getDashboardStats.query();
    } catch {
      userDenied = true;
    }
    assert(userDenied, 'USER should not access admin endpoints');

    logStep('Admin user management: notes/status/role/password/balance');
    await adminClient.admin.updateUserAdminFields.mutate({
      userId: testUserId,
      adminNotes: `notes_${runId}`,
      tags: 'smoke,test',
    });

    await adminClient.admin.updateUserStatus.mutate({ userId: testUserId, isActive: false });
    let blocked = false;
    try {
      await publicClient.auth.login.mutate({ identifier: testEmail, password: initPassword });
    } catch {
      blocked = true;
    }
    assert(blocked, 'Disabled user should not be able to login');

    await adminClient.admin.updateUserStatus.mutate({ userId: testUserId, isActive: true });
    await adminClient.admin.updateUserRole.mutate({ userId: testUserId, role: 'ADMIN' });
    await adminClient.admin.updateUserRole.mutate({ userId: testUserId, role: 'USER' });
    await adminClient.admin.resetUserPassword.mutate({ userId: testUserId });
    const loginAfterReset = await publicClient.auth.login.mutate({
      identifier: testEmail,
      password: '123456',
    });
    const testClientAfterReset = createClient(loginAfterReset.accessToken);

    const beforeAdjust = await testClientAfterReset.coin.getBalance.query();
    await adminClient.admin.updateUserBalance.mutate({
      userId: testUserId,
      amount: 20,
      description: 'smoke add',
    });
    await adminClient.admin.updateUserBalance.mutate({
      userId: testUserId,
      amount: -5,
      description: 'smoke deduct',
    });
    const afterAdjust = await testClientAfterReset.coin.getBalance.query();
    assert(afterAdjust.balance === beforeAdjust.balance + 15, 'Balance adjust mismatch');

    logStep('Invitation code flow');
    await adminClient.admin.createInvitationCode.mutate({
      code: smokeInviteCode,
      maxUses: 2,
    });
    const invites = await adminClient.admin.getInvitationCodes.query();
    assert(invites.some((x: any) => x.code === smokeInviteCode), 'Invitation create failed');
    const inviteRow = invites.find((x: any) => x.code === smokeInviteCode);
    if (inviteRow)
      await adminClient.admin.deleteInvitationCode.mutate({ id: inviteRow.id });

    logStep('Announcement flow');
    const announcement = await adminClient.admin.createAnnouncement.mutate({
      title: smokeAnnouncementTitle,
      content: 'smoke test',
      type: 'info',
      isActive: true,
    });
    createdAnnouncementId = announcement.id;
    const announcements = await adminClient.admin.getAnnouncements.query();
    assert(announcements.some((a: any) => a.id === createdAnnouncementId), 'Announcement create failed');
    await adminClient.admin.deleteAnnouncement.mutate({ id: createdAnnouncementId });
    createdAnnouncementId = '';

    logStep('System config flow');
    await adminClient.admin.updateConfig.mutate({
      key: smokeConfigKey,
      value: 'smoke_value',
      description: 'smoke',
    });
    const configs = await adminClient.admin.getConfigs.query();
    assert(configs.some((c: any) => c.key === smokeConfigKey), 'System config update failed');
    cleanupSql.push(`DELETE FROM "SystemConfig" WHERE key='${smokeConfigKey}';`);

    logStep('Pricing flow (image model)');
    await adminClient.admin.updatePricing.mutate({
      modelId: smokePricingModelId,
      modelName: `Smoke Pricing ${runId}`,
      category: 'IMAGE',
      coinCost: 3,
      isActive: true,
    });
    const allPricing = await adminClient.admin.getAllPricing.query();
    assert(allPricing.some((p: any) => p.modelId === smokePricingModelId), 'Pricing upsert failed');
    cleanupSql.push(`DELETE FROM "ModelPricing" WHERE "modelId"='${smokePricingModelId}';`);

    logStep('Relay model config flow');
    const relayConfig = await adminClient.admin.getRelayModelConfig.query();
    const bltcy = relayConfig.channels.bltcy;
    await adminClient.admin.upsertRelayModelConfig.mutate({
      modelId: smokeRelayModelId,
      modelName: `Smoke Relay ${runId}`,
      coinCost: 4,
      isActive: true,
      routeId: 'bltcy',
      transport: 'openai-images',
      upstreamModel: smokeRelayModelId,
      endpointPath: '/v1/images/generations',
      baseUrl: bltcy.baseUrl || 'https://api.bltcy.ai',
      apiKey: bltcy.apiKey || 'smoke-key',
    });
    const relayAfterUpsert = await adminClient.admin.getRelayModelConfig.query();
    assert(!!relayAfterUpsert.routeOverrides[smokeRelayModelId], 'Relay model upsert failed');
    await adminClient.admin.deleteRelayModelConfig.mutate({ modelId: smokeRelayModelId });
    const relayAfterDelete = await adminClient.admin.getRelayModelConfig.query();
    assert(!relayAfterDelete.routeOverrides[smokeRelayModelId], 'Relay model delete failed');

    logStep('Recharge package + payment + notify flow');
    await adminClient.admin.upsertRechargePackageConfig.mutate({
      packageId: smokePackageId,
      label: `Smoke Package ${runId}`,
      amountYuan: 30,
      coinAmount: 900,
      expiresInDays: 30,
      isActive: true,
      popular: false,
      sortOrder: 9999,
    });
    await adminClient.admin.upsertRechargePackageConfig.mutate({
      packageId: smokeUnlimitedPackageId,
      label: `Smoke Unlimited Package ${runId}`,
      amountYuan: 10,
      coinAmount: 300,
      expiresInDays: null,
      isActive: true,
      popular: false,
      sortOrder: 10000,
    });
    cleanupSql.push(`DELETE FROM "RechargePackageConfig" WHERE "packageId"='${smokePackageId}';`);
    cleanupSql.push(`DELETE FROM "RechargePackageConfig" WHERE "packageId"='${smokeUnlimitedPackageId}';`);

    const adminPackages = await adminClient.admin.getRechargePackageConfigs.query();
    assert(adminPackages.some((p: any) => p.id === smokePackageId), 'Package config upsert failed');
    assert(adminPackages.some((p: any) => p.id === smokeUnlimitedPackageId), 'Unlimited package upsert failed');

    const testPackages = await testClientAfterReset.payment.getRechargePackages.query();
    assert(testPackages.items.some((p: any) => p.id === smokePackageId), 'User package list missing smoke package');
    assert(testPackages.items.some((p: any) => p.id === smokeUnlimitedPackageId), 'User package list missing unlimited package');

    const order = await testClientAfterReset.payment.createOrder.mutate({
      packageId: smokePackageId,
      channel: 'ALIPAY',
    });
    assert(order.orderNo, 'Order create failed');

    const pendingStatus = await testClientAfterReset.payment.getOrderStatus.query({ orderNo: order.orderNo });
    assert(pendingStatus.status === 'PENDING', 'Order should be pending before notify');

    logStep('Payment notify token check');
    let notifyDenied = false;
    try {
      await publicClient.payment.notifyPaid.mutate({
        orderNo: order.orderNo,
        paidAmountYuan: 30,
        transactionId: `SMOKE_BAD_TX_${Date.now()}`,
      });
    } catch {
      notifyDenied = true;
    }
    assert(notifyDenied, 'notifyPaid should reject missing/invalid token');

    await publicClient.payment.notifyPaid.mutate({
      orderNo: order.orderNo,
      notifyToken: PAYMENT_NOTIFY_TOKEN,
      paidAmountYuan: 30,
      transactionId: `SMOKE_TX_${Date.now()}`,
    });

    const paidStatus = await testClientAfterReset.payment.getOrderStatus.query({ orderNo: order.orderNo });
    assert(paidStatus.status === 'PAID', 'Order should be PAID after notify');

    const grantsAfterPay = await adminClient.admin.getUserCoinGrants.query({ userId: testUserId });
    const paidGrant = grantsAfterPay.find((g: any) => g.sourceRef === order.orderNo);
    if (!paidGrant) {
      throw new Error('Recharge coin grant not found');
    }
    assert(!!paidGrant.expiresAt, 'Recharge grant should have expiresAt for 30-day package');

    logStep('Unlimited package recharge grant should not expire');
    const unlimitedOrder = await testClientAfterReset.payment.createOrder.mutate({
      packageId: smokeUnlimitedPackageId,
      channel: 'ALIPAY',
    });
    await publicClient.payment.notifyPaid.mutate({
      orderNo: unlimitedOrder.orderNo,
      notifyToken: PAYMENT_NOTIFY_TOKEN,
      paidAmountYuan: 10,
      transactionId: `SMOKE_TX_UNLIMITED_${Date.now()}`,
    });
    const grantsAfterUnlimitedPay = await adminClient.admin.getUserCoinGrants.query({ userId: testUserId });
    const unlimitedGrant = grantsAfterUnlimitedPay.find((g: any) => g.sourceRef === unlimitedOrder.orderNo);
    if (!unlimitedGrant) {
      throw new Error('Unlimited recharge coin grant not found');
    }
    assert(!unlimitedGrant.expiresAt, 'Unlimited package grant should not have expiresAt');

    logStep('Force-expire grant and verify auto-expire on balance query');
    const beforeExpireBalance = await testClientAfterReset.coin.getBalance.query();
    await prisma.coinGrant.updateMany({
      where: { sourceRef: order.orderNo, remainingCoins: { gt: 0 } },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const afterExpireBalance = await testClientAfterReset.coin.getBalance.query();
    assert(afterExpireBalance.balance < beforeExpireBalance.balance, 'Expired grant was not deducted');

    logStep('Admin transaction stats APIs');
    const txList = await adminClient.admin.getAllTransactions.query({ limit: 50, offset: 0, userId: testUserId });
    assert(Array.isArray(txList.items), 'Transaction list failed');
    const statsToday = await adminClient.admin.getTransactionStats.query({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(),
    });
    assert(Array.isArray(statsToday), 'Transaction stats failed');

    logStep('Delete smoke packages via admin API');
    await adminClient.admin.deleteRechargePackageConfig.mutate({ packageId: smokePackageId });
    await adminClient.admin.deleteRechargePackageConfig.mutate({ packageId: smokeUnlimitedPackageId });
    const packagesAfterDelete = await adminClient.admin.getRechargePackageConfigs.query();
    assert(!packagesAfterDelete.some((p: any) => p.id === smokePackageId), 'Package delete failed');
    assert(!packagesAfterDelete.some((p: any) => p.id === smokeUnlimitedPackageId), 'Unlimited package delete failed');

    console.log('\nPASS: Super admin full-flow smoke test PASSED');
  } finally {
    logStep('Cleanup smoke data');
    try {
      if (createdAnnouncementId) {
        await prisma.siteAnnouncement.deleteMany({ where: { id: createdAnnouncementId } });
      }
      for (const sql of cleanupSql) {
        await prisma.$executeRawUnsafe(sql);
      }
      await prisma.modelPricing.deleteMany({ where: { modelId: { startsWith: 'smoke-pricing-' } } });
      await prisma.modelPricing.deleteMany({ where: { modelId: { startsWith: 'smoke-image-' } } });
    } catch (error) {
      console.error('Cleanup warning:', error);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error('\nFAIL: Super admin smoke test FAILED');
  console.error(error);
  process.exit(1);
});
