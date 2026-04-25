import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '~/server/auth/jwt';
import { createGenerateLog, finalizeGenerateLog } from '~/server/services/generate-log.service';
import {
  createRelayAuthHeaders,
  decodeRelayTaskId,
  getRelayRouteById,
} from '~/server/services/model-route.service';
import {
  extractVideoProgress,
  extractVideoStatus,
  extractVideoUrl,
} from '../../_shared';

export const runtime = 'nodejs';
export const maxDuration = 900;

function parseJson(text: string): any {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload?.userId)
    return NextResponse.json({ message: '请先登录', detail: '请先登录' }, { status: 401 });

  const params = await context.params;
  const rawTaskId = decodeURIComponent(params.taskId || '').trim();
  let requestLogId: string | null = null;

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
      console.warn('[video/task] finalize log failed', logError);
    }
  };

  try {
    requestLogId = await createGenerateLog({
      userId: payload.userId,
      endpoint: '/api/video/task/:taskId',
      phase: 'POLL',
      model: 'polling-task',
      prompt: 'polling',
      taskId: rawTaskId,
      batch: 1,
      imagesCount: 0,
      requestPayload: {
        taskId: rawTaskId,
        path: req.nextUrl.pathname,
      },
    });
  } catch (logError) {
    console.warn('[video/task] create log failed', logError);
  }

  if (!rawTaskId) {
    await finalizeLogIfNeeded('ERROR', { message: 'taskId invalid' }, 400, 'taskId invalid');
    return NextResponse.json({ message: 'taskId 无效', detail: 'taskId 无效' }, { status: 400 });
  }

  const decoded = decodeRelayTaskId(rawTaskId);
  const routeId = decoded?.routeId || 'bltcy';
  const upstreamTaskId = decoded?.upstreamTaskId || rawTaskId;

  const route = await getRelayRouteById(routeId);
  const targetUrl = `${route.baseUrl}/v2/videos/generations/${encodeURIComponent(upstreamTaskId)}`;

  const upstreamRes = await fetch(targetUrl, {
    method: 'GET',
    headers: createRelayAuthHeaders(route),
    signal: AbortSignal.timeout(600_000),
  });

  const text = await upstreamRes.text();
  const data = parseJson(text);
  if (!upstreamRes.ok) {
    const message = data?.error?.message || data?.message || data?.detail || text || '视频任务查询失败';
    await finalizeLogIfNeeded('ERROR', { upstream: data }, upstreamRes.status, message);
    return NextResponse.json({ message, detail: message, upstream: data }, { status: upstreamRes.status });
  }

  const status = extractVideoStatus(data);
  const progress = extractVideoProgress(data);
  const url = extractVideoUrl(data);
  const success = ['succeeded', 'completed', 'success'].includes(status);
  const failed = ['failed', 'failure', 'error'].includes(status);

  if (failed) {
    const reason = data?.fail_reason
      || data?.data?.fail_reason
      || data?.message
      || data?.detail
      || '视频生成失败';

    const failedPayload = {
      status: 'failed',
      progress,
      message: reason,
      detail: reason,
      upstream: data,
    };
    await finalizeLogIfNeeded('FAILED', failedPayload, 200, reason);
    return NextResponse.json(failedPayload);
  }

  if ((success || progress >= 100) && !url) {
    const failedPayload = {
      status: 'failed',
      progress,
      message: '任务进度到达100%但未返回视频地址',
      detail: '任务进度到达100%但未返回 output/video_url/url',
      upstream: data,
    };
    await finalizeLogIfNeeded('FAILED', failedPayload, 200, 'missing output/video_url/url');
    return NextResponse.json(failedPayload);
  }

  const okPayload = {
    status,
    progress,
    video_url: url || undefined,
    failed,
    success,
    upstream: data,
  };

  if (success && url)
    await finalizeLogIfNeeded('SUCCESS', okPayload, 200);
  else
    await finalizeLogIfNeeded('PROCESSING', okPayload, 200);

  return NextResponse.json(okPayload);
}
