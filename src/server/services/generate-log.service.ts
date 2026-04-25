import { randomUUID } from 'node:crypto';
import { prismaDb } from '~/server/prisma/prismaDb';

type GenerateLogPhase = 'SUBMIT' | 'POLL';
type GenerateLogResult = 'TASK_ID' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'ERROR';

type CreateGenerateLogParams = {
  userId: string;
  endpoint: string;
  phase: GenerateLogPhase;
  model?: string | null;
  prompt?: string | null;
  size?: string | null;
  resolution?: string | null;
  batch?: number | null;
  imagesCount?: number | null;
  taskId?: string | null;
  requestPayload?: any;
};

type FinalizeGenerateLogParams = {
  logId: string;
  statusCode?: number | null;
  result: GenerateLogResult;
  responsePayload?: any;
  errorText?: string | null;
};

type GenerateLogListItem = {
  id: string;
  endpoint: string;
  phase: string;
  model: string | null;
  prompt: string | null;
  size: string | null;
  resolution: string | null;
  batch: number | null;
  imagesCount: number | null;
  taskId: string | null;
  statusCode: number | null;
  result: string | null;
  errorText: string | null;
  requestPayload: any;
  responsePayload: any;
  createdAt: Date;
  updatedAt: Date;
};

let generateLogTableReady = false;

function sanitizeForLog(value: any, depth = 0): any {
  if (value == null)
    return value;

  if (depth > 4)
    return '[MaxDepth]';

  if (typeof value === 'string') {
    if (value.length <= 2000)
      return value;
    return `${value.slice(0, 2000)}... [truncated ${value.length - 2000} chars]`;
  }

  if (typeof value !== 'object')
    return value;

  if (Array.isArray(value)) {
    const clipped = value.slice(0, 20).map(item => sanitizeForLog(item, depth + 1));
    if (value.length > 20)
      clipped.push(`[truncated ${value.length - 20} items]`);
    return clipped;
  }

  const out: Record<string, any> = {};
  const entries = Object.entries(value).slice(0, 40);
  for (const [k, v] of entries)
    out[k] = sanitizeForLog(v, depth + 1);
  if (Object.keys(value).length > 40)
    out.__truncatedKeys = Object.keys(value).length - 40;
  return out;
}

async function ensureGenerateLogTable(): Promise<void> {
  if (generateLogTableReady)
    return;

  await prismaDb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "GenerateRequestLog" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      phase TEXT NOT NULL,
      model TEXT,
      prompt TEXT,
      size TEXT,
      resolution TEXT,
      batch INTEGER,
      "imagesCount" INTEGER,
      "taskId" TEXT,
      "statusCode" INTEGER,
      result TEXT,
      "errorText" TEXT,
      "requestPayload" JSONB,
      "responsePayload" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prismaDb.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "GenerateRequestLog_user_created_idx" ON "GenerateRequestLog"("userId", "createdAt" DESC);');
  await prismaDb.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "GenerateRequestLog_task_idx" ON "GenerateRequestLog"("taskId");');
  generateLogTableReady = true;
}

export async function createGenerateLog(params: CreateGenerateLogParams): Promise<string> {
  await ensureGenerateLogTable();

  const id = randomUUID();
  const requestPayload = sanitizeForLog(params.requestPayload ?? null);
  const normalizedBatch = Number.isFinite(Number(params.batch)) ? Math.max(1, Number(params.batch)) : null;
  const normalizedImagesCount = Number.isFinite(Number(params.imagesCount)) ? Math.max(0, Number(params.imagesCount)) : null;

  await prismaDb.$executeRaw`
    INSERT INTO "GenerateRequestLog" (
      id, "userId", endpoint, phase, model, prompt, size, resolution, batch, "imagesCount", "taskId", "requestPayload"
    ) VALUES (
      ${id}, ${params.userId}, ${params.endpoint}, ${params.phase}, ${params.model ?? null}, ${params.prompt ?? null},
      ${params.size ?? null}, ${params.resolution ?? null}, ${normalizedBatch}, ${normalizedImagesCount},
      ${params.taskId ?? null}, ${requestPayload as any}
    )
  `;

  return id;
}

export async function finalizeGenerateLog(params: FinalizeGenerateLogParams): Promise<void> {
  await ensureGenerateLogTable();

  await prismaDb.$executeRaw`
    UPDATE "GenerateRequestLog"
    SET "statusCode" = ${params.statusCode ?? null},
        result = ${params.result},
        "errorText" = ${params.errorText ?? null},
        "responsePayload" = ${sanitizeForLog(params.responsePayload ?? null) as any},
        "updatedAt" = NOW()
    WHERE id = ${params.logId}
  `;
}

export async function listRecentGenerateLogs(
  userId: string,
  limit = 10,
  endpointPrefix?: string,
): Promise<GenerateLogListItem[]> {
  await ensureGenerateLogTable();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit || 10)));
  const normalizedPrefix = (endpointPrefix || '').trim();

  const rows = normalizedPrefix
    ? await prismaDb.$queryRaw<GenerateLogListItem[]>`
      SELECT
        id, endpoint, phase, model, prompt, size, resolution, batch, "imagesCount", "taskId",
        "statusCode", result, "errorText", "requestPayload", "responsePayload", "createdAt", "updatedAt"
      FROM "GenerateRequestLog"
      WHERE "userId" = ${userId}
        AND endpoint LIKE ${`${normalizedPrefix}%`}
      ORDER BY "createdAt" DESC
      LIMIT ${safeLimit}
    `
    : await prismaDb.$queryRaw<GenerateLogListItem[]>`
      SELECT
        id, endpoint, phase, model, prompt, size, resolution, batch, "imagesCount", "taskId",
        "statusCode", result, "errorText", "requestPayload", "responsePayload", "createdAt", "updatedAt"
      FROM "GenerateRequestLog"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT ${safeLimit}
    `;

  return rows;
}
