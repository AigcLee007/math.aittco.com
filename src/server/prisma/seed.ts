import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据库种子数据...');

  const chatModelPricingData = [
    { modelId: 'gemini-3.5-flash-preview', modelName: 'Gemini-3.5-Flash', category: 'CHAT' as const, coinCost: 1 },
    { modelId: 'gemini-3.7-flash', modelName: 'Gemini-3.7-Flash', category: 'CHAT' as const, coinCost: 2 },
    { modelId: 'gemini-3.1-pro-preview', modelName: 'Gemini-3.1-Pro', category: 'CHAT' as const, coinCost: 3 },
    { modelId: 'gpt-5.5', modelName: 'GPT-5.5', category: 'CHAT' as const, coinCost: 4 },
    { modelId: 'gpt-5.6-terra', modelName: 'GPT-5.6-Terra', category: 'CHAT' as const, coinCost: 3 },
    { modelId: 'gpt-5.6-sol', modelName: 'GPT-5.6-Sol', category: 'CHAT' as const, coinCost: 6 },
    { modelId: 'claude-opus-4-8', modelName: 'Claude-Opus-4-8', category: 'CHAT' as const, coinCost: 6 },
    { modelId: 'claude-sonnet-5', modelName: 'Claude-Sonnet-5', category: 'CHAT' as const, coinCost: 5 },
    { modelId: 'claude-opus-5', modelName: 'Claude-Opus-5', category: 'CHAT' as const, coinCost: 7 },
    { modelId: 'grok-4.6', modelName: 'Grok-4.6', category: 'CHAT' as const, coinCost: 3 },
  ];

  const nonChatModelPricingData = [
    { modelId: 'gemini-3-pro-image-preview', modelName: 'Nano Banana Pro（线路一）', category: 'IMAGE' as const, coinCost: 12 },
    { modelId: 'nano-banana-2', modelName: 'Nano Banana Pro（线路二）', category: 'IMAGE' as const, coinCost: 12 },
    { modelId: 'gemini-3.1-flash-image-preview', modelName: 'Nano Banana 2', category: 'IMAGE' as const, coinCost: 6 },
    { modelId: 'gemini-2.5-flash-image', modelName: 'Nano Banana', category: 'IMAGE' as const, coinCost: 3 },
    { modelId: 'grok-4.2-image', modelName: 'Grok-4.2-Image', category: 'IMAGE' as const, coinCost: 8 },

    { modelId: 'nano-banana-2-vip', modelName: 'Nano Banana Pro(vip)', category: 'IMAGE' as const, coinCost: 25 },
    { modelId: 'nano-banana-2-vip-2k', modelName: 'Nano Banana Pro(vip) 2K', category: 'IMAGE' as const, coinCost: 26 },
    { modelId: 'nano-banana-2-vip-4k', modelName: 'Nano Banana Pro(vip) 4K', category: 'IMAGE' as const, coinCost: 34 },
    { modelId: 'gemini-3.1-flash-image-preview-vip', modelName: 'Nano Banana 2(vip)', category: 'IMAGE' as const, coinCost: 9 },
    { modelId: 'gemini-3.1-flash-image-preview-vip-2k', modelName: 'Nano Banana 2(vip) 2K', category: 'IMAGE' as const, coinCost: 10 },
    { modelId: 'gemini-3.1-flash-image-preview-vip-4k', modelName: 'Nano Banana 2(vip) 4K', category: 'IMAGE' as const, coinCost: 12 },
  ];

  const modelPricingData = [...chatModelPricingData, ...nonChatModelPricingData];

  const existingModelPricingCount = await (prisma as any).modelPricing.count().catch(() => 0);
  if (existingModelPricingCount === 0) {
    for (const pricing of modelPricingData) {
      await (prisma as any).modelPricing.upsert({
        where: { modelId: pricing.modelId },
        update: pricing,
        create: pricing,
      });
    }
    console.log('模型定价数据初始化完成');
  } else {
    // Keep image/video settings untouched while making the active chat catalog
    // deterministic across deployments. Historical chat rows stay available
    // for billing records but no longer appear in the user dropdown.
    for (const pricing of chatModelPricingData) {
      await (prisma as any).modelPricing.upsert({
        where: { modelId: pricing.modelId },
        update: { modelName: pricing.modelName, category: pricing.category, coinCost: pricing.coinCost, isActive: true },
        create: { ...pricing, isActive: true },
      });
    }
    await (prisma as any).modelPricing.updateMany({
      where: {
        category: 'CHAT',
        modelId: { notIn: chatModelPricingData.map((pricing) => pricing.modelId) },
      },
      data: { isActive: false },
    });
    console.log(`检测到已有 ${existingModelPricingCount} 条模型定价配置，已同步最新文本模型并停用旧模型`);
  }

  await (prisma as any).systemConfig.upsert({
    where: { key: 'ENABLE_VIP_IMAGE_MODELS' },
    update: {},
    create: {
      key: 'ENABLE_VIP_IMAGE_MODELS',
      value: 'false',
      group: 'general',
      description: '控制前台是否显示 VIP 应急生图模型',
    },
  });

  const adminEmail = 'admin@banana.com';
  const existingAdmin = await (prisma as any).user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123456', 10);
    await (prisma as any).user.create({
      data: {
        email: adminEmail,
        passwordHash,
        nickname: '管理员',
        role: 'ADMIN',
        coinBalance: 99999,
      },
    });
    console.log('默认管理员账号已创建 (admin@banana.com / admin123456)');
  } else {
    console.log('管理员账号已存在，跳过创建');
  }

  console.log('数据库种子数据初始化全部完成');
}

main()
  .catch((e) => {
    console.error('种子脚本执行出错:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
