/**
 * 自动化流水线 API 入口
 * POST /api/mathmodel/run
 * 
 * 按顺序调用 5 个 Agent，通过 SSE 实时推送进度
 * 前端需要传入每个 Agent 的 LLM 配置（apiKey + baseURL + model）
 */

import { NextRequest } from 'next/server';

import type { AgentName, PipelineContext, SSEEvent } from '../types';
import type { LLMConfig } from '../agents';
import { runCoordinator, runModeler, runCoder, runWriter, runReviewer } from '../agents';

export const runtime = 'nodejs';
export const maxDuration = 900; // 15 分钟超时

/**
 * 请求体结构
 */
interface RunRequest {
  problemText: string;
  competitionType: 'CUMCM' | 'MCM' | 'APMCM';
  year: string;
  problemId: string;
  attachments: { name: string; content: string; type: string }[];
  agentConfigs: Record<AgentName, LLMConfig>;
}

/**
 * SSE 辅助: 发送一个事件
 */
function sendSSE(controller: ReadableStreamDefaultController, event: SSEEvent): void {
  const data = JSON.stringify(event);
  controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
}

export async function POST(req: NextRequest) {
  let body: RunRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '无效的请求体' }), { status: 400 });
  }

  const { problemText, competitionType, year, problemId, attachments, agentConfigs } = body;

  // 验证必需字段
  if (!problemText?.trim()) {
    return new Response(JSON.stringify({ error: '赛题内容不能为空' }), { status: 400 });
  }
  if (!agentConfigs) {
    return new Response(JSON.stringify({ error: '缺少 Agent LLM 配置' }), { status: 400 });
  }

  // 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      const ctx: PipelineContext = {
        request: { problemText, competitionType, year, problemId, attachments, agentModels: {} as any },
      };

      const send = (event: SSEEvent) => sendSSE(controller, event);

      try {
        // ===== Step 1: Coordinator =====
        send({ event: 'progress', data: { agent: 'coordinator', status: 'running', message: '正在分析赛题...' } });
        ctx.coordinator = await runCoordinator(
          agentConfigs.coordinator,
          problemText,
          attachments,
          (msg) => send({ event: 'progress', data: { agent: 'coordinator', status: 'running', message: msg } }),
        );
        send({ event: 'result', data: { agent: 'coordinator', output: ctx.coordinator } });
        send({ event: 'progress', data: { agent: 'coordinator', status: 'done', message: `拆解完成: ${ctx.coordinator.title}` } });

        // ===== Step 2: Modeler =====
        send({ event: 'progress', data: { agent: 'modeler', status: 'running', message: '正在设计建模方案...' } });
        ctx.modeler = await runModeler(
          agentConfigs.modeler,
          ctx.coordinator,
          (msg) => send({ event: 'progress', data: { agent: 'modeler', status: 'running', message: msg } }),
        );
        send({ event: 'result', data: { agent: 'modeler', output: ctx.modeler } });
        send({ event: 'progress', data: { agent: 'modeler', status: 'done', message: '建模方案设计完成' } });

        // ===== Step 3: Coder =====
        send({ event: 'progress', data: { agent: 'coder', status: 'running', message: '开始代码生成与执行...' } });
        ctx.coder = await runCoder(
          agentConfigs.coder,
          ctx.coordinator,
          ctx.modeler,
          (msg) => {
            send({ event: 'progress', data: { agent: 'coder', status: 'running', message: msg } });
          },
        );
        // 发送每个步骤的代码执行结果
        for (const step of ctx.coder.steps) {
          send({
            event: 'code_exec', data: {
              stepKey: step.stepKey,
              stdout: step.execution.stdout,
              images: step.execution.images,
              error: step.execution.error,
            },
          });
        }
        send({ event: 'result', data: { agent: 'coder', output: ctx.coder } });
        send({ event: 'progress', data: { agent: 'coder', status: 'done', message: `代码执行完成 (${ctx.coder.steps.length} 步)` } });

        // ===== Step 4: Writer =====
        send({ event: 'progress', data: { agent: 'writer', status: 'running', message: '开始撰写论文...' } });
        ctx.writer = await runWriter(
          agentConfigs.writer,
          ctx,
          undefined, // 使用默认模板
          (msg) => send({ event: 'progress', data: { agent: 'writer', status: 'running', message: msg } }),
        );
        send({ event: 'result', data: { agent: 'writer', output: ctx.writer } });
        send({ event: 'progress', data: { agent: 'writer', status: 'done', message: '论文撰写完成' } });

        // ===== Step 5: Reviewer =====
        send({ event: 'progress', data: { agent: 'reviewer', status: 'running', message: '正在审查论文...' } });
        ctx.reviewer = await runReviewer(
          agentConfigs.reviewer,
          ctx.writer.fullPaper,
          competitionType,
          (msg) => send({ event: 'progress', data: { agent: 'reviewer', status: 'running', message: msg } }),
        );
        send({ event: 'result', data: { agent: 'reviewer', output: ctx.reviewer } });
        send({ event: 'progress', data: { agent: 'reviewer', status: 'done', message: `审查完成，评分: ${ctx.reviewer.overallScore}/100` } });

        // ===== Done =====
        send({ event: 'done', data: { paperMarkdown: ctx.writer.fullPaper } });

      } catch (err: any) {
        const agentName = (['coordinator', 'modeler', 'coder', 'writer', 'reviewer'] as AgentName[])
          .find(a => !(ctx as any)[a]) || 'coordinator';

        send({
          event: 'error', data: {
            agent: agentName,
            message: err?.message || String(err),
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
