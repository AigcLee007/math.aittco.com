/**
 * 五个智能体核心函数
 * 每个 Agent 接收上下文、调用 LLM、返回结构化结果
 *
 * LLM 调用采用 OpenAI Chat Completions 兼容格式（绝大多数 Provider 均支持）
 * 前端需传入 apiKey + baseURL，由 route.ts 组装后传入此处
 */

import type {
  CoordinatorOutput,
  CoordinatorError,
  ModelerOutput,
  CoderOutput,
  CoderStepResult,
  WriterOutput,
  WriterSection,
  ReviewerOutput,
  PipelineContext,
  CompetitionTemplate,
  PipelineAttachment,
} from './types';
import { DEFAULT_TEMPLATE } from './types';
import {
  COORDINATOR_SYSTEM,
  MODELER_SYSTEM,
  CODER_SYSTEM,
  WRITER_SYSTEM,
  REVIEWER_SYSTEM,
  REFLECTION_SYSTEM,
  buildCoordinatorUserPrompt,
  buildModelerUserPrompt,
  buildCoderStepPrompt,
  buildWriterSectionPrompt,
  buildReflectionPrompt,
  buildReviewerUserPrompt,
} from './prompts';
import { executeCode, extractPythonCode } from './sandbox';

// ===================== LLM 调用层 =====================

export interface LLMConfig {
  apiKey: string;
  baseURL: string;  // e.g. "https://api.aittco.com/v1"
  model: string;    // e.g. "gpt-4o"
}

/**
 * 通用 LLM 调用 — OpenAI Chat Completions 兼容格式
 */
/**
 * 通用 LLM 调用 — 支持 OpenAI / Google / Anthropic
 */
export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const { apiKey, baseURL, model } = config;
  
  // 1. Google Gemini Protocol
  if (baseURL.includes('googleapis.com')) {
    // 处理 Model ID (去除 models/ 前缀)
    const cleanModel = model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
    
    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 8192,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Gemini response missing content');
    return content;
  }

  // 2. Anthropic Protocol
  if (baseURL.includes('anthropic.com')) {
    const url = 'https://api.anthropic.com/v1/messages';
    
    const body = {
      model: model,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text ?? '';
  }

  // 3. Default: OpenAI Protocol (Compatible)
  const cleanBase = baseURL.replace(/\/$/, '');
  const url = `${cleanBase}/chat/completions`;

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 8192,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * 从 LLM 响应中提取 JSON
 */
function extractJSON<T>(text: string): T {
  // 1. 尝试直接解析
  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  // 2. 尝试从 ```jsonCodeBlock``` 提取
  const jsonBlockMatch = text.match(/```json\s*\n([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch { /* continue */ }
  }

  // 3. 尝试从 ```CodeBlock``` 提取
  const genericBlockMatch = text.match(/```\s*\n([\s\S]*?)```/);
  if (genericBlockMatch) {
    try {
      return JSON.parse(genericBlockMatch[1].trim());
    } catch { /* continue */ }
  }

  // 4. 智能提取：从第一个 { 开始，尝试匹配到合法的 JSON 结束
  // 解决 greedy regex 匹配到文末无关 } 的问题
  const firstOpen = text.indexOf('{');
  if (firstOpen !== -1) {
    let lastClose = text.lastIndexOf('}');
    while (lastClose > firstOpen) {
      try {
        const potentialJson = text.slice(firstOpen, lastClose + 1);
        return JSON.parse(potentialJson);
      } catch {
        // 如果解析失败，可能是包含了多余的 }，尝试向前寻找下一个 }
        lastClose = text.lastIndexOf('}', lastClose - 1);
      }
    }
  }

  throw new Error(`无法从 LLM 响应中提取 JSON:\n${text.slice(0, 500)}...`);
}

// ===================== Agent 函数 =====================

type ProgressCallback = (message: string) => void;

/**
 * 1. 协调员 — 结构化拆解赛题
 */
export async function runCoordinator(
  llmConfig: LLMConfig,
  problemText: string,
  attachments: PipelineAttachment[],
  onProgress?: ProgressCallback,
  maxRetries: number = 2,
): Promise<CoordinatorOutput> {
  onProgress?.('正在分析赛题，拆解子问题...');

  const userPrompt = buildCoordinatorUserPrompt(problemText, attachments);
  
  let lastError: Error | null = null;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      // 如果是重试，可以稍微增加 temperature 或者追加提示（这里简化为直接重试）
      const response = await callLLM(llmConfig, COORDINATOR_SYSTEM, userPrompt, { temperature: 0.3 });
      
      const parsed = extractJSON<CoordinatorOutput | CoordinatorError>(response);

      // 检查是否为错误响应
      if ('error' in parsed && 'is_math_modeling' in parsed) {
        throw new Error((parsed as CoordinatorError).error);
      }

      const output = parsed as CoordinatorOutput;

      // 验证必须字段
      if (!output.title || !output.ques_count || output.ques_count < 1) {
        throw new Error(`协调员输出格式不完整: ${JSON.stringify(output).slice(0, 300)}`);
      }

      onProgress?.(`拆解完成：${output.title}，共 ${output.ques_count} 个子问题`);
      return output;
      
    } catch (err) {
      lastError = err as Error;
      if (i < maxRetries) {
        onProgress?.(`[协调员] JSON 解析失败，正在重试 (${i + 1}/${maxRetries})...`);
        // 等待一小会儿避免频繁请求
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  
  throw lastError || new Error('Coordinator failed after retries');
}

/**
 * 2. 建模手 — 生成建模方案
 */
export async function runModeler(
  llmConfig: LLMConfig,
  coordinatorOutput: CoordinatorOutput,
  onProgress?: ProgressCallback,
): Promise<ModelerOutput> {
  onProgress?.('正在设计建模方案...');

  const userPrompt = buildModelerUserPrompt(coordinatorOutput);
  const response = await callLLM(llmConfig, MODELER_SYSTEM, userPrompt, { temperature: 0.5 });

  const output = extractJSON<ModelerOutput>(response);

  // 验证必须字段
  if (!output.eda) {
    output.eda = '进行基础的数据探索性分析和可视化';
  }
  if (!output.sensitivity_analysis) {
    output.sensitivity_analysis = '对关键参数进行敏感性分析';
  }

  onProgress?.('建模方案设计完成');
  return output;
}

/**
 * 3. 代码手 — 生成代码 + E2B 执行 + 错误自愈
 */
export async function runCoder(
  llmConfig: LLMConfig,
  coordinatorOutput: CoordinatorOutput,
  modelerOutput: ModelerOutput,
  onProgress?: ProgressCallback,
  maxReflections: number = 3,
): Promise<CoderOutput> {
  onProgress?.('开始代码生成与执行...');

  // 构建步骤列表: eda → ques1 → ques2 ... → sensitivity_analysis
  const steps: { key: string; label: string }[] = [
    { key: 'eda', label: '数据探索性分析 (EDA)' },
  ];
  for (let i = 1; i <= coordinatorOutput.ques_count; i++) {
    steps.push({ key: `ques${i}`, label: `问题 ${i}` });
  }
  steps.push({ key: 'sensitivity_analysis', label: '敏感性分析' });

  const results: CoderStepResult[] = [];

  for (const step of steps) {
    onProgress?.(`[代码手] 正在处理: ${step.label}`);

    const solution = modelerOutput[step.key] || '';
    const questionText = (coordinatorOutput as any)[step.key] || '';
    const userPrompt = buildCoderStepPrompt(step.key, solution, questionText);

    // 生成代码
    let codeResponse = await callLLM(llmConfig, CODER_SYSTEM, userPrompt);
    let code = extractPythonCode(codeResponse);
    let execution = await executeCode(code);
    let reflectionCount = 0;

    // 错误自愈循环
    while (execution.error && reflectionCount < maxReflections) {
      reflectionCount++;
      onProgress?.(`[代码手] ${step.label} 执行出错，正在修正 (${reflectionCount}/${maxReflections})...`);

      const reflectionPrompt = buildReflectionPrompt(execution.error, code);
      codeResponse = await callLLM(llmConfig, REFLECTION_SYSTEM, reflectionPrompt);
      code = extractPythonCode(codeResponse);
      execution = await executeCode(code);
    }

    results.push({
      stepKey: step.key,
      stepLabel: step.label,
      code,
      execution,
      reflectionCount,
    });

    if (execution.error) {
      onProgress?.(`[代码手] ⚠️ ${step.label} 执行失败（已重试 ${reflectionCount} 次）`);
    } else {
      onProgress?.(`[代码手] ✅ ${step.label} 完成` +
        (execution.images.length > 0 ? `，生成 ${execution.images.length} 张图表` : ''));
    }
  }

  onProgress?.(`代码执行完成，共 ${results.length} 个步骤`);
  return { steps: results };
}

/**
 * 4. 论文手 — 分章节撰写论文
 */
export async function runWriter(
  llmConfig: LLMConfig,
  ctx: PipelineContext,
  template: CompetitionTemplate = DEFAULT_TEMPLATE,
  onProgress?: ProgressCallback,
): Promise<WriterOutput> {
  onProgress?.('开始撰写论文...');

  if (!ctx.coordinator || !ctx.modeler || !ctx.coder) {
    throw new Error('Writer 缺少前序 Agent 输出');
  }

  const background = `${ctx.coordinator.title}\n${ctx.coordinator.background}`;

  // 构建论文章节序列
  const sectionKeys: { key: string; title: string }[] = [
    { key: 'firstPage', title: '标题、摘要与关键词' },
    { key: 'RepeatQues', title: '问题重述' },
    { key: 'analysisQues', title: '问题分析' },
    { key: 'modelAssumption', title: '模型假设' },
    { key: 'symbol', title: '符号说明' },
    { key: 'eda', title: '数据探索性分析' },
  ];

  // 动态添加各问题章节
  for (let i = 1; i <= ctx.coordinator.ques_count; i++) {
    sectionKeys.push({ key: `ques${i}`, title: `问题 ${i} 的建模与求解` });
  }

  sectionKeys.push(
    { key: 'sensitivity_analysis', title: '敏感性分析' },
    { key: 'judge', title: '模型评价与改进' },
  );

  const sections: WriterSection[] = [];

  for (const sec of sectionKeys) {
    onProgress?.(`[论文手] 正在撰写: ${sec.title}`);

    // 获取对应步骤的代码执行结果
    const coderStep = ctx.coder.steps.find(s => s.stepKey === sec.key);
    const coderResults = coderStep
      ? `代码输出:\n${coderStep.execution.stdout}\n\n代码:\n${coderStep.code}`
      : '（此章节无代码执行结果）';
    const codeImages = coderStep?.execution.images.map((_, i) => `图${i + 1}`) || [];

    const templateInstruction = template[sec.key] || `撰写${sec.title}部分`;
    const userPrompt = buildWriterSectionPrompt(sec.key, background, coderResults, codeImages, templateInstruction);

    const content = await callLLM(llmConfig, WRITER_SYSTEM, userPrompt, { maxTokens: 4096 });

    sections.push({
      key: sec.key,
      title: sec.title,
      content,
    });
  }

  // 合并完整论文
  const fullPaper = sections.map(s => s.content).join('\n\n---\n\n');

  onProgress?.('论文撰写完成');
  return { sections, fullPaper };
}

/**
 * 5. 审查员 — 模拟评委审查论文
 */
export async function runReviewer(
  llmConfig: LLMConfig,
  fullPaper: string,
  competitionType: string,
  onProgress?: ProgressCallback,
): Promise<ReviewerOutput> {
  onProgress?.('正在进行论文审查...');

  const userPrompt = buildReviewerUserPrompt(fullPaper, competitionType);
  const response = await callLLM(llmConfig, REVIEWER_SYSTEM, userPrompt, { temperature: 0.3, maxTokens: 4096 });

  try {
    const output = extractJSON<ReviewerOutput>(response);
    onProgress?.(`审查完成，整体评分: ${output.overallScore}/100`);
    return output;
  } catch {
    // 如果 JSON 解析失败，构造一个默认结构
    onProgress?.('审查完成（文本格式）');
    return {
      overallScore: 0,
      strengths: '',
      weaknesses: '',
      suggestions: '',
      fullReview: response,
    };
  }
}
