import { buildOpenAIImagesUrl, createRelayAuthHeaders, getRelayRouteById } from './model-route.service';
import {
  bindLocalImageTaskUpstreamId,
  getLocalImageTask,
  listPendingLocalImageTasks,
  markLocalImageTaskFailed,
  markLocalImageTaskProcessing,
  markLocalImageTaskSucceeded,
} from './local-image-task.service';
import { releaseReservedCoins, settleReservedCoins } from './coin.service';

const VISIONARY_ROUTE_ID = 'visionary';
const VISIONARY_ENDPOINT_PATH = '/openapi/v1/images/generations';
const VISIONARY_LIST_PATH = '/openapi/v1/images/generations?page=1&limit=50';
const visionaryTaskMonitors = new Set<string>();
let visionaryTaskReconcilerStarted = false;

type VisionaryTaskRequestPayload = {
  prompt?: string;
  images?: string[];
  upstreamModel?: string;
  aspectRatio?: string;
  resolution?: string;
  endpointPath?: string;
};

function tryParseJson(text: string): any {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeStatus(status?: string): string {
  return String(status || '').trim().toUpperCase();
}

function normalizeProgress(value: any): number {
  const progress = Number(typeof value === 'string' ? value.replace('%', '').trim() : value || 0);
  if (!Number.isFinite(progress))
    return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function buildVisionaryImagePayload(
  prompt: string,
  images: string[],
  model: string,
  size: string,
  resolution: string,
) {
  return {
    prompt,
    model,
    ratio: size,
    imageSize: resolution,
    images: images.map((img) => img.includes('base64,') ? img.split('base64,')[1] : img),
  };
}

function extractVisionaryImageUrl(payload: any): string | null {
  if (!payload || typeof payload !== 'object')
    return null;

  const direct = payload.url || payload.image_url || payload.imageUrl || payload.image;
  if (typeof direct === 'string' && direct)
    return direct;

  if (Array.isArray(payload.results) && typeof payload.results[0]?.url === 'string' && payload.results[0].url)
    return payload.results[0].url;

  return null;
}

function buildSucceededPayload(payload: any, imageUrl: string) {
  return {
    ...(payload && typeof payload === 'object' ? payload : {}),
    status: 'succeeded',
    progress: 100,
    url: imageUrl,
    image_url: imageUrl,
    images: [imageUrl],
    results: Array.isArray(payload?.results) && payload.results.length
      ? payload.results
      : [{ url: imageUrl, content: '' }],
  };
}

function buildFailedPayload(payload: any, errorText: string) {
  return {
    ...(payload && typeof payload === 'object' ? payload : {}),
    status: 'failed',
    progress: 100,
    error: errorText,
    failure_reason: errorText,
  };
}

function extractVisionaryError(payload: any, fallback = 'Visionary 生成失败'): string {
  if (!payload || typeof payload !== 'object')
    return fallback;

  const candidates = [
    payload.error,
    payload.failure_reason,
    payload.fail_reason,
    payload.message,
    payload.detail,
    payload.msg,
  ];

  for (const item of candidates) {
    if (typeof item === 'string' && item.trim())
      return item.trim();
  }

  if (payload.error && typeof payload.error === 'object') {
    const nested = payload.error.message || payload.error.detail;
    if (typeof nested === 'string' && nested.trim())
      return nested.trim();
  }

  return fallback;
}

function findVisionaryTaskRecord(payload: any, upstreamTaskId: string): any | null {
  if (!payload)
    return null;

  const collections = [
    payload.results,
    payload.data,
    payload.items,
    payload.records,
    payload.list,
    payload?.data?.results,
    payload?.data?.items,
    payload?.data?.records,
    payload?.data?.list,
  ];

  for (const collection of collections) {
    if (!Array.isArray(collection))
      continue;
    const matched = collection.find((item: any) => {
      const id = item?.id || item?.task_id || item?.taskId || item?.data?.id;
      return typeof id === 'string' && id.trim() === upstreamTaskId;
    });
    if (matched)
      return matched;
  }

  return null;
}

function isVisionaryTerminalFailure(status: string): boolean {
  return ['FAILED', 'FAILURE', 'ERROR', 'CANCELED', 'TIMEOUT'].includes(status);
}

function isVisionaryTerminalSuccess(status: string): boolean {
  return ['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'FINISHED'].includes(status);
}

async function failVisionaryTask(taskId: string, errorText: string, payload?: any): Promise<void> {
  const detail = String(errorText || 'Visionary 任务失败');
  await markLocalImageTaskFailed(taskId, detail, buildFailedPayload(payload, detail));
  await releaseReservedCoins(taskId, detail);
}

async function succeedVisionaryTask(taskId: string, payload: any, imageUrl: string): Promise<void> {
  await markLocalImageTaskSucceeded(taskId, buildSucceededPayload(payload, imageUrl));
  await settleReservedCoins(taskId, `生图消费: ${taskId}`);
}

async function submitVisionaryTaskToUpstream(taskId: string): Promise<void> {
  const task = await getLocalImageTask(taskId);
  if (!task || task.status !== 'processing')
    return;

  const route = await getRelayRouteById(task.routeId || VISIONARY_ROUTE_ID);
  const requestPayload = (task.requestPayload && typeof task.requestPayload === 'object' ? task.requestPayload : {}) as VisionaryTaskRequestPayload;
  const prompt = String(requestPayload.prompt || '').trim();
  const upstreamModel = String(requestPayload.upstreamModel || task.modelId || '').trim();
  const aspectRatio = String(requestPayload.aspectRatio || '1:1').trim() || '1:1';
  const resolution = String(requestPayload.resolution || '1K').trim() || '1K';
  const images = Array.isArray(requestPayload.images)
    ? requestPayload.images.filter((item): item is string => typeof item === 'string')
    : [];

  if (!prompt || !upstreamModel) {
    await failVisionaryTask(taskId, 'Visionary 任务缺少 prompt 或上游模型配置');
    return;
  }

  const endpointPath = String(requestPayload.endpointPath || VISIONARY_ENDPOINT_PATH).trim() || VISIONARY_ENDPOINT_PATH;
  const submitUrl = buildOpenAIImagesUrl(route, false, endpointPath);
  const response = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...createRelayAuthHeaders(route),
      'Idempotency-Key': `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    },
    body: JSON.stringify(buildVisionaryImagePayload(prompt, images, upstreamModel, aspectRatio, resolution)),
    signal: AbortSignal.timeout(600_000),
  });

  const responseText = await response.text();
  const responsePayload = tryParseJson(responseText);

  if (!response.ok) {
    const errorText = responsePayload
      ? extractVisionaryError(responsePayload, responseText || `Visionary 上游请求失败: ${response.status}`)
      : (responseText || `Visionary 上游请求失败: ${response.status}`);
    await failVisionaryTask(taskId, errorText, responsePayload || { raw: responseText, status: response.status });
    return;
  }

  if (!responsePayload) {
    await failVisionaryTask(taskId, 'Visionary 返回了非 JSON 内容', { raw: responseText });
    return;
  }

  const imageUrl = extractVisionaryImageUrl(responsePayload);
  const status = normalizeStatus(responsePayload.status);
  if (imageUrl && (!status || isVisionaryTerminalSuccess(status))) {
    await succeedVisionaryTask(taskId, responsePayload, imageUrl);
    return;
  }

  if (isVisionaryTerminalFailure(status)) {
    await failVisionaryTask(taskId, extractVisionaryError(responsePayload), responsePayload);
    return;
  }

  const upstreamTaskId = responsePayload.id || responsePayload.task_id || responsePayload.taskId;
  if (typeof upstreamTaskId !== 'string' || !upstreamTaskId.trim()) {
    await failVisionaryTask(taskId, 'Visionary 未返回有效任务 ID 或图片结果', responsePayload);
    return;
  }

  await bindLocalImageTaskUpstreamId(taskId, upstreamTaskId.trim(), responsePayload);
  await markLocalImageTaskProcessing(taskId, normalizeProgress(responsePayload.progress), responsePayload);
}

async function pollVisionaryTaskList(taskId: string): Promise<void> {
  const task = await getLocalImageTask(taskId);
  if (!task || task.status !== 'processing' || !task.upstreamTaskId)
    return;

  const route = await getRelayRouteById(task.routeId || VISIONARY_ROUTE_ID);
  const listUrl = `${route.baseUrl}${VISIONARY_LIST_PATH}`;
  const maxAttempts = 225;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const latestTask = await getLocalImageTask(taskId);
    if (!latestTask || latestTask.status !== 'processing')
      return;

    const response = await fetch(listUrl, {
      method: 'GET',
      headers: createRelayAuthHeaders(route),
      signal: AbortSignal.timeout(30_000),
    });

    const responseText = await response.text();
    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        await failVisionaryTask(taskId, `Visionary 任务查询失败: ${response.status}`, { raw: responseText, status: response.status });
        return;
      }
      await sleep(4000);
      continue;
    }

    const responsePayload = tryParseJson(responseText);
    if (!responsePayload) {
      const trimmed = responseText.trim();
      if (trimmed.startsWith('<')) {
        await failVisionaryTask(taskId, 'Visionary 任务查询接口返回了 HTML 页面', { raw: responseText });
        return;
      }
      await sleep(4000);
      continue;
    }

    const record = findVisionaryTaskRecord(responsePayload, latestTask.upstreamTaskId || '');
    if (!record) {
      await sleep(4000);
      continue;
    }

    const status = normalizeStatus(record.status);
    const imageUrl = extractVisionaryImageUrl(record);

    if (imageUrl && (!status || isVisionaryTerminalSuccess(status))) {
      await succeedVisionaryTask(taskId, record, imageUrl);
      return;
    }

    if (isVisionaryTerminalFailure(status)) {
      await failVisionaryTask(taskId, extractVisionaryError(record), record);
      return;
    }

    await markLocalImageTaskProcessing(taskId, normalizeProgress(record.progress ?? responsePayload?.progress ?? attempt * 2), record);
    await sleep(4000);
  }

  await failVisionaryTask(taskId, 'Visionary 任务轮询超时');
}

async function monitorVisionaryLocalTask(taskId: string): Promise<void> {
  if (!taskId || visionaryTaskMonitors.has(taskId))
    return;

  visionaryTaskMonitors.add(taskId);
  try {
    const task = await getLocalImageTask(taskId);
    if (!task || task.status !== 'processing')
      return;

    if (!task.upstreamTaskId)
      await submitVisionaryTaskToUpstream(taskId);

    const refreshed = await getLocalImageTask(taskId);
    if (!refreshed || refreshed.status !== 'processing')
      return;

    if (!refreshed.upstreamTaskId) {
      await failVisionaryTask(taskId, 'Visionary 未能进入可轮询状态');
      return;
    }

    await pollVisionaryTaskList(taskId);
  } catch (error: any) {
    await failVisionaryTask(taskId, error?.message || 'Visionary 本地后台任务异常');
  } finally {
    visionaryTaskMonitors.delete(taskId);
  }
}

export function isVisionaryLocalTaskId(taskId?: string | null): boolean {
  return typeof taskId === 'string' && taskId.startsWith(`localtask:${VISIONARY_ROUTE_ID}:`);
}

export function startVisionaryLocalTaskMonitor(taskId: string): void {
  void monitorVisionaryLocalTask(taskId);
}

export function ensureVisionaryLocalTaskReconcilerStarted(): void {
  if (visionaryTaskReconcilerStarted)
    return;

  visionaryTaskReconcilerStarted = true;

  setInterval(() => {
    void (async () => {
      try {
        const pendingTasks = await listPendingLocalImageTasks(200, VISIONARY_ROUTE_ID);
        for (const task of pendingTasks)
          startVisionaryLocalTaskMonitor(task.id);
      } catch (error) {
        console.warn('[visionary-task] reconciler tick failed', error);
      }
    })();
  }, 60_000);
}
