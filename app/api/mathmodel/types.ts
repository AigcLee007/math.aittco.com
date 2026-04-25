/**
 * Agent 间通信类型定义
 * 对应 math-master 的 A2A.py
 */

// ===== Agent Names =====
export type AgentName = 'coordinator' | 'modeler' | 'coder' | 'writer' | 'reviewer';

export const AGENT_NAMES: AgentName[] = ['coordinator', 'modeler', 'coder', 'writer', 'reviewer'];

export const AGENT_LABELS: Record<AgentName, string> = {
  coordinator: '🎯 协调员',
  modeler: '📐 建模手',
  coder: '💻 代码手',
  writer: '✍️ 论文手',
  reviewer: '🧪 审查员',
};

// ===== Pipeline Request =====
export interface PipelineRequest {
  problemText: string;
  competitionType: 'CUMCM' | 'MCM' | 'APMCM';
  year: string;
  problemId: string;
  attachments: PipelineAttachment[];
  agentModels: Record<AgentName, string>; // 每个 Agent 独立选 LLM ID
}

export interface PipelineAttachment {
  name: string;
  content: string; // 提取的文本内容
  type: string;
}

// ===== Coordinator =====
export interface CoordinatorOutput {
  title: string;
  background: string;
  ques_count: number;
  [key: string]: string | number; // ques1, ques2, ...quesN
}

export interface CoordinatorError {
  error: string;
  is_math_modeling: false;
}

// ===== Modeler =====
export interface ModelerOutput {
  eda: string;
  sensitivity_analysis: string;
  [key: string]: string; // ques1, ques2, ...quesN
}

// ===== Coder =====
export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  images: string[];  // Base64 PNG
  error: string | null;
}

export interface CoderStepResult {
  stepKey: string;          // 'eda' | 'ques1' | ... | 'sensitivity_analysis'
  stepLabel: string;
  code: string;
  execution: CodeExecutionResult;
  reflectionCount: number;  // 自愈重试次数
}

export interface CoderOutput {
  steps: CoderStepResult[];
}

// ===== Writer =====
export interface WriterSection {
  key: string;
  title: string;
  content: string;
}

export interface WriterOutput {
  sections: WriterSection[];
  fullPaper: string; // 合并后的完整论文
}

// ===== Reviewer =====
export interface ReviewerOutput {
  overallScore: number;    // 1-100
  strengths: string;
  weaknesses: string;
  suggestions: string;
  fullReview: string;
}

// ===== Pipeline Context (累积上下文) =====
export interface PipelineContext {
  request: PipelineRequest;
  coordinator?: CoordinatorOutput;
  modeler?: ModelerOutput;
  coder?: CoderOutput;
  writer?: WriterOutput;
  reviewer?: ReviewerOutput;
}

// ===== SSE Events =====
export type SSEEvent =
  | { event: 'progress'; data: { agent: AgentName; status: 'starting' | 'running' | 'done' | 'error'; message: string } }
  | { event: 'stream'; data: { agent: AgentName; chunk: string } }
  | { event: 'result'; data: { agent: AgentName; output: any } }
  | { event: 'code_exec'; data: { stepKey: string; stdout: string; images: string[]; error: string | null } }
  | { event: 'done'; data: { paperMarkdown: string } }
  | { event: 'error'; data: { agent: AgentName; message: string } };

// ===== Competition Templates =====
export interface CompetitionTemplate {
  firstPage: string;
  RepeatQues: string;
  analysisQues: string;
  modelAssumption: string;
  symbol: string;
  eda: string;
  sensitivity_analysis: string;
  judge: string;
  [key: string]: string; // ques1, ques2, ...
}

export const DEFAULT_TEMPLATE: CompetitionTemplate = {
  firstPage: '撰写标题、摘要和关键词。摘要应概述问题背景、建模方法、主要结果和结论。',
  RepeatQues: '用自己的语言重新表述问题，体现对问题的理解。',
  analysisQues: '分析问题的核心要素，确定建模方向和关键变量。',
  modelAssumption: '列出合理的模型假设，并说明每条假设的依据。',
  symbol: '用表格列出论文中使用的所有数学符号及其含义。',
  eda: '描述数据探索性分析的过程和发现，包括数据清洗、可视化结果。',
  sensitivity_analysis: '对关键参数进行敏感性分析，讨论参数变化对结果的影响。',
  judge: '总结模型的优缺点，提出改进方向。',
};
