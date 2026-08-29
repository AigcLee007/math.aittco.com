import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始同步更新模型定价...');

  const modelPricingData = [
    { modelId: 'gemini-3.5-flash-preview', modelName: 'Gemini-3.5-Flash', category: 'CHAT' as any, coinCost: 1, isActive: true },
    { modelId: 'gemini-3.7-flash', modelName: 'Gemini-3.7-Flash', category: 'CHAT' as any, coinCost: 2, isActive: true },
    { modelId: 'gemini-3.1-pro-preview', modelName: 'Gemini-3.1-Pro', category: 'CHAT' as any, coinCost: 3, isActive: true },
    { modelId: 'gpt-5.5', modelName: 'GPT-5.5', category: 'CHAT' as any, coinCost: 4, isActive: true },
    { modelId: 'gpt-5.6-terra', modelName: 'GPT-5.6-Terra', category: 'CHAT' as any, coinCost: 3, isActive: true },
    { modelId: 'gpt-5.6-sol', modelName: 'GPT-5.6-Sol', category: 'CHAT' as any, coinCost: 6, isActive: true },
    { modelId: 'claude-opus-4-8', modelName: 'Claude-Opus-4-8', category: 'CHAT' as any, coinCost: 6, isActive: true },
    { modelId: 'claude-sonnet-5', modelName: 'Claude-Sonnet-5', category: 'CHAT' as any, coinCost: 5, isActive: true },
    { modelId: 'claude-opus-5', modelName: 'Claude-Opus-5', category: 'CHAT' as any, coinCost: 7, isActive: true },
    { modelId: 'grok-4.6', modelName: 'Grok-4.6', category: 'CHAT' as any, coinCost: 3, isActive: true },
  ];

  for (const pricing of modelPricingData) {
    await prisma.modelPricing.upsert({
      where: { modelId: pricing.modelId },
      update: pricing,
      create: pricing,
    });
    console.log(`同步完成: ${pricing.modelId} (${pricing.modelName}) -> ${pricing.coinCost}金币`);
  }

  await prisma.modelPricing.updateMany({
    where: { category: 'CHAT', modelId: { notIn: modelPricingData.map((pricing) => pricing.modelId) } },
    data: { isActive: false },
  });

  console.log('✅ 数据库记录更新完成！');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
