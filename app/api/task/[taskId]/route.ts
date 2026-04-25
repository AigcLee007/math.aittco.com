import { NextRequest } from 'next/server';
import { verifyAccessToken } from '~/server/auth/jwt';
import { getLocalImageTask, toPublicLocalImageTask } from '~/server/services/local-image-task.service';
import {
  ensureVisionaryLocalTaskReconcilerStarted,
  isVisionaryLocalTaskId,
  startVisionaryLocalTaskMonitor,
} from '~/server/services/visionary-local-task.service';

export const runtime = 'nodejs';
export const maxDuration = 60;

function jsonError(message: string, status = 400) {
  return Response.json({ message, detail: message }, { status });
}

export async function GET(req: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  ensureVisionaryLocalTaskReconcilerStarted();

  const { taskId } = await context.params;
  if (!taskId)
    return jsonError('缺少任务 ID');

  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload)
    return jsonError('请先登录', 401);

  if (!isVisionaryLocalTaskId(taskId))
    return jsonError('任务不存在', 404);

  const task = await getLocalImageTask(taskId);
  if (!task)
    return jsonError('任务不存在', 404);

  if (task.userId !== payload.userId && payload.role !== 'SUPER_ADMIN')
    return jsonError('无权查看该任务', 403);

  if (task.status === 'processing')
    startVisionaryLocalTaskMonitor(task.id);

  return Response.json(toPublicLocalImageTask(task));
}
