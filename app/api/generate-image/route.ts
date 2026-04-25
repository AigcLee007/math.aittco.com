import { NextRequest } from 'next/server';
import { verifyAccessToken } from '~/server/auth/jwt';
import { getModelPrice } from '~/server/services/pricing.service';
import { createGenerateLog, finalizeGenerateLog } from '~/server/services/generate-log.service';
import {
  checkBalance,
  listPendingReservationTaskKeys,
  releaseReservedCoins,
  rebindReservedTaskKey,
  reserveCoins,
  settleReservedCoins,
} from '~/server/services/coin.service';
import {
  buildGeminiGenerateContentUrl,
  buildOpenAIImagesUrl,
  buildOpenAITaskUrl,
  createRelayAuthHeaders,
  decodeRelayTaskId,
  encodeRelayTaskId,
  getRelayRouteById,
  getImageResolutionModelPolicy,
  resolveImageModelRoute,
} from '~/server/services/model-route.service';

export const runtime = 'nodejs';
export const maxDuration = 900;

type SimulatedTask = {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  result?: any;
  error?: string;
  timestamp: number;
};

const simulatedTasks = new Map<string, SimulatedTask>();
const RETRY_DELAYS_MS = [1200, 2800] as const;
const backgroundRelayMonitors = new Set<string>();
let relayReconcilerStarted = false;

setInterval(() => {
  const now = Date.now();
  for (const [id, task] of simulatedTasks.entries()) {
    if (now - task.timestamp <= 10 * 60 * 1000)
      continue;

    simulatedTasks.delete(id);
    void releaseReservedCoins(id, '任务超时未完成，自动解冻');
  }
}, 60 * 1000);

function createReservationKey(userId: string, modelId: string): string {
  return `reserve:${userId}:${modelId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function mapSizeToOpenAI(size: string, resolution = '1K'): string {
  const maps: Record<string, Record<string, string>> = {
    '1K': {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:3': '1536x1152',
      '3:4': '1152x1536',
    },
    '2K': {
      '1:1': '2048x2048',
      '16:9': '3584x2048',
      '9:16': '2048x3584',
      '4:3': '3072x2304',
      '3:4': '2304x3072',
    },
    '4K': {
      '1:1': '4096x4096',
      '16:9': '7168x4096',
      '9:16': '4096x7168',
      '4:3': '6144x4608',
      '3:4': '4608x6144',
    },
  };

  const selectedMap = maps[resolution.toUpperCase()] || maps['1K'];
  return selectedMap[size] || selectedMap['1:1'];
}

function normalizeResolutionToken(value?: string): '1k' | '2k' | '4k' {
  const normalized = String(value || '1k').trim().toLowerCase();
  if (normalized === '2k')
    return '2k';
  if (normalized === '4k')
    return '4k';
  return '1k';
}

function resolvePricingModelId(baseModelId: string, resolution?: string): { chargeModelId: string; fallbackModelId: string } {
  const fallbackModelId = baseModelId.trim();
  const token = normalizeResolutionToken(resolution);
  if (token === '1k')
    return { chargeModelId: fallbackModelId, fallbackModelId };
  return {
    chargeModelId: `${fallbackModelId}-${token}`,
    fallbackModelId,
  };
}

function resolveRequestModelId(baseModelId: string, resolution?: string, policy: 'same' | 'suffix' = 'same'): string {
  const normalizedBase = baseModelId.trim();
  if (!normalizedBase)
    return normalizedBase;
  if (policy !== 'suffix')
    return normalizedBase;
  const token = normalizeResolutionToken(resolution);
  if (token === '1k')
    return normalizedBase;
  return `${normalizedBase}-${token}`;
}

function normalizeAspectRatio(size?: string): string {
  const normalized = (size || '1:1').trim();
  const supported = new Set([
    '1:1',
    '1:4',
    '1:8',
    '2:3',
    '3:2',
    '3:4',
    '4:1',
    '4:3',
    '4:5',
    '5:4',
    '8:1',
    '9:16',
    '16:9',
    '21:9',
  ]);

  if (supported.has(normalized))
    return normalized;
  return '1:1';
}

function buildGeminiPayload(
  prompt: string,
  images: string[],
  model: string,
  size: string,
  resolution: string,
  thinkingLevel?: string,
) {
  const arOpenAI = mapSizeToOpenAI(size, resolution);
  const reinforcedPrompt = `${prompt} (Aspect Ratio ${size}, high resolution ${resolution}, mandatory size ${arOpenAI}) --ar ${size}`;

  const parts: any[] = [{ text: reinforcedPrompt }];
  images.forEach((img) => {
    const base64Data = img.includes('base64,') ? img.split('base64,')[1] : img;
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64Data,
      },
    });
  });

  const payload: any = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: size,
        imageSize: resolution,
      },
    },
  };

  if (model === 'gemini-3.1-flash-image-preview' && thinkingLevel)
    payload.generationConfig.thinkingConfig = { thinkingLevel };

  return payload;
}

function buildOpenAIImagePayload(
  prompt: string,
  images: string[],
  model: string,
  size: string,
  resolution: string,
  thinkingLevel?: string,
) {
  const arOpenAI = mapSizeToOpenAI(size, resolution);
  const reinforcedPrompt = `${prompt} (Aspect Ratio ${size}, high resolution ${resolution}, mandatory size ${arOpenAI}) --ar ${size}`;

  if (model.includes('gpt') || model.includes('dall-e') || model.includes('grok')) {
    const payload: Record<string, any> = {
      model,
      prompt: reinforcedPrompt,
      quality: 'high',
      size: arOpenAI,
    };

    if (images.length > 0)
      payload.image = images[0].includes('base64,') ? images[0].split('base64,')[1] : images[0];

    if (payload.image)
      payload.input_fidelity = 'high';

    return payload;
  }

  return {
    model,
    async: true,
    prompt: reinforcedPrompt,
    system_instruction: {
      parts: [{ text: `You are an AI Image Generator. Always produce images in ${size} aspect ratio (${arOpenAI}).` }],
    },
    aspect_ratio: size,
    size: arOpenAI,
    thinking_level: thinkingLevel,
    generationConfig: {
      aspectRatio: size,
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: size, imageSize: resolution },
    },
    contents: [{
      role: 'user',
      parts: [
        { text: reinforcedPrompt },
        ...images.map((img) => ({
          inlineData: {
            mimeType: 'image/png',
            data: img.includes('base64,') ? img.split('base64,')[1] : img,
          },
        })),
      ],
    }],
    response_format: 'b64_json',
  };
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

function extractImageResult(data: any): string | null {
  if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
    const item = data.data[0];
    if (item?.b64_json)
      return `data:image/png;base64,${item.b64_json}`;
    if (item?.url)
      return item.url;
  }

  const payload = (data?.data && typeof data.data === 'object' && !Array.isArray(data.data))
    ? data.data
    : (data?.result && typeof data.result === 'object' && !Array.isArray(data.result))
      ? data.result
      : data;

  const nestedDataArray = payload?.data?.data;
  if (Array.isArray(nestedDataArray) && nestedDataArray.length > 0) {
    const nestedItem = nestedDataArray[0];
    if (nestedItem?.b64_json)
      return `data:image/png;base64,${nestedItem.b64_json}`;
    if (nestedItem?.url)
      return nestedItem.url;
  }

  const directUrl = payload?.url || payload?.imageUrl || payload?.image_url || payload?.image;
  if (typeof directUrl === 'string')
    return directUrl;

  const resultsArray = payload?.results;
  if (Array.isArray(resultsArray) && resultsArray.length > 0) {
    const firstResult = resultsArray[0];
    if (typeof firstResult?.url === 'string')
      return firstResult.url;
  }

  if (typeof payload?.result === 'string' && (payload.result.startsWith('http') || payload.result.startsWith('data:')))
    return payload.result;

  const part = payload?.candidates?.[0]?.content?.parts?.find((candidatePart: any) => candidatePart.inlineData?.data);
  if (part?.inlineData?.data)
    return `data:image/png;base64,${part.inlineData.data}`;

  return null;
}

function hasImagePayload(data: any): boolean {
  // Keep settlement criteria strict and aligned with frontend parsing:
  // only settle when a concrete image payload can be extracted.
  return !!extractImageResult(data);
}

function detectImageKind(data: any): 'base64' | 'url' | 'none' {
  const image = extractImageResult(data);
  if (!image)
    return 'none';
  return image.startsWith('data:') ? 'base64' : 'url';
}

function createErrorChunk(detail: string) {
  return `__ERROR__:${JSON.stringify({ error: 'Request Failed', detail })}`;
}

function buildRequestLogPayload(bodyData: any) {
  const images = Array.isArray(bodyData?.images) ? bodyData.images : [];
  return {
    ...bodyData,
    images: images.map((item: any) => ({
      kind: typeof item,
      length: typeof item === 'string' ? item.length : 0,
      hasDataUrlPrefix: typeof item === 'string' ? item.includes('base64,') : false,
    })),
    imagesCount: images.length,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function monitorRelayTaskAndSettle(taskId: string): Promise<void> {
  if (!taskId || backgroundRelayMonitors.has(taskId))
    return;

  const decodedTask = decodeRelayTaskId(taskId);
  if (!decodedTask)
    return;

  backgroundRelayMonitors.add(taskId);

  try {
    const maxAttempts = 225; // ~15 minutes at 4s interval
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let route;
      try {
        route = await getRelayRouteById(decodedTask.routeId);
      } catch {
        await sleep(4000);
        continue;
      }

      const response = await fetch(buildOpenAITaskUrl(route, decodedTask.upstreamTaskId), {
        headers: createRelayAuthHeaders(route),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 410) {
          await releaseReservedCoins(taskId, `任务查询失败: ${response.status}`);
          return;
        }
        await sleep(4000);
        continue;
      }

      const taskBodyText = await response.text();
      const taskResponse = safeJsonParse(taskBodyText);
      if (!taskResponse) {
        const trimmedBody = taskBodyText.trim();
        if (trimmedBody.startsWith('<')) {
          await releaseReservedCoins(taskId, '任务查询接口返回了 HTML 页面，停止轮询');
          return;
        }
        await sleep(4000);
        continue;
      }
      const taskStatus = String(taskResponse?.status || taskResponse?.data?.status || '').toUpperCase();
      if (['FAILED', 'FAILURE', 'ERROR', 'CANCELED', 'TIMEOUT'].includes(taskStatus)) {
        await releaseReservedCoins(taskId, taskResponse?.fail_reason || taskStatus);
        return;
      }
      if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'FINISHED'].includes(taskStatus)) {
        if (hasImagePayload(taskResponse))
          await settleReservedCoins(taskId, `生图消费: ${taskId}`);
        else
          await releaseReservedCoins(taskId, '任务成功但未返回图片');
        return;
      }

      await sleep(4000);
    }
  } catch (error) {
    console.warn('[generate-image] relay monitor error', { taskId, error });
  } finally {
    backgroundRelayMonitors.delete(taskId);
  }
}

function startRelayTaskMonitor(taskId: string): void {
  void monitorRelayTaskAndSettle(taskId);
}

function ensureRelayReservationReconcilerStarted(): void {
  if (relayReconcilerStarted)
    return;
  relayReconcilerStarted = true;

  setInterval(() => {
    void (async () => {
      try {
        const pendingKeys = await listPendingReservationTaskKeys(400);
        for (const key of pendingKeys) {
          if (key.startsWith('relaytask:'))
            startRelayTaskMonitor(key);
        }
      } catch (error) {
        console.warn('[generate-image] relay reconciler tick failed', error);
      }
    })();
  }, 60_000);
}

function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function isRetryableUpstreamFailure(status: number, bodyText: string): boolean {
  if ([429, 500, 502, 503, 504].includes(status))
    return true;

  const normalized = bodyText.toLowerCase();
  return normalized.includes('high demand')
    || normalized.includes('try again later')
    || normalized.includes('rate limit')
    || normalized.includes('temporarily unavailable')
    || normalized.includes('overloaded');
}

async function postJsonWithRetry(
  url: string,
  init: RequestInit,
): Promise<{ ok: true; status: number; data: any } | { ok: false; status: number; errorText: string }> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(600_000),
      });

      const bodyText = await response.text();
      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          data: safeJsonParse(bodyText) ?? { raw: bodyText },
        };
      }

      if (attempt < RETRY_DELAYS_MS.length && isRetryableUpstreamFailure(response.status, bodyText)) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        attempt++;
        continue;
      }

      return {
        ok: false,
        status: response.status,
        errorText: bodyText,
      };
    } catch (error: any) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        attempt++;
        continue;
      }

      return {
        ok: false,
        status: 0,
        errorText: error?.message || 'unknown error',
      };
    }
  }
}

export async function POST(req: NextRequest) {
  ensureRelayReservationReconcilerStarted();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const heartbeatInterval = setInterval(() => {
        controller.enqueue(encoder.encode('\n'));
      }, 10_000);

      let reservationTaskKey: string | null = null;
      let requestLogId: string | null = null;

      const releaseReservationIfNeeded = async (reason: string) => {
        if (!reservationTaskKey)
          return;
        await releaseReservedCoins(reservationTaskKey, reason);
        reservationTaskKey = null;
      };

      const finalizeLogIfNeeded = async (
        result: 'TASK_ID' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'ERROR',
        responsePayload: any,
        statusCode?: number | null,
        errorText?: string | null,
      ) => {
        if (!requestLogId)
          return;
        try {
          await finalizeGenerateLog({
            logId: requestLogId,
            statusCode,
            result,
            responsePayload,
            errorText,
          });
        } catch (logError) {
          console.warn('[generate-image] finalize log failed', logError);
        }
      };

      try {
        const bodyData = await req.json();
        const {
          prompt,
          images = [],
          model,
          pricingModelId,
          size = '1:1',
          resolution = '1K',
          thinkingLevel,
          taskId,
        } = bodyData;

        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const payload = token ? verifyAccessToken(token) : null;

        if (!payload) {
          await finalizeLogIfNeeded('ERROR', { message: '请先登录' }, 401, '请先登录');
          controller.enqueue(encoder.encode(createErrorChunk('请先登录')));
          return;
        }

        const userId = payload.userId;

        try {
          requestLogId = await createGenerateLog({
            userId,
            endpoint: '/api/generate-image',
            phase: taskId ? 'POLL' : 'SUBMIT',
            model: typeof model === 'string' ? model : null,
            prompt: typeof prompt === 'string' ? prompt : null,
            size: typeof size === 'string' ? size : null,
            resolution: typeof resolution === 'string' ? resolution : null,
            batch: Number(bodyData?.n || bodyData?.batch || bodyData?.batchSize || 1),
            imagesCount: Array.isArray(images) ? images.length : 0,
            taskId: typeof taskId === 'string' ? taskId : null,
            requestPayload: buildRequestLogPayload(bodyData),
          });
        } catch (logError) {
          console.warn('[generate-image] create log failed', logError);
        }

        if (taskId) {
          if (simulatedTasks.has(taskId)) {
            const task = simulatedTasks.get(taskId)!;
            if (task.error) {
              await releaseReservedCoins(taskId, task.error || '任务失败');
              await finalizeLogIfNeeded('FAILED', { status: 'FAILED', error: task.error }, 200, task.error || '任务失败');
              controller.enqueue(encoder.encode(JSON.stringify({ status: 'FAILED', error: task.error })));
              simulatedTasks.delete(taskId);
              return;
            }
            if (task.result) {
              if (hasImagePayload(task.result))
                await settleReservedCoins(taskId, `生图消费: ${taskId}`);
              else
                await releaseReservedCoins(taskId, '任务成功但未返回图片');
              await finalizeLogIfNeeded('SUCCESS', {
                status: 'SUCCESS',
                imageKind: detectImageKind(task.result),
                taskResult: task.result,
              }, 200);
              controller.enqueue(encoder.encode(JSON.stringify({ status: 'SUCCESS', ...task.result })));
              simulatedTasks.delete(taskId);
              return;
            }
            await finalizeLogIfNeeded('PROCESSING', { status: 'PROCESSING' }, 200);
            controller.enqueue(encoder.encode(JSON.stringify({ status: 'PROCESSING' })));
            return;
          }

          const decodedTask = decodeRelayTaskId(taskId);
          if (!decodedTask) {
            await finalizeLogIfNeeded('ERROR', { message: '无效的任务 ID' }, 400, '无效的任务 ID');
            controller.enqueue(encoder.encode(createErrorChunk('无效的任务 ID')));
            return;
          }

          const route = await getRelayRouteById(decodedTask.routeId);
          const response = await fetch(buildOpenAITaskUrl(route, decodedTask.upstreamTaskId), {
            headers: createRelayAuthHeaders(route),
          });

          if (!response.ok) {
            const errText = await response.text();
            await finalizeLogIfNeeded('ERROR', { status: response.status, body: errText }, response.status, errText);
            controller.enqueue(encoder.encode(createErrorChunk(errText)));
            return;
          }

          const taskResponse = await response.json();
          const taskStatus = String(taskResponse?.status || taskResponse?.data?.status || '').toUpperCase();
          if (['FAILED', 'FAILURE', 'ERROR', 'CANCELED', 'TIMEOUT'].includes(taskStatus)) {
            await releaseReservedCoins(taskId, taskResponse?.fail_reason || taskStatus);
            await finalizeLogIfNeeded('FAILED', taskResponse, 200, taskResponse?.fail_reason || taskStatus);
          } else if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'FINISHED'].includes(taskStatus)) {
            if (hasImagePayload(taskResponse))
              await settleReservedCoins(taskId, `生图消费: ${taskId}`);
            else
              await releaseReservedCoins(taskId, '任务成功但未返回图片');
            await finalizeLogIfNeeded('SUCCESS', {
              imageKind: detectImageKind(taskResponse),
              taskResponse,
            }, 200);
          } else {
            await finalizeLogIfNeeded('PROCESSING', taskResponse, 200);
          }

          controller.enqueue(encoder.encode(JSON.stringify(taskResponse)));
          return;
        }

        if (!prompt || !model) {
          await finalizeLogIfNeeded('ERROR', { message: '缺少必要参数' }, 400, '缺少必要参数');
          controller.enqueue(encoder.encode(createErrorChunk('缺少必要参数')));
          return;
        }

        const basePricingModelId = String(pricingModelId || model || '').trim();
        const resolutionModelPolicy = await getImageResolutionModelPolicy(basePricingModelId);
        const requestModelId = resolveRequestModelId(String(model || '').trim(), resolution, resolutionModelPolicy);
        const { chargeModelId, fallbackModelId } = resolvePricingModelId(basePricingModelId, resolution);
        let price = await getModelPrice(chargeModelId);
        let chargedModelId = chargeModelId;
        if (price <= 0 && chargeModelId !== fallbackModelId) {
          price = await getModelPrice(fallbackModelId);
          chargedModelId = fallbackModelId;
        }

        if (price > 0) {
          const { isEnough } = await checkBalance(userId, price);
          if (!isEnough) {
            await finalizeLogIfNeeded('ERROR', { message: `余额不足，生图需要 ${price} 金币` }, 402, `余额不足，生图需要 ${price} 金币`);
            controller.enqueue(encoder.encode(createErrorChunk(`余额不足，生图需要 ${price} 金币`)));
            return;
          }

          reservationTaskKey = createReservationKey(userId, chargedModelId);
          await reserveCoins(userId, price, chargedModelId, reservationTaskKey, `生图额度预占: ${chargedModelId}`);
        }

        const route = await resolveImageModelRoute(requestModelId || model);
        const safeAspectRatio = normalizeAspectRatio(size);
        const upRes = resolution.toUpperCase();
        const isGeminiRoute = route.transport === 'gemini-generate-content';
        const isVisionaryRoute = route.transport === 'visionary-images';
        const isWrappedSyncRoute = isGeminiRoute;

        const targetUrl = isGeminiRoute
          ? buildGeminiGenerateContentUrl(route, route.upstreamModel)
          : isVisionaryRoute
            ? buildOpenAIImagesUrl(route, false, route.endpointPath || '/openapi/v1/images/generations')
          : buildOpenAIImagesUrl(
            route,
            !route.upstreamModel.includes('gpt') && !route.upstreamModel.includes('dall-e'),
            route.endpointPath || '/v1/images/generations',
          );

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(isGeminiRoute ? {} : createRelayAuthHeaders(route)),
          ...(isVisionaryRoute ? { 'Idempotency-Key': `req_${Date.now()}_${Math.random().toString(36).slice(2)}` } : {}),
        };

        const requestBody = isGeminiRoute
          ? buildGeminiPayload(prompt, images, route.upstreamModel, safeAspectRatio, upRes, thinkingLevel)
          : isVisionaryRoute
            ? buildVisionaryImagePayload(prompt, images, route.upstreamModel, safeAspectRatio, upRes)
          : buildOpenAIImagePayload(prompt, images, route.upstreamModel, safeAspectRatio, upRes, thinkingLevel);

        if (isWrappedSyncRoute) {
          const simTaskId = `sim:${route.routeId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
          simulatedTasks.set(simTaskId, { status: 'PROCESSING', timestamp: Date.now() });

          if (reservationTaskKey) {
            await rebindReservedTaskKey(reservationTaskKey, simTaskId);
            reservationTaskKey = simTaskId;
          }

          void (async () => {
            try {
              const upstream = await postJsonWithRetry(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
              });

              if (!upstream.ok) {
                await releaseReservedCoins(simTaskId, upstream.errorText || '任务失败');
                simulatedTasks.set(simTaskId, {
                  status: 'FAILED',
                  error: upstream.errorText,
                  timestamp: Date.now(),
                });
                return;
              }

              if (hasImagePayload(upstream.data))
                await settleReservedCoins(simTaskId, `生图消费: ${model}`);
              else
                await releaseReservedCoins(simTaskId, '任务成功但未返回图片');

              simulatedTasks.set(simTaskId, {
                status: 'COMPLETED',
                result: upstream.data,
                timestamp: Date.now(),
              });
            } catch (error: any) {
              await releaseReservedCoins(simTaskId, error.message || '任务失败');
              simulatedTasks.set(simTaskId, {
                status: 'FAILED',
                error: error.message || 'unknown error',
                timestamp: Date.now(),
              });
            }
          })();

          await finalizeLogIfNeeded('TASK_ID', { taskId: simTaskId, routeId: route.routeId }, 200);
          controller.enqueue(encoder.encode(JSON.stringify({ taskId: simTaskId })));
          return;
        }

        const upstream = await postJsonWithRetry(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!upstream.ok) {
          await releaseReservationIfNeeded(upstream.errorText);
          await finalizeLogIfNeeded('ERROR', { status: upstream.status, error: upstream.errorText }, upstream.status || 500, upstream.errorText);
          controller.enqueue(encoder.encode(createErrorChunk(upstream.errorText)));
          return;
        }

        const data = upstream.data;

        if (data?.error) {
          const detail = typeof data.error === 'string'
            ? data.error
            : data.error?.message || JSON.stringify(data.error);
          await releaseReservationIfNeeded(detail);
          await finalizeLogIfNeeded('ERROR', data, 200, detail);
          controller.enqueue(encoder.encode(createErrorChunk(detail)));
          return;
        }

        const finalImageUrl = extractImageResult(data);
        if (!finalImageUrl) {
          const upstreamTaskId = data?.id
            || data?.task_id
            || data?.taskId
            || data?.data?.id
            || data?.data?.task_id
            || data?.data?.taskId;

          if (upstreamTaskId) {
            const encodedTaskId = encodeRelayTaskId(route.routeId, upstreamTaskId);
            if (reservationTaskKey) {
              await rebindReservedTaskKey(reservationTaskKey, encodedTaskId);
              reservationTaskKey = encodedTaskId;
            }
            startRelayTaskMonitor(encodedTaskId);
            await finalizeLogIfNeeded('TASK_ID', { taskId: encodedTaskId, upstreamTaskId, routeId: route.routeId }, 200);
            controller.enqueue(encoder.encode(JSON.stringify({ taskId: encodedTaskId })));
            return;
          }

          await releaseReservationIfNeeded('未获取到有效图片结果');
          await finalizeLogIfNeeded('ERROR', data, 200, '未获取到有效图片结果');
          controller.enqueue(encoder.encode(createErrorChunk('未获取到有效图片结果')));
          return;
        }

        if (reservationTaskKey) {
          await settleReservedCoins(reservationTaskKey, `生图消费: ${model}`);
          reservationTaskKey = null;
        }

        await finalizeLogIfNeeded('SUCCESS', {
          hasImage: true,
          imageType: finalImageUrl.startsWith('data:') ? 'base64' : 'url',
          upstream: data,
        }, 200);

        const base64Only = finalImageUrl.includes('base64,') ? finalImageUrl.split('base64,')[1] : finalImageUrl;
        controller.enqueue(encoder.encode('__BASE64_DATA_START__'));
        const chunkSize = 16_384;
        for (let i = 0; i < base64Only.length; i += chunkSize)
          controller.enqueue(encoder.encode(base64Only.slice(i, i + chunkSize)));

        controller.enqueue(encoder.encode('__BASE64_DATA_END__'));
      } catch (error: any) {
        if (reservationTaskKey)
          await releaseReservedCoins(reservationTaskKey, error?.message || '生成异常，自动解冻');
        await finalizeLogIfNeeded('ERROR', { message: error?.message || 'Internal Server Error' }, 500, error?.message || 'Internal Server Error');
        controller.enqueue(encoder.encode(createErrorChunk(error.message || 'Internal Server Error')));
      } finally {
        clearInterval(heartbeatInterval);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
