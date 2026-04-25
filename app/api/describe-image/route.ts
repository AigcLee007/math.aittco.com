import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '~/server/auth/jwt';
import { checkBalance, releaseReservedCoins, reserveCoins, settleReservedCoins } from '~/server/services/coin.service';
import { buildGeminiGenerateContentUrl, resolvePromptModelRoute } from '~/server/services/model-route.service';

export const runtime = 'nodejs';
export const maxDuration = 900;

const LLM_MODEL = 'gemini-3-pro-preview';
const TOOL_COIN_COST = 3;
const SUPPORTED_OUTPUT_LANGUAGES = ['zh-CN', 'en', 'ko', 'es', 'la'] as const;
type SupportedOutputLanguage = typeof SUPPORTED_OUTPUT_LANGUAGES[number];

type DescribeImageResponse = {
  analysis: string;
  plainPrompt: string;
  jsonPrompt: string;
};

function normalizeOutputLanguage(value: unknown): SupportedOutputLanguage {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return (SUPPORTED_OUTPUT_LANGUAGES as readonly string[]).includes(normalized)
    ? normalized as SupportedOutputLanguage
    : 'zh-CN';
}

function getOutputLanguageInstruction(language: SupportedOutputLanguage): string {
  switch (language) {
    case 'en': return 'English';
    case 'ko': return 'Korean';
    case 'es': return 'Spanish';
    case 'la': return 'Latin';
    case 'zh-CN':
    default:
      return 'Simplified Chinese';
  }
}

function createReservationKey(userId: string): string {
  return `tool:describe-image:${userId}:${Date.now()}:${randomUUID().slice(0, 8)}`;
}

function readAuthPayload(req: NextRequest): { userId: string } | null {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload?.userId)
    return null;
  return { userId: payload.userId };
}

function extractImagePayload(image: string): { mimeType: string; base64Data: string } {
  const trimmed = image.trim();
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/);

  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1] || 'image/jpeg',
      base64Data: dataUrlMatch[2],
    };
  }

  return {
    mimeType: 'image/jpeg',
    base64Data: trimmed.includes('base64,') ? trimmed.split('base64,')[1] : trimmed,
  };
}

function stripMarkdownCodeFence(text: string): string {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function parseJsonFromText(text: string): any | null {
  const stripped = stripMarkdownCodeFence(text);
  if (!stripped)
    return null;

  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match)
      return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeDescribeResult(modelText: string): DescribeImageResponse {
  const parsed = parseJsonFromText(modelText);
  const plainPromptRaw = parsed?.plain_prompt || parsed?.plainPrompt || parsed?.prompt || modelText || '';
  const plainPrompt = String(plainPromptRaw || '').trim() || '请根据图片内容生成高质量生图提示词。';

  const jsonPromptRaw = parsed?.json_prompt || parsed?.jsonPrompt || {
    subject: plainPrompt,
    style: 'high detail',
    quality: 'high',
  };
  const jsonPrompt = typeof jsonPromptRaw === 'string'
    ? jsonPromptRaw.trim()
    : JSON.stringify(jsonPromptRaw, null, 2);

  const analysisRaw = parsed?.analysis || parsed?.analysis_text || parsed?.analysisText || '';
  const analysis = typeof analysisRaw === 'string'
    ? analysisRaw.trim()
    : JSON.stringify(analysisRaw || {}, null, 2);

  return {
    analysis: analysis || '已完成图像解析并生成提示词。',
    plainPrompt,
    jsonPrompt,
  };
}

export async function POST(req: NextRequest) {
  const auth = readAuthPayload(req);
  if (!auth)
    return NextResponse.json({ error: '请先登录后再使用图片逆推。' }, { status: 401 });

  let reservationKey = '';

  try {
    const { image, outputLanguage } = await req.json();
    const imageInput = typeof image === 'string' ? image.trim() : '';
    if (!imageInput)
      return NextResponse.json({ error: '请先上传一张图片。' }, { status: 400 });
    const normalizedOutputLanguage = normalizeOutputLanguage(outputLanguage);
    const outputLanguageInstruction = getOutputLanguageInstruction(normalizedOutputLanguage);

    const { isEnough } = await checkBalance(auth.userId, TOOL_COIN_COST);
    if (!isEnough)
      return NextResponse.json({ error: `余额不足，图片逆推需要 ${TOOL_COIN_COST} 金币。` }, { status: 402 });

    reservationKey = createReservationKey(auth.userId);
    await reserveCoins(auth.userId, TOOL_COIN_COST, LLM_MODEL, reservationKey, '图片逆推预扣');

    const route = await resolvePromptModelRoute(LLM_MODEL);
    const targetUrl = buildGeminiGenerateContentUrl(route, route.upstreamModel);
    const { mimeType, base64Data } = extractImagePayload(imageInput);

    const payload = {
      contents: [{
        parts: [
          {
            text:
              '请从专业角度分析这张图片，并输出可用于 Nano Banana Pro 生图的提示词。' +
              `所有字段内容请使用 ${outputLanguageInstruction}。` +
              '严格只返回 JSON：' +
              '{"analysis":"...","plain_prompt":"...","json_prompt":{"subject":"...","style":"...","composition":"...","lighting":"...","camera":"...","color":"...","quality_tags":["..."],"negative_prompt":"..."}}',
          },
          { inlineData: { mimeType, data: base64Data } },
        ],
      }],
      systemInstruction: {
        parts: [{
            text:
            '你是资深视觉总监与提示词工程师。先分析主体、构图、光线、色彩、风格、镜头、材质细节，再输出生图提示词。' +
            `输出字段内容必须全部使用 ${outputLanguageInstruction}。` +
            '输出必须是合法 JSON，不要输出额外解释。',
        }],
      },
      generationConfig: { temperature: 0.6 },
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });

    const responseText = await response.text();
    if (!response.ok) {
      await releaseReservedCoins(reservationKey, `图片逆推失败: ${response.status}`);
      reservationKey = '';
      return NextResponse.json({
        error: '图片逆推失败，请稍后重试。',
        detail: responseText.slice(0, 500),
      }, { status: response.status });
    }

    let modelText = '';
    try {
      const data = JSON.parse(responseText);
      modelText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch {
      modelText = '';
    }

    const normalized = normalizeDescribeResult(modelText);
    await settleReservedCoins(reservationKey, `图片逆推消费: ${LLM_MODEL}`);
    reservationKey = '';

    return NextResponse.json({
      ...normalized,
      model: LLM_MODEL,
      coinCost: TOOL_COIN_COST,
      outputLanguage: normalizedOutputLanguage,
    });
  } catch (error: any) {
    if (reservationKey)
      await releaseReservedCoins(reservationKey, error?.message || '图片逆推异常');
    return NextResponse.json({ error: error?.message || '图片逆推失败' }, { status: 500 });
  }
}
