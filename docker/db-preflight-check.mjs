import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const strictMode = (process.env.DB_GUARD_STRICT ?? 'true').toLowerCase() === 'true';

function printHeader(message) {
  console.log(`[db-guard] ${message}`);
}

async function main() {
  const [userCount, pricingCount, configCount, packageCount] = await Promise.all([
    prisma.user.count(),
    prisma.modelPricing.count(),
    prisma.systemConfig.count(),
    prisma.rechargePackageConfig.count(),
  ]);

  const summary = {
    users: userCount,
    pricing: pricingCount,
    configs: configCount,
    rechargePackages: packageCount,
  };

  printHeader(`database summary ${JSON.stringify(summary)}`);

  const issues = [];

  if (pricingCount === 0)
    issues.push('模型定价为空，前台模型列表会失效。');

  if (configCount === 0)
    issues.push('系统配置为空，后台开关和站点配置可能异常。');

  if (userCount === 0)
    issues.push('用户表为空，请确认当前是否连接到了错误的数据库卷。');

  if (packageCount === 0)
    issues.push('充值套餐为空，金币中心可能无法正常下单。');

  if (!issues.length) {
    printHeader('preflight passed');
    return;
  }

  for (const issue of issues)
    console.warn(`[db-guard] warning: ${issue}`);

  if (!strictMode) {
    printHeader('strict mode disabled, continuing startup despite warnings');
    return;
  }

  if (pricingCount === 0 || configCount === 0) {
    throw new Error('database preflight failed: 核心配置缺失，已阻止前端在疑似空库状态下启动。');
  }

  printHeader('warnings detected, but startup may continue');
}

main()
  .catch((error) => {
    console.error('[db-guard] fatal:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
