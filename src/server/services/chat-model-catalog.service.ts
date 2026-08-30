import { getChatModelCatalogPlan } from '~/common/models/chat-model-catalog';
import { prismaDb } from '~/server/prisma/prismaDb';

export async function syncChatModelCatalog(): Promise<{ upserted: number; deactivated: number }> {
  return prismaDb.$transaction(async (tx) => {
    const currentRows = await tx.modelPricing.findMany({
      select: { modelId: true, modelName: true, category: true, coinCost: true, isActive: true },
    });
    const plan = getChatModelCatalogPlan(currentRows);
    for (const pricing of plan.upserts) {
      await tx.modelPricing.upsert({
        where: { modelId: pricing.modelId },
        update: { modelName: pricing.modelName, category: pricing.category, coinCost: pricing.coinCost, isActive: pricing.isActive },
        create: { modelId: pricing.modelId, modelName: pricing.modelName, category: pricing.category, coinCost: pricing.coinCost, isActive: pricing.isActive },
      });
    }
    const deactivated = plan.deactivateModelIds.length
      ? await tx.modelPricing.updateMany({
        where: { modelId: { in: plan.deactivateModelIds }, category: 'CHAT', isActive: true },
        data: { isActive: false },
      })
      : { count: 0 };
    return { upserted: plan.upserts.length, deactivated: deactivated.count };
  });
}
