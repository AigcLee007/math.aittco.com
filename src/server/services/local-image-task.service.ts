import { randomUUID } from 'node:crypto';
import { prismaDb } from '~/server/prisma/prismaDb';

export type LocalImageTaskStatus = 'processing' | 'succeeded' | 'failed';

type LocalImageTaskRow = {
  id: string;
  userId: string;
  routeId: string;
  modelId: string | null;
  pricingModelId: string | null;
  upstreamTaskId: string | null;
  status: string;
  progress: number;
  errorText: string | null;
  requestPayload: any;
  responsePayload: any;
  createdAt: Date;
  updatedAt: Date;
};

type CreateLocalImageTaskParams = {
  id?: string;
  userId: string;
  routeId: string;
  modelId?: string | null;
  pricingModelId?: string | null;
  requestPayload?: any;
};

let localImageTaskTableReady = false;

function sanitizeForTask(value: any, depth = 0): any {
  if (value == null)
    return value;

  if (depth > 5)
    return '[MaxDepth]';

  if (typeof value === 'string') {
    if (value.length <= 4000)
      return value;
    return `${value.slice(0, 4000)}... [truncated ${value.length - 4000} chars]`;
  }

  if (typeof value !== 'object')
    return value;

  if (Array.isArray(value)) {
    const clipped = value.slice(0, 50).map(item => sanitizeForTask(item, depth + 1));
    if (value.length > 50)
      clipped.push(`[truncated ${value.length - 50} items]`);
    return clipped;
  }

  const out: Record<string, any> = {};
  const entries = Object.entries(value).slice(0, 80);
  for (const [k, v] of entries)
    out[k] = sanitizeForTask(v, depth + 1);
  if (Object.keys(value).length > 80)
    out.__truncatedKeys = Object.keys(value).length - 80;
  return out;
}

async function ensureLocalImageTaskTable(): Promise<void> {
  if (localImageTaskTableReady)
    return;

  await prismaDb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LocalImageTask" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "routeId" TEXT NOT NULL,
      "modelId" TEXT,
      "pricingModelId" TEXT,
      "upstreamTaskId" TEXT,
      status TEXT NOT NULL CHECK (status IN ('processing','succeeded','failed')),
      progress INTEGER NOT NULL DEFAULT 0,
      "errorText" TEXT,
      "requestPayload" JSONB,
      "responsePayload" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prismaDb.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LocalImageTask_user_created_idx" ON "LocalImageTask"("userId", "createdAt" DESC);');
  await prismaDb.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LocalImageTask_status_updated_idx" ON "LocalImageTask"(status, "updatedAt" DESC);');
  await prismaDb.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LocalImageTask_upstream_idx" ON "LocalImageTask"("upstreamTaskId");');

  localImageTaskTableReady = true;
}

function extractTaskUrl(payload: any): string | null {
  if (!payload || typeof payload !== 'object')
    return null;

  const direct = payload.url || payload.image_url || payload.imageUrl || payload.image;
  if (typeof direct === 'string' && direct)
    return direct;

  if (Array.isArray(payload.images) && typeof payload.images[0] === 'string' && payload.images[0])
    return payload.images[0];

  if (Array.isArray(payload.results) && typeof payload.results[0]?.url === 'string' && payload.results[0].url)
    return payload.results[0].url;

  return null;
}

function extractTaskImages(payload: any): string[] {
  if (!payload || typeof payload !== 'object')
    return [];

  const results = Array.isArray(payload.results)
    ? payload.results
      .map((item: any) => typeof item?.url === 'string' ? item.url : null)
      .filter(Boolean)
    : [];

  const images = Array.isArray(payload.images)
    ? payload.images.filter((item: any) => typeof item === 'string' && item)
    : [];

  const merged = [...results, ...images];
  const deduped = new Set<string>();
  return merged.filter((item) => {
    if (deduped.has(item))
      return false;
    deduped.add(item);
    return true;
  });
}

function normalizeTaskStatus(status: string): LocalImageTaskStatus {
  if (status === 'succeeded' || status === 'failed')
    return status;
  return 'processing';
}

export function createLocalImageTaskId(routeId = 'visionary'): string {
  return `localtask:${routeId}:${randomUUID()}`;
}

export async function createLocalImageTask(params: CreateLocalImageTaskParams): Promise<string> {
  await ensureLocalImageTaskTable();

  const id = params.id || createLocalImageTaskId(params.routeId);
  await prismaDb.$executeRaw`
    INSERT INTO "LocalImageTask" (
      id, "userId", "routeId", "modelId", "pricingModelId", status, progress, "requestPayload"
    ) VALUES (
      ${id},
      ${params.userId},
      ${params.routeId},
      ${params.modelId ?? null},
      ${params.pricingModelId ?? null},
      'processing',
      0,
      ${sanitizeForTask(params.requestPayload ?? null) as any}
    )
  `;

  return id;
}

export async function getLocalImageTask(taskId: string): Promise<LocalImageTaskRow | null> {
  await ensureLocalImageTaskTable();
  const rows = await prismaDb.$queryRaw<LocalImageTaskRow[]>`
    SELECT
      id, "userId", "routeId", "modelId", "pricingModelId", "upstreamTaskId",
      status, progress, "errorText", "requestPayload", "responsePayload", "createdAt", "updatedAt"
    FROM "LocalImageTask"
    WHERE id = ${taskId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listPendingLocalImageTasks(limit = 100, routeId?: string): Promise<LocalImageTaskRow[]> {
  await ensureLocalImageTaskTable();
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit || 100)));
  const rows = routeId
    ? await prismaDb.$queryRaw<LocalImageTaskRow[]>`
      SELECT
        id, "userId", "routeId", "modelId", "pricingModelId", "upstreamTaskId",
        status, progress, "errorText", "requestPayload", "responsePayload", "createdAt", "updatedAt"
      FROM "LocalImageTask"
      WHERE status = 'processing'
        AND "routeId" = ${routeId}
      ORDER BY "updatedAt" ASC
      LIMIT ${safeLimit}
    `
    : await prismaDb.$queryRaw<LocalImageTaskRow[]>`
      SELECT
        id, "userId", "routeId", "modelId", "pricingModelId", "upstreamTaskId",
        status, progress, "errorText", "requestPayload", "responsePayload", "createdAt", "updatedAt"
      FROM "LocalImageTask"
      WHERE status = 'processing'
      ORDER BY "updatedAt" ASC
      LIMIT ${safeLimit}
    `;
  return rows;
}

export async function bindLocalImageTaskUpstreamId(taskId: string, upstreamTaskId: string, responsePayload?: any): Promise<void> {
  await ensureLocalImageTaskTable();
  await prismaDb.$executeRaw`
    UPDATE "LocalImageTask"
    SET "upstreamTaskId" = ${upstreamTaskId},
        "responsePayload" = COALESCE(${sanitizeForTask(responsePayload ?? null) as any}, "responsePayload"),
        "updatedAt" = NOW()
    WHERE id = ${taskId}
  `;
}

export async function markLocalImageTaskProcessing(taskId: string, progress: number, responsePayload?: any): Promise<void> {
  await ensureLocalImageTaskTable();
  const safeProgress = Math.max(0, Math.min(99, Math.round(progress || 0)));
  await prismaDb.$executeRaw`
    UPDATE "LocalImageTask"
    SET status = 'processing',
        progress = ${safeProgress},
        "responsePayload" = COALESCE(${sanitizeForTask(responsePayload ?? null) as any}, "responsePayload"),
        "updatedAt" = NOW()
    WHERE id = ${taskId}
  `;
}

export async function markLocalImageTaskSucceeded(taskId: string, responsePayload: any): Promise<void> {
  await ensureLocalImageTaskTable();
  await prismaDb.$executeRaw`
    UPDATE "LocalImageTask"
    SET status = 'succeeded',
        progress = 100,
        "errorText" = NULL,
        "responsePayload" = ${sanitizeForTask(responsePayload ?? null) as any},
        "updatedAt" = NOW()
    WHERE id = ${taskId}
  `;
}

export async function markLocalImageTaskFailed(taskId: string, errorText: string, responsePayload?: any): Promise<void> {
  await ensureLocalImageTaskTable();
  await prismaDb.$executeRaw`
    UPDATE "LocalImageTask"
    SET status = 'failed',
        progress = 100,
        "errorText" = ${String(errorText || '任务失败')},
        "responsePayload" = COALESCE(${sanitizeForTask(responsePayload ?? null) as any}, "responsePayload"),
        "updatedAt" = NOW()
    WHERE id = ${taskId}
  `;
}

export function toPublicLocalImageTask(task: LocalImageTaskRow) {
  const responsePayload = task.responsePayload && typeof task.responsePayload === 'object'
    ? task.responsePayload
    : {};
  const status = normalizeTaskStatus(task.status);
  const progress = status === 'succeeded'
    ? 100
    : Math.max(0, Math.min(99, Number(responsePayload?.progress ?? task.progress ?? 0) || 0));
  const url = extractTaskUrl(responsePayload);
  const images = extractTaskImages(responsePayload);
  const results = Array.isArray(responsePayload?.results)
    ? responsePayload.results
    : url
      ? [{ url, content: responsePayload?.content || '' }]
      : [];
  const failureReason = task.errorText
    || responsePayload?.error
    || responsePayload?.failure_reason
    || responsePayload?.message
    || null;

  return {
    id: task.id,
    task_id: task.id,
    taskId: task.id,
    status,
    progress,
    url: url || null,
    image_url: url || null,
    images: images.length ? images : (url ? [url] : []),
    results,
    error: status === 'failed' ? failureReason : null,
    failure_reason: status === 'failed' ? failureReason : '',
    upstreamTaskId: task.upstreamTaskId,
    updatedAt: task.updatedAt,
  };
}
