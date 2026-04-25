import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import {
  appendAspectRatioFlag,
  getNanoBananaDisplayLabel,
  isNanoBanana2VipModel,
  isNanoBananaProLine2Model,
  isNanoBananaProVipModel,
  mapNanoBananaLine1SizeToModel,
  mapNanoBanana2VipSizeToModel,
  NANO_BANANA_PRO_LINE1_MODEL_ID,
  NANO_BANANA_PRO_LINE2_MODEL_ID,
  NANO_BANANA_PRO_VIP_MODEL_ID,
  NANO_BANANA_2_VIP_MODEL_ID,
  normalizeNanoBananaLine1SizeToken,
} from './nanoBananaLine1';

export const BananaApiParams = {
  endpoint: '/api/generate',
  optimizeEndpoint: '/api/optimize-prompt',
  describeEndpoint: '/api/describe-image',
  balanceEndpoint: 'https://api.aittco.com/v1/dashboard/billing',
  models: [
    { id: NANO_BANANA_PRO_LINE1_MODEL_ID, name: getNanoBananaDisplayLabel(NANO_BANANA_PRO_LINE1_MODEL_ID, 'Nano Banana Pro'), icon: 'NBP1', cost: '0.4' },
    { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2', icon: 'NB2', cost: '0.2' },
    { id: NANO_BANANA_PRO_LINE2_MODEL_ID, name: getNanoBananaDisplayLabel(NANO_BANANA_PRO_LINE2_MODEL_ID, 'Nano Banana Pro'), icon: 'NBP2', cost: '0.2' },
    { id: NANO_BANANA_PRO_VIP_MODEL_ID, name: getNanoBananaDisplayLabel(NANO_BANANA_PRO_VIP_MODEL_ID, 'Nano Banana Pro(vip)'), icon: 'VIP1', cost: '25' },
    { id: NANO_BANANA_2_VIP_MODEL_ID, name: getNanoBananaDisplayLabel(NANO_BANANA_2_VIP_MODEL_ID, 'Nano Banana 2(vip)'), icon: 'VIP2', cost: '9' },
  ],
};

export interface BananaGenerationRequest {
  prompt: string;
  images?: string[];
  model: string;
  routingModelId?: string;
  size: string; // Aspect ratio like "1:1"
  resolution?: string; // "1K", "2K", "4K"
  userId: string;
}

export const VIDEO_MODELS: Array<{ id: string; name: string; price: number }> = [
  { id: 'veo3.1-fast', name: 'Veo3.1-Fast', price: 12 },
  { id: 'veo3.1-components', name: 'Veo3.1-Components', price: 18 },
  { id: 'veo3.1', name: 'Veo3.1', price: 18 },
  { id: 'veo3.1-pro', name: 'Veo3.1-pro', price: 60 },
  { id: 'grok-video-3', name: 'Grok-Video-3', price: 30 },
];

const VIDEO_MODEL_ALIAS: Record<string, string> = {
  'veo3.1-4k': 'veo3.1-fast-4K',
  'veo3.1-components-4k': 'veo3.1-fast-components-4K',
};

function normalizeVideoModelId(modelId?: string): string {
  const normalized = String(modelId || '').trim();
  if (!normalized)
    return normalized;
  return VIDEO_MODEL_ALIAS[normalized] || normalized;
}

export function isVideoModelId(modelId?: string): boolean {
  const normalized = normalizeVideoModelId(modelId);
  return VIDEO_MODELS.some((item) => item.id === normalized);
}

function getAccessTokenForApi(): string | null {
  const storeToken = useAuthStore.getState().accessToken;
  if (storeToken)
    return storeToken;

  if (typeof window === 'undefined')
    return null;

  try {
    const raw = window.localStorage.getItem('auth-storage');
    if (!raw)
      return null;
    const parsed = JSON.parse(raw);
    const persistedToken = parsed?.state?.accessToken;
    return typeof persistedToken === 'string' && persistedToken ? persistedToken : null;
  } catch {
    return null;
  }
}

function getAuthHeadersForApi(): Record<string, string> {
  const token = getAccessTokenForApi();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isLocalImageTaskId(taskId?: string): boolean {
  return typeof taskId === 'string' && taskId.startsWith('localtask:');
}

function extractImageTaskId(data: any): string | null {
  const taskId = data?.taskId || data?.task_id || data?.id;
  return typeof taskId === 'string' && taskId.trim() ? taskId.trim() : null;
}

const SUPPORTED_ASPECT_RATIOS = new Set([
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

function normalizeAspectRatio(size?: string): string {
  const normalized = (size || '1:1').trim();
  if (SUPPORTED_ASPECT_RATIOS.has(normalized))
    return normalized;
  return '1:1';
}

function buildGenerateRequestBody(params: BananaGenerationRequest & { taskId?: string; pricingModelId?: string }) {
  if (params.taskId) {
    return {
      taskId: params.taskId,
      model: 'polling-task',
      prompt: 'polling',
    };
  }

  if (isNanoBananaProLine2Model(params.pricingModelId || params.model)) {
    const aspectRatio = normalizeAspectRatio(params.size);
    const resolution = normalizeNanoBananaLine1SizeToken(params.resolution || '1K');

    return {
      model: mapNanoBananaLine1SizeToModel(resolution),
      prompt: appendAspectRatioFlag(params.prompt, aspectRatio),
      size: resolution,
      aspect_ratio: aspectRatio,
      n: 1,
      pricingModelId: params.pricingModelId || params.model,
    };
  }

  if (isNanoBananaProVipModel(params.pricingModelId || params.model)) {
    const aspectRatio = normalizeAspectRatio(params.size);
    const resolution = normalizeNanoBananaLine1SizeToken(params.resolution || '1K');

    return {
      model: mapNanoBananaLine1SizeToModel(resolution),
      prompt: appendAspectRatioFlag(params.prompt, aspectRatio),
      size: resolution,
      aspect_ratio: aspectRatio,
      n: 1,
      pricingModelId: params.pricingModelId || params.model,
    };
  }

  if (isNanoBanana2VipModel(params.pricingModelId || params.model)) {
    const aspectRatio = normalizeAspectRatio(params.size);
    const resolution = normalizeNanoBananaLine1SizeToken(params.resolution || '1K');

    return {
      model: mapNanoBanana2VipSizeToModel(resolution),
      prompt: appendAspectRatioFlag(params.prompt, aspectRatio),
      size: resolution,
      aspect_ratio: aspectRatio,
      n: 1,
      pricingModelId: params.pricingModelId || params.model,
    };
  }

  return {
    ...params,
    size: normalizeAspectRatio(params.size),
  };
}

function isImageSafetyBlocked(payload: any, rawData?: any): boolean {
  const finishReason = String(payload?.finishReason || payload?.candidates?.[0]?.finishReason || '').toUpperCase();
  if (finishReason === 'IMAGE_SAFETY')
    return true;

  const finishMessage = String(payload?.finishMessage || payload?.candidates?.[0]?.finishMessage || '');
  const firstText = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || '');
  const rawText = [finishMessage, firstText, typeof rawData === 'string' ? rawData : ''].join(' ').toLowerCase();

  return rawText.includes('image_safety')
    || rawText.includes('unable to show the generated image')
    || rawText.includes('prohibited use policy')
    || rawText.includes('blocked images');
}

function toFriendlyBananaErrorMessage(message?: string): string {
  const text = String(message || '');
  const lower = text.toLowerCase();
  if (lower.includes('image_safety')
    || lower.includes('unable to show the generated image')
    || lower.includes('prohibited use policy')
    || lower.includes('blocked images')) {
    return '内容触发安全策略，请重写提示词';
  }
  return text || '生成失败，请稍后重试';
}

/**
 * 璋冪敤鏈湴 FastAPI 鍚庣鐢熸垚鍥剧墖 (鍙戦€佲€滄寚浠も€濇牸寮?
 * 鐩爣: http://localhost:8000/api/generate-image
 */
export async function generateGeminiNativeImage(params: BananaGenerationRequest): Promise<string> {
  // 鏍规嵁鐢ㄦ埛鎻愪緵鐨勮摑鍥撅紝灏嗘寚浠ゅ彂閫佸埌鏈湴 Python 鍚庣
  const url = 'http://localhost:8000/api/generate-image';

  // 杩欓噷鐨?body 鍗充负鐢ㄦ埛钃濆浘涓畾涔夌殑鈥滄寚浠も€濆唴瀹?(JSON)
  const body = {
    prompt: params.prompt,
    model: params.model,
    size: params.size || '1:1',
    resolution: (params.resolution || '1k').toLowerCase(), // 钃濆浘涓姹傚皬鍐?1k
    images: params.images || []
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ... (useAuthStore.getState().accessToken ? { 'Authorization': `Bearer ${useAuthStore.getState().accessToken}` } : {}),
    },
    body: JSON.stringify(body),
    // 鍏佽鏈€闀?15 鍒嗛挓鐨勮秴鏃舵椂闂?
    signal: AbortSignal.timeout(900000),
  });

  if (!response.ok) {
    let errorMessage = `本地后端错误! 状态码: ${response.status}`;
    try {
      const errorData = await response.json();
      // 鍏煎 FastAPI 鐨?detail 閿欒鎴栬嚜瀹氫箟娑堟伅
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch (e) { /* skip */ }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // 棰勬湡杩斿洖鏍煎紡锛歿"image": "data:image/...", ...} 鎴栫洿鎺ユ槸 base64
  if (data.image) return data.image;
  if (data.url) return data.url;
  
  // 濡傛灉杩斿洖鐨勬槸鍘熷 Base64
  if (typeof data === 'string' && data.startsWith('data:image')) return data;

  throw new Error('本地后端未返回有效的图片数据，请检查后端日志。');
}

export interface BananaBalanceResponse {
  subscription?: {
    hard_limit_usd: number;
    has_payment_method: boolean;
  };
  usage?: {
    total_usage: number; // in cents or other unit
  };
}

/**
 * 璋冪敤鏈湴浠ｇ悊鐢熸垚鍥剧墖 (娴佸紡鍝嶅簲妯″紡锛屽鍒?4k-main 閫昏緫)
 */
export async function generateBananaImageStream(
  params: BananaGenerationRequest, 
  onProgress?: (receivedBytes: number, totalBytes: number) => void,
  onTaskId?: (taskId: string) => void,
): Promise<string> {
  const url = BananaApiParams.endpoint;
  const requestBody = buildGenerateRequestBody({
    ...params,
    pricingModelId: params.routingModelId || params.model,
  });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
      'Content-Type': 'application/json',
      ... (useAuthStore.getState().accessToken ? { 'Authorization': `Bearer ${useAuthStore.getState().accessToken}` } : {}),
    },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `HTTP 错误! 状态码: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
      } catch (e) { /* skip */ }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('响应体不可读');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedBytes = 0;
    let base64Data = '';
    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    
    let heartbeatCount = 0;
    let dataStarted = false;
    let errorBuffer = '';
    let errorStartFound = false;

    // 璇诲彇娴佹暟鎹?
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedBytes += value.length;
      const chunk = decoder.decode(value, { stream: true });
      
      // 1. 妫€娴嬮敊璇俊鎭?
      if (chunk.includes('__ERROR__:') || errorStartFound) {
        errorBuffer += chunk;
        const errorStartIndex = errorBuffer.indexOf('__ERROR__:');
        if (errorStartIndex !== -1) {
          errorStartFound = true;
          const errorJsonPart = errorBuffer.substring(errorStartIndex + 10);
          try {
            const endIdx = errorJsonPart.lastIndexOf('}');
            if (endIdx !== -1) {
              const errorData = JSON.parse(errorJsonPart.substring(0, endIdx + 1));
              throw new Error(toFriendlyBananaErrorMessage(errorData.detail || errorData.error || '生成图片失败'));
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
        continue;
      }

      // 2. 妫€娴嬪績璺?
      const isHeartbeat = !dataStarted && chunk.trim() === '' && (chunk === '\n' || chunk === '\r\n') && chunk.length <= 2;
      if (isHeartbeat) {
        heartbeatCount++;
        console.log(`[Banana-API] Heartbeat received #${heartbeatCount}`);
        continue;
      }

      // 3. 妫€娴?taskId (鐢ㄤ簬鍓嶇杞椹卞姩)
      const trimmedChunk = chunk.trim();
      if (!dataStarted && (
        trimmedChunk.includes('"taskId"')
        || trimmedChunk.includes('"task_id"')
        || trimmedChunk.includes('"id"')
        || (trimmedChunk.startsWith('{') && (trimmedChunk.includes('sim-') || trimmedChunk.includes('localtask:')))
      )) {
        let taskData: any = null;
        try {
          // 灏濊瘯浠庢竻鐞嗗悗鐨?chunk 涓彁鍙?JSON (鍙兘鍖呭惈鎹㈣绗?
          const jsonMatch = trimmedChunk.match(/\{.*\}/s);
          const jsonToParse = jsonMatch ? jsonMatch[0] : trimmedChunk;
          taskData = JSON.parse(jsonToParse);
        } catch (e) { 
          /* 鍙兘涓嶆槸瀹屾暣鐨?JSON 鎴栦笉鏄?JSON锛岀户缁帴鏀?*/ 
        }

        const extractedTaskId = extractImageTaskId(taskData);
        if (extractedTaskId) {
           onTaskId?.(extractedTaskId);
           console.log(`[Banana-API] Client-side polling started for task: ${extractedTaskId}`);
            // 杩涘叆閫掑綊/寰幆杞闃舵锛屾澶勪笉鍐嶆崟鑾烽敊璇紝璁╃湡瀹炴姤閿欏悜涓婃姏鍑?
           return await pollBananaTask(extractedTaskId, onProgress);
        }
      }

      if (!dataStarted) {
        console.log(`[Banana-API] Data started receiving after ${heartbeatCount} heartbeats`);
        dataStarted = true;
      }

      // 4. 娓呯悊鍗忚鍒嗙晫绗﹀苟绱Н鏁版嵁
      let cleanedChunk = chunk;
      if (cleanedChunk.includes('__BASE64_DATA_START__') || cleanedChunk.includes('__BASE64_DATA_END__')) {
        cleanedChunk = cleanedChunk.replace(/__BASE64_DATA_START__|__BASE64_DATA_END__/g, '');
      }

      if (cleanedChunk) {
        base64Data += cleanedChunk;
        if (onProgress) {
          onProgress(receivedBytes, totalBytes || receivedBytes);
        }
      }
    }

    // 鏈€缁堟竻鐞嗕笌楠岃瘉
    base64Data = base64Data.trim().replace(/\s+/g, '');
    if (!base64Data) {
      throw new Error('未接收到有效的图片数据');
    }

    // 鏍煎紡鍖栦负 Data URI 鎴栫洿鎺ヨ繑鍥?URL
    if (base64Data.startsWith('data:image') || base64Data.startsWith('http')) return base64Data;
    
    // 濡傛灉鏄函 Base64锛屽皾璇曢獙璇佸苟娣诲姞鍓嶇紑
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (base64Regex.test(base64Data)) {
      return `data:image/png;base64,${base64Data}`;
    }

    // 鍏滃簳锛氬鏋滃寘鍚潅璐紝灏濊瘯鎻愬彇
    const match = base64Data.match(/[A-Za-z0-9+/=]{100,}/);
    if (match) return `data:image/png;base64,${match[0]}`;

    throw new Error('生成的图片数据格式不正确');

  } catch (error: any) {
    console.error('[Banana-API] Stream Generation Failed:', error);
    throw new Error(toFriendlyBananaErrorMessage(error?.message));
  }
}

/**
 * 鍓嶇杞浠诲姟鐘舵€?
 */
async function pollBananaTask(
  taskId: string, 
  onProgress?: (received: number, total: number) => void
): Promise<string> {
  let attempts = 0;
  const maxAttempts = 150; // 鍘?60 (4鍒嗛挓)銆傛彁鍗囧埌 150 娆★紝姣忔闂撮殧 4 绉掞紝澶х害 10 鍒嗛挓銆傜‘淇濊€楁椂鐨勫鍥鹃暱鎻愮ず璇嶄篃鑳藉畨鍏ㄨ窇瀹屻€?

  while (attempts < maxAttempts) {
    // 妯℃嫙涓€涓€愭笎澧為暱鐨勮繘搴︼紝鍗充究娌℃湁鐪熷疄瀛楄妭鏁版祦
    // 鍓?0娆″崰90%锛屽悗闈㈡瀬缂撳闀?
    const simulatedProgress = Math.min(95, attempts * 1.5);
    onProgress?.(simulatedProgress, 100);

    await new Promise(r => setTimeout(r, 4000)); // 姣忔闂撮殧 4 绉?
    attempts++;

    try {
      const isLocalTask = isLocalImageTaskId(taskId);
      const res = await fetch(
        isLocalTask ? `/api/task/${encodeURIComponent(taskId)}` : BananaApiParams.endpoint,
        isLocalTask
          ? {
              method: 'GET',
              headers: {
                ...getAuthHeadersForApi(),
              },
            }
          : {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(useAuthStore.getState().accessToken ? { 'Authorization': `Bearer ${useAuthStore.getState().accessToken}` } : {}),
              },
              // 琛ラ綈鍚庣 route.ts 寮烘牎楠岀殑蹇呭～瀛楁锛屽叾涓?model 鎻愪緵涓€涓崰浣嶇浠ラ€氳繃棣栧眰鏍￠獙
              body: JSON.stringify(buildGenerateRequestBody({ taskId, model: 'polling-task', prompt: 'polling', size: '1:1', userId: '' })),
            },
      );

      if (!res.ok) continue;

      const rawText = await res.text();
      if (rawText.startsWith('__ERROR__:')) {
        try {
          const errPayload = JSON.parse(rawText.slice('__ERROR__:'.length));
          throw new Error(toFriendlyBananaErrorMessage(errPayload?.detail || errPayload?.error || '请求失败'));
        } catch {
          throw new Error(toFriendlyBananaErrorMessage('请求失败'));
        }
      }
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(toFriendlyBananaErrorMessage('服务端返回非 JSON 数据'));
      }
      
      // 鍏煎 AITTCO/OneAPI 鍙兘灏嗘暟鎹寘鍦ㄤ竴灞?data 鎴?result 瀵硅薄閲岀殑鎯呭喌
      const payload = (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) 
          ? data.data 
          : (data.result && typeof data.result === 'object' && !Array.isArray(data.result)) 
             ? data.result 
             : data;
      const nestedTaskPayload = (payload?.taskResult && typeof payload.taskResult === 'object')
        ? payload.taskResult
        : ((payload?.taskResponse && typeof payload.taskResponse === 'object') ? payload.taskResponse : null);

      // 澶氶噸鎻愬彇鍥剧墖閫昏緫 (鍏煎 Midjourney銆丟oAmz 鍙婂叾浠栧悇绉嶄腑杞唬鐞嗘牸寮?
      let directUrl: string | undefined = undefined;
      
      // 1. ChatGPT 杞帴寮?(b64_json 鎴?url) - 閫氬父 data.data 浼氭槸涓€涓暟缁?
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const item = data.data[0];
        directUrl = item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url;
      }
      
      // 2. Midjourney 浠ｇ悊鎴?GoAmz OneAPI 鏍峰紡 (鍦ㄦ彁鍙栧嚭鐨?payload 灞傚鎵?
      if (!directUrl) {
        directUrl = payload.url || payload.imageUrl || payload.image_url || payload.image;
      }
      if (!directUrl && nestedTaskPayload) {
        directUrl = nestedTaskPayload.url || nestedTaskPayload.imageUrl || nestedTaskPayload.image_url || nestedTaskPayload.image;
      }

      // 2.1 BLTCY async task result shape: data.data[0].url / b64_json
      if (!directUrl && payload?.data && typeof payload.data === 'object') {
        const nestedItems = Array.isArray(payload.data.data) ? payload.data.data : [];
        if (nestedItems.length > 0) {
          const nestedItem = nestedItems[0];
          if (nestedItem?.b64_json) {
            directUrl = `data:image/png;base64,${nestedItem.b64_json}`;
          } else if (nestedItem?.url) {
            directUrl = nestedItem.url;
          }
        }
      }
      
      // 3. 灏?result 瀛楁鐩存帴浣滀负 url
      if (!directUrl && typeof payload.result === 'string' && (payload.result.startsWith('http') || payload.result.startsWith('data:'))) {
        directUrl = payload.result;
      }

      // 4. Gemini candidates
      if (!directUrl && payload.candidates) {
        const part = payload.candidates[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (part?.inlineData?.data) {
          directUrl = `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      if (!directUrl && nestedTaskPayload?.candidates) {
        const part = nestedTaskPayload.candidates[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (part?.inlineData?.data) {
          directUrl = `data:image/png;base64,${part.inlineData.data}`;
        }
      }

      if (directUrl && typeof directUrl === 'string') return directUrl;
      
      // 鎻愬彇鎴愬姛鎴栧け璐ョ姸鎬佹爣蹇?(涓嶈鍦ㄤ笂灞傜幆澧冮噷杩樻槸 payload 鍐呴儴)
      const statusText = String(payload.status || data.status || '').toUpperCase();
      const isStatusSuccess = ['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'FINISHED'].includes(statusText);
      const isStatusFailed = ['FAILED', 'FAILURE', 'ERROR', 'CANCELED', 'TIMEOUT'].includes(statusText);

      // 鏍稿績鍒ゆ柇锛氬鏋滃畠娌℃湁浼?status 鐘舵€佹爣鏄庡湪鈥滅敓鎴愪腑鈥濓紝鑰岀粰鎴戜滑涓㈣繃鏉ヤ簡鏄庢樉鐨勨€滃ぇ妯″瀷缁堢鍝嶅簲鏍囧織鈥?
      // 姣斿 Gemini 鐨?candidates 鏁扮粍銆丱penAI 鐨?choices 鏁扮粍锛岃鏄庤繖灏卞凡缁忔槸缁撴灉浜嗭紝涓嶈鍐嶇瓑浜?
      const isFinalPayload = !statusText && !!(
        payload.candidates
        || payload.choices
        || payload.url
        || (payload.data && Array.isArray(payload.data))
        || nestedTaskPayload?.candidates
        || nestedTaskPayload?.choices
        || nestedTaskPayload?.url
        || (nestedTaskPayload?.data && Array.isArray(nestedTaskPayload.data))
      );
      
      const isSuccessOrDone = isStatusSuccess || isFinalPayload;

      // 失败状态优先返回后端真实错误，避免被“未解析到图片内容”覆盖
      const errDetail = payload.error
        || payload.fail_reason
        || payload?.data?.fail_reason
        || nestedTaskPayload?.error
        || nestedTaskPayload?.fail_reason
        || nestedTaskPayload?.data?.fail_reason
        || payload.detail
        || data.error
        || data.detail;
      if (isStatusFailed || payload.error || payload.error === 'Task Expired' || data.error || nestedTaskPayload?.error) {
        if (errDetail === 'Task Expired') {
           throw new Error('任务已过期或在服务端集群中迁移，请稍后重试。');
        }
        throw new Error(toFriendlyBananaErrorMessage(typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail) || '异步任务失败'));
      }

      // 濡傛灉宸茬粡琚槑纭爣璁颁负瀹屾垚鎴栧け璐ワ紝鎴栬€呯‘瀹氳繖灏辨槸鏈€缁堟暟鎹寘锛屼絾娌″彇鍒板浘锛岀洿鎺ユ姤閿欓€€鍑烘绛?
      if (isSuccessOrDone && !directUrl) {
         if (isImageSafetyBlocked(payload, data))
           throw new Error('内容触发安全策略，请重写提示词');

         let errMsg = '任务已返回终端数据，但未能解析到图片内容。';
         if (payload.candidates?.[0]?.content?.parts?.[0]?.text) {
             errMsg += `模型返回了文本：\n${payload.candidates[0].content.parts[0].text}`;
         } else if (nestedTaskPayload?.candidates?.[0]?.content?.parts?.[0]?.text) {
             errMsg += `模型返回了文本：\n${nestedTaskPayload.candidates[0].content.parts[0].text}`;
         } else if (payload.choices?.[0]?.message?.content) {
             errMsg += `模型返回了文本：\n${payload.choices[0].message.content}`;
         } else if (nestedTaskPayload?.choices?.[0]?.message?.content) {
             errMsg += `模型返回了文本：\n${nestedTaskPayload.choices[0].message.content}`;
         }
         throw new Error(toFriendlyBananaErrorMessage(errMsg));
      }
      
      // 褰撳浜庡惊鐜腑姣旇緝涔呬笖杩熻繜鎷夸笉鍒版椂锛岃嚦灏戝湪鎺у埗鍙版墦鍗颁竴涓嬪埌搴曡繑鍥炰簡浠€涔堬紝閬垮厤榛戠洅
      if (attempts % 5 === 0) {
        console.log(`[Banana-API] Polling Task ${taskId} (Attempt ${attempts}): rawData=`, JSON.stringify(data).substring(0, 200));
      } else {
        console.log(`[Banana-API] Polling Task ${taskId}: Status=${statusText || 'PROCESSING'}`);
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch')) throw new Error(toFriendlyBananaErrorMessage(e.message));
    }
  }

  throw new Error('生图任务轮询超时，请稍后在历史记录中查看');
}

export async function pollBananaTaskById(
  taskId: string,
  onProgress?: (received: number, total: number) => void,
): Promise<string> {
  return pollBananaTask(taskId, onProgress);
}

export type GrokImagePairResult = {
  taskId: string;
  urls: string[];
  rawUrls: string[];
};

function dedupeUrlsKeepOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const url of urls) {
    const normalized = url.trim();
    if (!normalized || seen.has(normalized))
      continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function extractGrokStandardUrls(data: any): { rawUrls: string[]; urls: string[] } {
  const urlRows = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.data?.data)
      ? data.data.data
      : [];

  const rawUrls = urlRows
    .map((item: any) => (typeof item?.url === 'string' ? item.url : ''))
    .filter((url: string) => !!url);

  return {
    rawUrls,
    urls: dedupeUrlsKeepOrder(rawUrls),
  };
}

function logGrokResponseSnippet(taskId: string, model: string, data: any, urls: string[]) {
  const rawSnippet = JSON.stringify(data)?.slice(0, 500) || '';
  console.warn('[Banana-API][Grok] Response parse fallback', {
    taskId,
    model,
    urls,
    rawSnippet,
  });
}

async function submitGrokTask(
  params: BananaGenerationRequest,
  onTaskId?: (taskId: string) => void,
): Promise<{ taskId?: string; inlineImage?: string }> {
  const url = BananaApiParams.endpoint;
  const requestBody = buildGenerateRequestBody({
    ...params,
    pricingModelId: params.model,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(useAuthStore.getState().accessToken ? { 'Authorization': `Bearer ${useAuthStore.getState().accessToken}` } : {}),
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errorMessage = `HTTP 错误! 状态码: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.detail || errorMessage;
    } catch {
      // ignore parse failure
    }
    throw new Error(errorMessage);
  }

  if (!response.body)
    throw new Error('响应体不可读');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let errorBuffer = '';
  let errorStartFound = false;
  let inlineBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;

    const chunk = decoder.decode(value, { stream: true });

    if (chunk.includes('__ERROR__:') || errorStartFound) {
      errorBuffer += chunk;
      const errorStartIndex = errorBuffer.indexOf('__ERROR__:');
      if (errorStartIndex !== -1) {
        errorStartFound = true;
        const errorJsonPart = errorBuffer.substring(errorStartIndex + 10);
        const endIdx = errorJsonPart.lastIndexOf('}');
        if (endIdx !== -1) {
          const errorData = JSON.parse(errorJsonPart.substring(0, endIdx + 1));
          throw new Error(errorData.detail || errorData.error || '生成图片失败');
        }
      }
      continue;
    }

    const trimmedChunk = chunk.trim();
    if (trimmedChunk.includes('"taskId"') || (trimmedChunk.startsWith('{') && trimmedChunk.includes('sim-'))) {
      try {
        const jsonMatch = trimmedChunk.match(/\{.*\}/s);
        const jsonToParse = jsonMatch ? jsonMatch[0] : trimmedChunk;
        const taskData = JSON.parse(jsonToParse);
        if (taskData?.taskId) {
          const taskId = String(taskData.taskId);
          onTaskId?.(taskId);
          return { taskId };
        }
      } catch {
        // Keep reading stream
      }
    }

    let cleanedChunk = chunk;
    if (cleanedChunk.includes('__BASE64_DATA_START__') || cleanedChunk.includes('__BASE64_DATA_END__'))
      cleanedChunk = cleanedChunk.replace(/__BASE64_DATA_START__|__BASE64_DATA_END__/g, '');

    if (cleanedChunk.trim())
      inlineBuffer += cleanedChunk.trim();
  }

  const normalizedInline = inlineBuffer.replace(/\s+/g, '');
  if (!normalizedInline)
    return {};

  if (normalizedInline.startsWith('http') || normalizedInline.startsWith('data:image'))
    return { inlineImage: normalizedInline };

  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (base64Regex.test(normalizedInline))
    return { inlineImage: `data:image/png;base64,${normalizedInline}` };

  return {};
}

async function pollGrokTaskForUrls(
  taskId: string,
  model: string,
  onProgress?: (received: number, total: number) => void,
): Promise<{ rawUrls: string[]; urls: string[] }> {
  const url = BananaApiParams.endpoint;
  let attempts = 0;
  const maxAttempts = 150;

  while (attempts < maxAttempts) {
    attempts++;
    onProgress?.(Math.min(95, attempts * 1.5), 100);
    await new Promise((r) => setTimeout(r, 4000));

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(useAuthStore.getState().accessToken ? { 'Authorization': `Bearer ${useAuthStore.getState().accessToken}` } : {}),
        },
        body: JSON.stringify(buildGenerateRequestBody({ taskId, model: 'polling-task', prompt: 'polling', size: '1:1', userId: '' })),
      });

      if (!res.ok)
        continue;

      const data = await res.json();
      const { rawUrls, urls } = extractGrokStandardUrls(data);

      if (rawUrls.length > urls.length) {
        console.warn('[Banana-API][Grok] Upstream returned duplicated image urls', {
          taskId,
          model,
          rawUrls,
          dedupedUrls: urls,
        });
      }

      if (urls.length > 0)
        return { rawUrls, urls };

      const statusText = String(data?.status || data?.data?.status || '').toUpperCase();
      const isStatusSuccess = ['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'FINISHED'].includes(statusText);
      const isStatusFailed = ['FAILED', 'FAILURE', 'ERROR', 'CANCELED', 'TIMEOUT'].includes(statusText);
      const errDetail = data?.error || data?.detail || data?.fail_reason || data?.data?.fail_reason;

      if (isStatusSuccess) {
        logGrokResponseSnippet(taskId, model, data, urls);
        throw new Error('任务成功但未从 data.data[*].url 解析到图片');
      }

      if (isStatusFailed) {
        logGrokResponseSnippet(taskId, model, data, urls);
        throw new Error(typeof errDetail === 'string' ? errDetail : '异步任务失败');
      }

      if (attempts % 5 === 0)
        logGrokResponseSnippet(taskId, model, data, urls);
    } catch (e: any) {
      if (e.message && !e.message.includes('fetch'))
        throw e;
    }
  }

  throw new Error('生图任务轮询超时，请稍后在历史记录中查看');
}

export async function pollGrokTaskPairById(
  taskId: string,
  model: string,
  onProgress?: (received: number, total: number) => void,
): Promise<GrokImagePairResult> {
  const polled = await pollGrokTaskForUrls(taskId, model, onProgress);
  return {
    taskId,
    urls: polled.urls,
    rawUrls: polled.rawUrls,
  };
}

export async function generateGrokImagePair(
  params: BananaGenerationRequest,
  onProgress?: (receivedBytes: number, totalBytes: number) => void,
  onTaskId?: (taskId: string) => void,
): Promise<GrokImagePairResult> {
  const submitResult = await submitGrokTask(params, onTaskId);

  if (submitResult.taskId) {
    const taskId = submitResult.taskId;
    const polled = await pollGrokTaskForUrls(taskId, params.model, onProgress);
    if (polled.urls.length === 0)
      throw new Error('未获取到有效图片结果');
    return {
      taskId,
      urls: polled.urls,
      rawUrls: polled.rawUrls,
    };
  }

  if (submitResult.inlineImage) {
    const inlineTaskId = `inline-${Date.now()}`;
    console.warn('[Banana-API][Grok] Upstream returned inline image without taskId', {
      taskId: inlineTaskId,
      model: params.model,
      urls: [submitResult.inlineImage],
    });
    return {
      taskId: inlineTaskId,
      urls: [submitResult.inlineImage],
      rawUrls: [submitResult.inlineImage],
    };
  }

  throw new Error('未获取到有效图片结果');
}

export interface BananaVideoGenerationRequest {
  prompt: string;
  model: string;
  size: string;
  duration?: number;
  hd?: boolean;
  images?: string[];
  options?: Record<string, any>;
}

export interface BananaVideoResult {
  videoUrl: string;
  posterUrl?: string | null;
}

function toPlayableVideoUrl(url?: string | null): string | null {
  const trimmed = String(url || '').trim();
  if (!trimmed)
    return null;
  if (!/^https?:\/\//i.test(trimmed))
    return trimmed;
  return `/api/video/file?url=${encodeURIComponent(trimmed)}`;
}

function extractVideoTaskIdFromResponse(data: any): string | null {
  const taskId = data?.taskId
    || data?.data?.id
    || data?.data?.task_id
    || data?.data?.data?.task_id;
  if (typeof taskId === 'string' && taskId.trim())
    return taskId.trim();
  return null;
}

function extractVideoUrlFromResponse(data: any): string | null {
  const payload = data?.upstream && typeof data.upstream === 'object' ? data.upstream : data;
  const url = payload?.output?.video_url
    || payload?.output?.url
    || (typeof payload?.output === 'string' ? payload.output : null)
    || payload?.video_url
    || payload?.url
    || payload?.data?.output?.video_url
    || payload?.data?.output?.url
    || (typeof payload?.data?.output === 'string' ? payload.data.output : null)
    || payload?.data?.video_url
    || payload?.data?.url;
  if (typeof url === 'string' && url.trim())
    return url.trim();
  return null;
}

function extractVideoPosterUrlFromResponse(data: any): string | null {
  const payload = data?.upstream && typeof data.upstream === 'object' ? data.upstream : data;
  const url = payload?.poster_url
    || payload?.posterUrl
    || payload?.thumbnail_url
    || payload?.thumbnailUrl
    || payload?.cover_url
    || payload?.coverUrl
    || payload?.image_url
    || payload?.imageUrl
    || payload?.data?.poster_url
    || payload?.data?.posterUrl
    || payload?.data?.thumbnail_url
    || payload?.data?.thumbnailUrl
    || payload?.data?.cover_url
    || payload?.data?.coverUrl
    || payload?.data?.image_url
    || payload?.data?.imageUrl;
  if (typeof url === 'string' && url.trim())
    return url.trim();
  return null;
}

function extractVideoStatusFromResponse(data: any): string {
  const payload = data?.upstream && typeof data.upstream === 'object' ? data.upstream : data;
  return String(payload?.status || payload?.data?.status || data?.status || '').trim().toLowerCase();
}

function extractVideoProgressFromResponse(data: any): number {
  const payload = data?.upstream && typeof data.upstream === 'object' ? data.upstream : data;
  const raw = payload?.progress || payload?.data?.progress || data?.progress || 0;
  const cleaned = typeof raw === 'string' ? raw.replace('%', '').trim() : raw;
  const progress = Number(cleaned || 0);
  if (!Number.isFinite(progress))
    return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

async function pollVideoTask(
  taskId: string,
  onProgress?: (received: number, total: number) => void,
): Promise<BananaVideoResult> {
  const maxAttempts = 150;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts += 1;
    onProgress?.(Math.min(95, attempts * 1.5), 100);
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const res = await fetch(`/api/video/task/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        ...getAuthHeadersForApi(),
      },
    });

    if (!res.ok) {
      let msg = `视频任务查询失败: ${res.status}`;
      try {
        const err = await res.json();
        msg = err?.message || err?.detail || msg;
      } catch {}
      throw new Error(msg);
    }

    const data = await res.json();
    const status = extractVideoStatusFromResponse(data);
    const progress = extractVideoProgressFromResponse(data);
    onProgress?.(Math.max(progress, Math.min(99, attempts * 1.5)), 100);

    const videoUrl = extractVideoUrlFromResponse(data) || (typeof data?.video_url === 'string' ? data.video_url : null);
    const isSuccess = ['succeeded', 'completed', 'success'].includes(status);
    const isFailed = ['failed', 'failure', 'error'].includes(status);

    if (videoUrl) {
      onProgress?.(100, 100);
      return {
        videoUrl: toPlayableVideoUrl(videoUrl) || videoUrl,
        posterUrl: extractVideoPosterUrlFromResponse(data),
      };
    }

    if (isFailed) {
      const message = data?.message
        || data?.detail
        || data?.upstream?.fail_reason
        || data?.upstream?.message
        || '视频生成失败';
      throw new Error(String(message));
    }

    if ((progress >= 100 || isSuccess) && !videoUrl) {
      throw new Error('任务进度到达100%但未返回 output/video_url/url');
    }
  }

  throw new Error('视频任务轮询超时，请稍后重试');
}

export async function generateBananaVideoStream(
  params: BananaVideoGenerationRequest,
  onProgress?: (received: number, total: number) => void,
  onTaskId?: (taskId: string) => void,
): Promise<BananaVideoResult> {
  const body = {
    model: normalizeVideoModelId(params.model),
    pricingModelId: params.model,
    prompt: params.prompt,
    size: params.size,
    aspect_ratio: params.size,
    ratio: params.size,
    duration: Number(params.duration || 5),
    hd: Boolean(params.hd),
    images: params.images || [],
    options: params.options || {},
  };

  const res = await fetch('/api/video/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeadersForApi(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `视频任务提交失败: ${res.status}`;
    try {
      const err = await res.json();
      msg = err?.message || err?.detail || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const directVideoUrl = extractVideoUrlFromResponse(data) || (typeof data?.video_url === 'string' ? data.video_url : null);
  if (directVideoUrl) {
    onProgress?.(100, 100);
    return {
      videoUrl: toPlayableVideoUrl(directVideoUrl) || directVideoUrl,
      posterUrl: extractVideoPosterUrlFromResponse(data),
    };
  }

  const taskId = extractVideoTaskIdFromResponse(data);
  if (!taskId)
    throw new Error('中转站未返回 taskId 或 video_url');

  onTaskId?.(taskId);
  return await pollVideoTask(taskId, onProgress);
}

export async function pollVideoTaskById(
  taskId: string,
  onProgress?: (received: number, total: number) => void,
): Promise<BananaVideoResult> {
  return pollVideoTask(taskId, onProgress);
}

/**
 * 鎻愮ず璇嶄紭鍖?
 */
export type BananaPromptOptimizationOption = {
  style: string;
  prompt: string;
};

export type BananaDescribeImageResult = {
  analysis: string;
  plainPrompt: string;
  jsonPrompt: string;
  model?: string;
  coinCost?: number;
  outputLanguage?: string;
};

export type BananaPromptOutputLanguage = 'zh-CN' | 'en' | 'ko' | 'es' | 'la';

/**
 * 提示词优化（固定模型：gemini-3-pro-preview，计费：3金币/次）
 */
export async function optimizeBananaPrompt(prompt: string): Promise<BananaPromptOptimizationOption[]> {
  let response: Response;
  try {
    response = await fetch(BananaApiParams.optimizeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeadersForApi(),
      },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError')
      throw new Error('提示词优化请求超时，请稍后重试。');
    throw new Error(error?.message || '提示词优化请求失败');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401)
      throw new Error('登录状态已失效，请刷新页面后重试。');
    throw new Error(data?.error || data?.message || '提示词优化失败');
  }

  const options = Array.isArray(data?.options) ? data.options : [];
  return options
    .map((item: any) => ({
      style: String(item?.style || item?.version_name || '').trim(),
      prompt: String(item?.prompt || '').trim(),
    }))
    .filter((item: BananaPromptOptimizationOption) => !!item.prompt)
    .slice(0, 3);
}

/**
 * 图片逆推提示词（固定模型：gemini-3-pro-preview，计费：3金币/次）
 */
export async function describeBananaImage(
  image: string,
  outputLanguage: BananaPromptOutputLanguage = 'zh-CN',
): Promise<BananaDescribeImageResult> {
  let response: Response;
  try {
    response = await fetch(BananaApiParams.describeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeadersForApi(),
      },
      body: JSON.stringify({ image, outputLanguage }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError')
      throw new Error('图片逆推请求超时，请稍后重试。');
    throw new Error(error?.message || '图片逆推请求失败');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401)
      throw new Error('登录状态已失效，请刷新页面后重试。');
    throw new Error(data?.error || data?.message || '图片逆推失败');
  }

  const analysis = String(data?.analysis || '').trim();
  const plainPrompt = String(data?.plainPrompt || data?.plain_prompt || '').trim();
  const jsonPrompt = typeof data?.jsonPrompt === 'string'
    ? data.jsonPrompt.trim()
    : JSON.stringify(data?.jsonPrompt || {}, null, 2);

  return {
    analysis,
    plainPrompt,
    jsonPrompt,
    model: data?.model,
    coinCost: typeof data?.coinCost === 'number' ? data.coinCost : undefined,
    outputLanguage: typeof data?.outputLanguage === 'string' ? data.outputLanguage : outputLanguage,
  };
}
export async function checkBananaBalance(apiKey: string): Promise<BananaBalanceResponse> {
  const headers = { 'Authorization': `Bearer ${apiKey}` };
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const subRes = await fetch(`${BananaApiParams.balanceEndpoint}/subscription`, { headers });
  const usageRes = await fetch(`${BananaApiParams.balanceEndpoint}/usage?start_date=${startOfMonth}&end_date=${endDate}`, { headers });

  if (!subRes.ok || !usageRes.ok) throw new Error('查询失败');

  return {
    subscription: await subRes.json(),
    usage: await usageRes.json(),
  };
}
