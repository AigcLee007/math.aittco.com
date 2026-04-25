import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { verifyAccessToken } from '~/server/auth/jwt';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. 验证管理员身份
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const payload = token ? verifyAccessToken(token) : null;

    if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin only' }, { status: 401 });
    }

    // 2. 解析 FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 3. 准备存储路径
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const relativeDir = 'uploads/announcements';
    const uploadDir = join(process.cwd(), 'public', relativeDir);
    
    // 确保目录存在
    await mkdir(uploadDir, { recursive: true });

    // 4. 生成唯一文件名 (时间戳 + 原始名称)
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const filePath = join(uploadDir, filename);

    // 5. 写入文件
    await writeFile(filePath, buffer);

    const publicUrl = `/${relativeDir}/${filename}`;
    console.log(`[Upload] File saved to ${filePath}, accessible at ${publicUrl}`);

    return NextResponse.json({ 
      success: true, 
      url: publicUrl 
    });

  } catch (error: any) {
    console.error('[Upload Error]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
