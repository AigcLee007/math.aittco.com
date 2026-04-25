import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '~/server/auth/jwt';
import { checkBalance, releaseReservedCoins, reserveCoins, settleReservedCoins } from '~/server/services/coin.service';
import { buildGeminiGenerateContentUrl, resolvePromptModelRoute } from '~/server/services/model-route.service';

export const runtime = 'nodejs';
export const maxDuration = 900;

const LLM_MODEL = 'gemini-3-pro-preview';
const TOOL_COIN_COST = 3;

type PromptOption = {
  style: string;
  prompt: string;
};

function createReservationKey(userId: string): string {
  return `tool:optimize-prompt:${userId}:${Date.now()}:${randomUUID().slice(0, 8)}`;
}

function readAuthPayload(req: NextRequest): { userId: string } | null {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload?.userId)
    return null;
  return { userId: payload.userId };
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

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function buildFallbackOptions(prompt: string): PromptOption[] {
  const zh = hasChinese(prompt);
  return zh
    ? [
      {
        style: '专业构图版',
        prompt: `${prompt}\n\n要求：主体明确，构图稳定，空间层次清晰，细节真实，光影自然，适合高质量生图。`,
      },
      {
        style: '电影质感版',
        prompt: `${prompt}\n\n要求：电影级光影与镜头语言，氛围感明确，材质细节写实，画面统一且有视觉张力。`,
      },
      {
        style: '商业海报版',
        prompt: `${prompt}\n\n要求：视觉冲击力强，主体突出，色彩协调，细节丰富，适合高质量商业展示。`,
      },
    ]
    : [
      {
        style: 'Professional Composition',
        prompt: `${prompt}\n\nRequirements: clear subject, strong composition, layered depth, realistic details, natural lighting, high-quality rendering.`,
      },
      {
        style: 'Cinematic Quality',
        prompt: `${prompt}\n\nRequirements: cinematic lighting and lens language, coherent atmosphere, realistic material details, consistent high-end visuals.`,
      },
      {
        style: 'Commercial Poster',
        prompt: `${prompt}\n\nRequirements: high visual impact, strong subject focus, balanced color palette, rich details, premium commercial-grade output.`,
      },
    ];
}

function normalizeOptions(raw: any, originalPrompt: string): PromptOption[] {
  const list = Array.isArray(raw?.options) ? raw.options : [];
  const normalized = list
    .map((item: any) => ({
      style: String(item?.version_name || item?.style || '').trim(),
      prompt: String(item?.prompt || '').trim(),
    }))
    .filter((item: PromptOption) => !!item.prompt)
    .slice(0, 3);

  if (!normalized.length)
    return buildFallbackOptions(originalPrompt);

  while (normalized.length < 3) {
    normalized.push({
      style: `${normalized[0].style || '优化版本'} ${normalized.length + 1}`,
      prompt: normalized[0].prompt,
    });
  }
  return normalized;
}

export async function POST(req: NextRequest) {
  const auth = readAuthPayload(req);
  if (!auth)
    return NextResponse.json({ error: '请先登录后再使用提示词优化。' }, { status: 401 });

  let reservationKey = '';

  try {
    const { prompt } = await req.json();
    const inputPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    if (!inputPrompt)
      return NextResponse.json({ error: '请输入需要优化的提示词。' }, { status: 400 });

    const { isEnough } = await checkBalance(auth.userId, TOOL_COIN_COST);
    if (!isEnough)
      return NextResponse.json({ error: `余额不足，提示词优化需要 ${TOOL_COIN_COST} 金币。` }, { status: 402 });

    reservationKey = createReservationKey(auth.userId);
    await reserveCoins(auth.userId, TOOL_COIN_COST, LLM_MODEL, reservationKey, '提示词优化预扣');

    const route = await resolvePromptModelRoute(LLM_MODEL);
    const targetUrl = buildGeminiGenerateContentUrl(route, route.upstreamModel);
    const payload = {
      contents: [{
        parts: [{
          text:
            `用户原始提示词：\n${inputPrompt}\n\n` +
            '请输出 3 个不同方向的专业优化版本，供 Nano Banana Pro 生图使用。',
        }],
      }],
      systemInstruction: {
        parts: [{
          text:
            '你是顶级 AI 生图提示词工程师。请准确理解用户意图，给出三版高质量提示词。' +
            '必须保持与用户输入同语言：中文输入则输出全中文，英文输入则输出全英文。' +
            '每个版本需要覆盖主体、场景、构图、镜头、光影、材质细节、风格与质量要求。' +
            '严格只返回 JSON：' +
            '{"options":[{"version_name":"版本1","prompt":"..."},{"version_name":"版本2","prompt":"..."},{"version_name":"版本3","prompt":"..."}]}',
        }],
      },
      generationConfig: { temperature: 0.7 },
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });

    const responseText = await response.text();
    if (!response.ok) {
      await releaseReservedCoins(reservationKey, `提示词优化失败: ${response.status}`);
      reservationKey = '';
      return NextResponse.json({
        error: '提示词优化失败，请稍后重试。',
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

    const parsed = parseJsonFromText(modelText);
    const options = normalizeOptions(parsed, inputPrompt);

    await settleReservedCoins(reservationKey, `提示词优化消费: ${LLM_MODEL}`);
    reservationKey = '';

    return NextResponse.json({
      options,
      model: LLM_MODEL,
      coinCost: TOOL_COIN_COST,
    });
  } catch (error: any) {
    if (reservationKey)
      await releaseReservedCoins(reservationKey, error?.message || '提示词优化异常');
    return NextResponse.json({ error: error?.message || '提示词优化失败' }, { status: 500 });
  }
}
