import { NextRequest } from 'next/server';
import { executeCode } from '../sandbox';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min timeout

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: '代码内容不能为空' }), { status: 400 });
    }

    const execResult = await executeCode(code);

    return new Response(JSON.stringify(execResult), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || '内部服务错误' }), { status: 500 });
  }
}
