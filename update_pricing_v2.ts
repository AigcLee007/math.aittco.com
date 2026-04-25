import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始同步更新模型定价...');

  const modelPricingData = [
    { modelId: 'gemini-3-flash-preview', modelName: 'Gemini-3-Flash', category: 'CHAT' as any, coinCost: 1 },
    { modelId: 'googleai/gemini-3-flash-preview', modelName: 'Gemini-3-Flash', category: 'CHAT' as any, coinCost: 1 },
    
    { modelId: 'gemini-3-pro-preview', modelName: 'Gemini-3-Pro', category: 'CHAT' as any, coinCost: 3 },
    { modelId: 'googleai/gemini-3-pro-preview', modelName: 'Gemini-3-Pro', category: 'CHAT' as any, coinCost: 3 },
    
    { modelId: 'gemini-3.1-pro-preview', modelName: 'Gemini-3.1-Pro', category: 'CHAT' as any, coinCost: 4 },
    { modelId: 'googleai/gemini-3.1-pro-preview', modelName: 'Gemini-3.1-Pro', category: 'CHAT' as any, coinCost: 4 },
    
    { modelId: 'claude-opus-4-6', modelName: 'Claude-Opus-4-6', category: 'CHAT' as any, coinCost: 6 },
    { modelId: 'anthropic/claude-opus-4-6', modelName: 'Claude-Opus-4-6', category: 'CHAT' as any, coinCost: 6 },
  ];

  for (const pricing of modelPricingData) {
    await prisma.modelPricing.upsert({
      where: { modelId: pricing.modelId },
      update: pricing,
      create: pricing,
    });
    console.log(`同步完成: ${pricing.modelId} (${pricing.modelName}) -> ${pricing.coinCost}金币`);
  }

  console.log('✅ 数据库记录更新完成！');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
