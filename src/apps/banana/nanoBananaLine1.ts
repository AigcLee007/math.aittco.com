function normalizeModelId(modelId?: string): string {
  return (modelId || '').trim().replace(/^models\//i, '').toLowerCase();
}

export const NANO_BANANA_PRO_LINE1_MODEL_ID = 'gemini-3-pro-image-preview';
export const NANO_BANANA_PRO_LINE2_MODEL_ID = 'nano-banana-2';
export const NANO_BANANA_2_LINE1_MODEL_ID = 'gemini-3.1-flash-image-preview';
export const NANO_BANANA_PRO_VIP_MODEL_ID = 'nano-banana-2-vip';
export const NANO_BANANA_2_VIP_MODEL_ID = 'gemini-3.1-flash-image-preview-vip';

export const NANO_BANANA_PRO_LINE1_LABEL = 'Nano Banana Pro\uFF08\u7EBF\u8DEF\u4E00\uFF09';
export const NANO_BANANA_PRO_LINE2_LABEL = 'Nano Banana Pro\uFF08\u7EBF\u8DEF\u4E8C\uFF09';
export const NANO_BANANA_2_LINE1_LABEL = 'Nano Banana 2\uFF08\u7EBF\u8DEF\u4E00\uFF09';
export const NANO_BANANA_PRO_VIP_LABEL = 'Nano Banana Pro(vip)';
export const NANO_BANANA_2_VIP_LABEL = 'Nano Banana 2(vip)';

const NANO_BANANA_LINE1_SIZE_MODEL_MAP = {
  '1k': 'nano-banana-2',
  '2k': 'nano-banana-2-2k',
  '4k': 'nano-banana-2-4k',
} as const;

const NANO_BANANA_2_VIP_SIZE_MODEL_MAP = {
  '1k': 'gemini-3.1-flash-image-preview',
  '2k': 'gemini-3.1-flash-image-preview-2k',
  '4k': 'gemini-3.1-flash-image-preview-4k',
} as const;

export type NanoBananaLine1SizeToken = keyof typeof NANO_BANANA_LINE1_SIZE_MODEL_MAP;

export function normalizeNanoBananaLine1SizeToken(size?: string): NanoBananaLine1SizeToken {
  const normalized = (size || '1k').trim().toLowerCase();
  if (normalized === '2k')
    return '2k';
  if (normalized === '4k')
    return '4k';
  return '1k';
}

export function mapNanoBananaLine1SizeToModel(size?: string): string {
  return NANO_BANANA_LINE1_SIZE_MODEL_MAP[normalizeNanoBananaLine1SizeToken(size)];
}

export function mapNanoBanana2VipSizeToModel(size?: string): string {
  return NANO_BANANA_2_VIP_SIZE_MODEL_MAP[normalizeNanoBananaLine1SizeToken(size)];
}

export function isNanoBananaProLine1Model(modelId?: string): boolean {
  const normalized = normalizeModelId(modelId);
  return normalized === NANO_BANANA_PRO_LINE1_MODEL_ID
    || normalized === 'nano-banana-pro'
    || normalized === 'nano-banana-pro-preview';
}

export function isNanoBananaProLine2Model(modelId?: string): boolean {
  return normalizeModelId(modelId) === NANO_BANANA_PRO_LINE2_MODEL_ID;
}

export function isDedicatedNanoBananaModel(modelId?: string): boolean {
  return isNanoBananaProLine1Model(modelId) || isNanoBananaProLine2Model(modelId);
}

export function isNanoBananaProVipModel(modelId?: string): boolean {
  return normalizeModelId(modelId) === NANO_BANANA_PRO_VIP_MODEL_ID;
}

export function isNanoBanana2VipModel(modelId?: string): boolean {
  return normalizeModelId(modelId) === NANO_BANANA_2_VIP_MODEL_ID;
}

export function isNanoBanana2Line1Model(modelId?: string): boolean {
  const normalized = normalizeModelId(modelId);
  return normalized === NANO_BANANA_2_LINE1_MODEL_ID
    || normalized === `${NANO_BANANA_2_LINE1_MODEL_ID}-2k`
    || normalized === `${NANO_BANANA_2_LINE1_MODEL_ID}-4k`;
}

export function getNanoBananaDisplayLabel(modelId: string, fallbackLabel?: string): string {
  if (isNanoBananaProLine1Model(modelId))
    return NANO_BANANA_PRO_LINE1_LABEL;
  if (isNanoBananaProLine2Model(modelId))
    return NANO_BANANA_PRO_LINE2_LABEL;
  if (isNanoBanana2Line1Model(modelId))
    return NANO_BANANA_2_LINE1_LABEL;
  if (isNanoBananaProVipModel(modelId))
    return NANO_BANANA_PRO_VIP_LABEL;
  if (isNanoBanana2VipModel(modelId))
    return NANO_BANANA_2_VIP_LABEL;
  return fallbackLabel || modelId;
}

export function getNanoBananaCanvasModelLabel(modelId?: string): string {
  const normalized = normalizeModelId(modelId);

  if (
    normalized === 'nano-banana-2'
    || normalized === 'nano-banana-2-2k'
    || normalized === 'nano-banana-2-4k'
    || normalized === NANO_BANANA_PRO_LINE1_MODEL_ID
  ) {
    return 'nano-banana-pro';
  }

  if (
    normalized === NANO_BANANA_PRO_VIP_MODEL_ID
    || normalized === `${NANO_BANANA_PRO_VIP_MODEL_ID}-2k`
    || normalized === `${NANO_BANANA_PRO_VIP_MODEL_ID}-4k`
  ) {
    return 'nano-banana-pro-vip';
  }

  if (
    normalized === NANO_BANANA_2_VIP_MODEL_ID
    || normalized === `${NANO_BANANA_2_VIP_MODEL_ID}-2k`
    || normalized === `${NANO_BANANA_2_VIP_MODEL_ID}-4k`
  ) {
    return 'nano-banana-2-vip';
  }

  return modelId || 'unknown';
}

export function appendAspectRatioFlag(prompt: string, aspectRatio: string): string {
  const trimmedPrompt = prompt.trim();
  const trimmedAspectRatio = (aspectRatio || '1:1').trim();
  if (!trimmedPrompt)
    return '--ar ' + trimmedAspectRatio;
  if (/--ar\s+\d+:\d+/i.test(trimmedPrompt))
    return trimmedPrompt;
  return trimmedPrompt + ' --ar ' + trimmedAspectRatio;
}
