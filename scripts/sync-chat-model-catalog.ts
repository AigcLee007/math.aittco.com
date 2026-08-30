import { prismaDb } from '../src/server/prisma/prismaDb';
import { syncChatModelCatalog } from '../src/server/services/chat-model-catalog.service';

syncChatModelCatalog()
  .then((result) => console.log(`文本模型目录同步完成：新增/更新 ${result.upserted}，停用 ${result.deactivated}`))
  .catch((error) => {
    console.error('文本模型目录同步失败:', error);
    process.exitCode = 1;
  })
  .finally(() => prismaDb.$disconnect());
