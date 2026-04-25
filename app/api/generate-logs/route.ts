import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '~/server/auth/jwt';
import { listRecentGenerateLogs } from '~/server/services/generate-log.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const payload = token ? verifyAccessToken(token) : null;

  if (!payload?.userId)
    return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const rawLimit = Number(req.nextUrl.searchParams.get('limit') || 10);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 10;
  const scope = String(req.nextUrl.searchParams.get('scope') || '').trim().toLowerCase();
  const endpointPrefix = scope === 'video' ? '/api/video/' : undefined;

  const logs = await listRecentGenerateLogs(payload.userId, limit, endpointPrefix);
  return NextResponse.json({ logs, count: logs.length });
}
