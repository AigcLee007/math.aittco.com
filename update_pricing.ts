import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始更新模型定价数据...');

  const modelPricingData = [
    { modelId: 'googleai/gemini-3-flash', modelName: 'Gemini 3 Flash (Prefix)', category: 'CHAT' as any, coinCost: 1 },
    { modelId: 'googleai/gemini-3-pro', modelName: 'Gemini 3 Pro (Prefix)', category: 'CHAT' as any, coinCost: 3 },
    { modelId: 'googleai/gemini-3.1-pro', modelName: 'Gemini 3.1 Pro (Prefix)', category: 'CHAT' as any, coinCost: 4 },
    { modelId: 'googleai/gemini-1.5-flash', modelName: 'Gemini 1.5 Flash', category: 'CHAT' as any, coinCost: 1 },
    { modelId: 'googleai/gemini-1.5-pro', modelName: 'Gemini 1.5 Pro', category: 'CHAT' as any, coinCost: 3 },
    { modelId: 'openai/gpt-4o', modelName: 'GPT-4o', category: 'CHAT' as any, coinCost: 5 },
    { modelId: 'anthropic/claude-3-5-sonnet-20240620', modelName: 'Claude 3.5 Sonnet', category: 'CHAT' as any, coinCost: 5 },
  ];

  for (const pricing of modelPricingData) {
    await prisma.modelPricing.upsert({
      where: { modelId: pricing.modelId },
      update: pricing,
      create: pricing,
    });
    console.log(`已更新/创建: ${pricing.modelId}`);
  }

  console.log('✅ 数据库定价数据更新完成！');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
