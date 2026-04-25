import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 900;

function isAllowedRemoteVideoUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const remoteUrl = req.nextUrl.searchParams.get('url') || '';
  if (!isAllowedRemoteVideoUrl(remoteUrl))
    return NextResponse.json({ message: '无效的视频地址' }, { status: 400 });

  const upstream = await fetch(remoteUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(600_000),
  });

  if (!upstream.ok)
    return NextResponse.json({ message: `视频拉取失败: ${upstream.status}` }, { status: upstream.status });

  const headers = new Headers();
  const upstreamType = upstream.headers.get('content-type') || '';
  headers.set('Content-Type', upstreamType && upstreamType !== 'application/octet-stream' ? upstreamType : 'video/mp4');
  headers.set('Cache-Control', 'public, max-age=3600');
  const contentLength = upstream.headers.get('content-length');
  if (contentLength)
    headers.set('Content-Length', contentLength);
  headers.set('Accept-Ranges', 'bytes');

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
