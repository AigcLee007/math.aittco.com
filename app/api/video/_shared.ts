import { env } from '~/server/env.server';

export const VIDEO_PROXY_BASE = 'https://api.bltcy.ai';
const DEFAULT_VIDEO_API_KEY = 'sk-FmUQ0IlPza9U4Y14V9dPXo48jNZEevRiSldAV2By2RYJ4Ek9';

export const VIDEO_MODEL_ALIAS: Record<string, string> = {
  'veo3.1-4k': 'veo3.1-fast-4K',
  'veo3.1-components-4k': 'veo3.1-fast-components-4K',
};

const VEO_MODELS = new Set([
  'veo3.1',
  'veo3.1-fast',
  'veo3.1-components',
  'veo3.1-pro',
]);

const VEO_FIRST_LAST_MODELS = new Set([
  'veo3.1',
  'veo3.1-fast',
  'veo3.1-pro',
]);

const VEO_COMPONENT_MODELS = new Set([
  'veo3.1-components',
]);

const GROK_VIDEO_MODELS = new Set(['grok-video-3']);

export function normalizeVideoModelId(modelId?: string): string {
  const normalized = String(modelId || '').trim();
  if (!normalized)
    return normalized;
  return VIDEO_MODEL_ALIAS[normalized] || normalized;
}

export function isVeoModel(modelId?: string): boolean {
  return VEO_MODELS.has(normalizeVideoModelId(modelId));
}

export function isVeoFirstLastModel(modelId?: string): boolean {
  return VEO_FIRST_LAST_MODELS.has(normalizeVideoModelId(modelId));
}

export function isVeoComponentsModel(modelId?: string): boolean {
  return VEO_COMPONENT_MODELS.has(normalizeVideoModelId(modelId));
}

export function isGrokVideoModel(modelId?: string): boolean {
  return GROK_VIDEO_MODELS.has(normalizeVideoModelId(modelId));
}

export function normalizeAspectRatio(value?: string): string {
  const normalized = String(value || '16:9').trim();
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
  return supported.has(normalized) ? normalized : '16:9';
}

function normalizeVideoAspectRatio(value?: string): string {
  const ratio = normalizeAspectRatio(value);
  if (ratio === '9:16')
    return '9:16';
  return '16:9';
}

export function normalizeDuration(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    return 5;
  return Math.round(n);
}

export function getVideoApiKey(): string {
  return (process.env.NANO_BANANA_LINE2_API_KEY || env.NANO_BANANA_LINE2_API_KEY || env.BLTCY_API_KEY || DEFAULT_VIDEO_API_KEY).trim();
}

export function extractVideoTaskId(data: any): string | null {
  const taskId = data?.id
    || data?.task_id
    || data?.taskId
    || data?.name
    || data?.operation_id
    || data?.operationId
    || data?.data?.id
    || data?.data?.task_id
    || data?.data?.taskId
    || data?.data?.name
    || data?.data?.operation_id
    || data?.data?.operationId
    || data?.data?.data?.task_id;

  if (typeof taskId === 'string' && taskId.trim())
    return taskId.trim();
  return null;
}

function tryBuildInlineVideoDataUrl(obj: any): string | null {
  const mimeType = obj?.mimeType || obj?.mime_type || obj?.type;
  const data = obj?.data || obj?.base64 || obj?.b64;
  if (typeof data !== 'string' || !data.trim())
    return null;

  const mt = typeof mimeType === 'string' && mimeType.trim()
    ? mimeType.trim()
    : 'video/mp4';
  return `data:${mt};base64,${data.trim()}`;
}

function scanForVideoUrl(value: any, depth = 0): string | null {
  if (!value || depth > 6)
    return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed)
      return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:video/'))
      return trimmed;
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = scanForVideoUrl(item, depth + 1);
      if (hit)
        return hit;
    }
    return null;
  }

  if (typeof value === 'object') {
    const inline = tryBuildInlineVideoDataUrl(value?.inlineData || value?.inline_data);
    if (inline)
      return inline;

    const directCandidates = [
      value?.video_url,
      value?.videoUrl,
      value?.url,
      value?.uri,
      value?.file_uri,
      value?.fileUri,
      value?.video_uri,
      value?.videoUri,
      value?.fileData?.uri,
      value?.fileData?.fileUri,
      value?.file_data?.uri,
      value?.file_data?.file_uri,
    ];

    for (const candidate of directCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const trimmed = candidate.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:video/'))
          return trimmed;
      }
    }

    for (const item of Object.values(value)) {
      const hit = scanForVideoUrl(item, depth + 1);
      if (hit)
        return hit;
    }
  }

  return null;
}

export function extractVideoUrl(data: any): string | null {
  const fromOutput = data?.output?.video_url
    || data?.output?.url
    || (typeof data?.output === 'string' ? data.output : null)
    || data?.data?.output?.video_url
    || data?.data?.output?.url
    || (typeof data?.data?.output === 'string' ? data.data.output : null);
  if (typeof fromOutput === 'string' && fromOutput.trim())
    return fromOutput.trim();

  const direct = data?.video_url
    || data?.url
    || data?.data?.video_url
    || data?.data?.url;
  if (typeof direct === 'string' && direct.trim())
    return direct.trim();

  const fromCandidates = scanForVideoUrl(data?.candidates)
    || scanForVideoUrl(data?.data?.candidates);
  if (typeof fromCandidates === 'string' && fromCandidates.trim())
    return fromCandidates.trim();

  const deepScan = scanForVideoUrl(data);
  if (typeof deepScan === 'string' && deepScan.trim())
    return deepScan.trim();

  return null;
}

function scanForPosterUrl(value: any, depth = 0): string | null {
  if (!value || depth > 6)
    return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/'))
      return trimmed;
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = scanForPosterUrl(item, depth + 1);
      if (hit)
        return hit;
    }
    return null;
  }

  if (typeof value === 'object') {
    const directCandidates = [
      value?.poster_url,
      value?.posterUrl,
      value?.thumbnail_url,
      value?.thumbnailUrl,
      value?.cover_url,
      value?.coverUrl,
      value?.image_url,
      value?.imageUrl,
      value?.snapshot_url,
      value?.snapshotUrl,
    ];

    for (const candidate of directCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const trimmed = candidate.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/'))
          return trimmed;
      }
    }

    for (const item of Object.values(value)) {
      const hit = scanForPosterUrl(item, depth + 1);
      if (hit)
        return hit;
    }
  }

  return null;
}

export function extractVideoPosterUrl(data: any): string | null {
  const direct = data?.poster_url
    || data?.posterUrl
    || data?.thumbnail_url
    || data?.thumbnailUrl
    || data?.cover_url
    || data?.coverUrl
    || data?.image_url
    || data?.imageUrl
    || data?.data?.poster_url
    || data?.data?.posterUrl
    || data?.data?.thumbnail_url
    || data?.data?.thumbnailUrl
    || data?.data?.cover_url
    || data?.data?.coverUrl
    || data?.data?.image_url
    || data?.data?.imageUrl;

  if (typeof direct === 'string' && direct.trim())
    return direct.trim();

  return scanForPosterUrl(data);
}

export function extractVideoStatus(data: any): string {
  return String(
    data?.status
    || data?.data?.status
    || data?.output?.status
    || data?.data?.output?.status
    || '',
  ).trim().toLowerCase();
}

export function extractVideoProgress(data: any): number {
  const raw = (
    data?.progress
    || data?.data?.progress
    || data?.output?.progress
    || data?.data?.output?.progress
  );
  const cleaned = typeof raw === 'string' ? raw.replace('%', '').trim() : raw;
  const n = Number(cleaned || 0);
  if (!Number.isFinite(n))
    return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function buildVideoGeneratePayload(input: {
  model: string;
  prompt: string;
  aspect_ratio?: string;
  duration?: number;
  hd?: boolean;
  images?: string[];
  options?: Record<string, any>;
}): Record<string, any> {
  const model = normalizeVideoModelId(input.model);
  const prompt = String(input.prompt || '').trim();
  const aspectRatio = normalizeVideoAspectRatio(input.aspect_ratio);
  const duration = normalizeDuration(input.duration);
  const images = Array.isArray(input.images) ? input.images.filter((v) => typeof v === 'string' && !!v.trim()) : [];
  const firstImage = images[0];
  const secondImage = images[1];

  if (isVeoModel(model)) {
    const is4k = model === 'veo3.1-pro';
    const inputConfig: Record<string, any> = {
      aspect_ratio: aspectRatio,
      duration,
      generate_audio: true,
      resolution: is4k ? '4k' : '1080p',
    };

    const payload: Record<string, any> = {
      model,
      prompt,
      input_config: inputConfig,
      aspect_ratio: aspectRatio,
      ratio: aspectRatio,
    };

    if (firstImage) {
      payload.image = firstImage;
      inputConfig.image = firstImage;
    }

    if (isVeoFirstLastModel(model) && secondImage) {
      payload.last_frame = secondImage;
      payload.images = [firstImage, secondImage].filter(Boolean);
      inputConfig.last_frame = secondImage;
    } else if (isVeoComponentsModel(model) && images.length > 1) {
      payload.images = images.slice(0, 3);
    }

    return payload;
  }

  if (isGrokVideoModel(model)) {
    const hd = Boolean(input.hd);
    const payload: Record<string, any> = {
      model,
      prompt,
      ratio: aspectRatio,
      duration,
      resolution: hd ? '1080P' : '720P',
    };
    if (images.length > 0)
      payload.images = images.slice(0, 3);
    return payload;
  }

  const payload: Record<string, any> = {
    model,
    prompt,
    ...(input.options || {}),
  };
  if (firstImage)
    payload.image = firstImage;
  return payload;
}
