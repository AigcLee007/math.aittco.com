import { prismaDb } from '../prisma/prismaDb';
import { ModelCategory } from '@prisma/client';

const MODEL_PRICE_ALIAS_IDS: Record<string, string[]> = {
  'nano-banana-2': ['gemini-3-pro-image-preview'],
};

/**
 * Pricing Service: Handles model price configuration and lookups
 */

/**
 * 获取指定模型的金币单价
 */
export async function getModelPrice(modelId: string): Promise<number> {
  const normalizedId = modelId.toLowerCase();
  const lookupIds = [normalizedId, ...(MODEL_PRICE_ALIAS_IDS[normalizedId] || [])];
  console.log(`\n[计费拦截] 正在查询模型价格, 接收到的 modelId: ${modelId}`);

  // 1. 全局统计：从数据库获取所有定价
  const allPricing = await prismaDb.modelPricing.findMany({
    where: { isActive: true }
  });

  // 1.1 精确匹配
  let pricing = allPricing.find(p => lookupIds.includes(p.modelId.toLowerCase()));

  // 1.2 模糊匹配 (如果数据库中的 modelId 是输入 modelId 的后缀，或者输入是数据库的后缀)
  if (!pricing) {
    pricing = allPricing.find(p => {
      const dbId = p.modelId.toLowerCase();
      return lookupIds.some((id) => id.endsWith(dbId) || dbId.endsWith(id));
    });
  }

  if (pricing) {
    console.log(`[计费成功] 找到匹配定价: 数据库ID=${pricing.modelId}, 输入ID=${modelId}, 价格=${pricing.coinCost}`);
    return pricing.coinCost;
  }

  console.log(`[计费警告] 数据库中未找到任何匹配定价，放行免费 (0币): ${modelId}`);
  return 0; 
}

/**
 * 获取所有模型的定价列表
 */
export async function getAllPricing() {
  return await prismaDb.modelPricing.findMany({
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * 更新或创建模型定价
 */
export async function upsertPricing(data: {
  modelId: string;
  modelName: string;
  category: ModelCategory;
  coinCost: number;
  isActive?: boolean;
}) {
  return await prismaDb.modelPricing.upsert({
    where: { modelId: data.modelId },
    update: {
      modelName: data.modelName,
      category: data.category,
      coinCost: data.coinCost,
      isActive: data.isActive ?? true,
    },
    create: {
      modelId: data.modelId,
      modelName: data.modelName,
      category: data.category,
      coinCost: data.coinCost,
      isActive: data.isActive ?? true,
    },
  });
}
