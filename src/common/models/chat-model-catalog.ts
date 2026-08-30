export type ModelPricingCategory = 'CHAT' | 'IMAGE' | 'VIDEO';

export type ModelPricingSnapshot = {
  modelId: string;
  modelName: string;
  category: ModelPricingCategory;
  coinCost: number;
  isActive: boolean;
};

export type ChatModelCatalogEntry = ModelPricingSnapshot & {
  vendor: 'googleai' | 'openai' | 'anthropic' | 'xai';
  description: string;
};

export const CHAT_MODEL_FIXED_API_HOST = 'https://api.aittco.com';

export const CHAT_MODEL_CATALOG: readonly ChatModelCatalogEntry[] = [
  { modelId: 'gemini-3.5-flash-preview', modelName: 'Gemini-3.5-Flash', vendor: 'googleai', category: 'CHAT', coinCost: 1, isActive: true, description: 'Gemini 3.5 Flash：主打速度与低延迟，适合高频日常对话与轻量任务。' },
  { modelId: 'gemini-3.7-flash', modelName: 'Gemini-3.7-Flash', vendor: 'googleai', category: 'CHAT', coinCost: 2, isActive: true, description: 'Gemini 3.7 Flash：兼顾响应速度与多步骤推理，适合日常分析和内容处理。' },
  { modelId: 'gemini-3.1-pro-preview', modelName: 'Gemini-3.1-Pro', vendor: 'googleai', category: 'CHAT', coinCost: 3, isActive: true, description: 'Gemini 3.1 Pro：推理与代码能力更强，适合复杂分析和长上下文任务。' },
  { modelId: 'gpt-5.5', modelName: 'GPT-5.5', vendor: 'openai', category: 'CHAT', coinCost: 4, isActive: true, description: 'GPT-5.5：增强复杂推理与指令遵循能力，适合高要求分析和生产任务。' },
  { modelId: 'gpt-5.6-terra', modelName: 'GPT-5.6-Terra', vendor: 'openai', category: 'CHAT', coinCost: 3, isActive: true, description: 'GPT-5.6 Terra：兼顾响应效率与综合质量，适合日常开发和通用工作流。' },
  { modelId: 'gpt-5.6-sol', modelName: 'GPT-5.6-Sol', vendor: 'openai', category: 'CHAT', coinCost: 6, isActive: true, description: 'GPT-5.6 Sol：面向深度推理和软件工程任务优化，强调准确性与完整性。' },
  { modelId: 'claude-opus-4-8', modelName: 'Claude-Opus-4-8', vendor: 'anthropic', category: 'CHAT', coinCost: 6, isActive: true, description: 'Claude Opus 4.8：高端旗舰模型，擅长深度推理、长文写作与严谨表达。' },
  { modelId: 'claude-sonnet-5', modelName: 'Claude-Sonnet-5', vendor: 'anthropic', category: 'CHAT', coinCost: 5, isActive: true, description: 'Claude Sonnet 5：平衡响应速度与分析质量，适合通用办公、研发与内容生成。' },
  { modelId: 'claude-opus-5', modelName: 'Claude-Opus-5', vendor: 'anthropic', category: 'CHAT', coinCost: 7, isActive: true, description: 'Claude Opus 5：面向最高质量推理与写作，适合高难度综合任务。' },
  { modelId: 'grok-4.6', modelName: 'Grok-4.6', vendor: 'xai', category: 'CHAT', coinCost: 3, isActive: true, description: 'Grok 4.6：通用对话与实时推理能力突出，适合快速问答和多领域分析。' },
] as const;

const catalogById = new Map(CHAT_MODEL_CATALOG.map((entry) => [entry.modelId, entry]));

export function isFixedTextModelId(modelId: string): boolean {
  const normalized = modelId.trim().replace(/^models\//i, '').toLowerCase();
  const withoutVendorPrefix = normalized.replace(/^(?:googleai|openai|anthropic|xai)\//, '');
  return catalogById.has(withoutVendorPrefix);
}

export const CHAT_MODEL_DESCRIPTIONS: Readonly<Record<string, string>> = Object.fromEntries(
  CHAT_MODEL_CATALOG.map(({ modelId, description }) => [modelId, description]),
);

function isManagedChatModelId(modelId: string): boolean {
  const normalized = modelId.trim().replace(/^models\//i, '').toLowerCase();
  return normalized.startsWith('gemini-') || normalized.startsWith('gpt-')
    || normalized.startsWith('claude-') || normalized.startsWith('grok-')
    || normalized.startsWith('googleai/') || normalized.startsWith('openai/')
    || normalized.startsWith('anthropic/') || normalized.startsWith('xai/');
}

function needsCanonicalUpsert(current: ModelPricingSnapshot | undefined, target: ChatModelCatalogEntry): boolean {
  return !current || current.modelName !== target.modelName || current.category !== target.category
    || current.coinCost !== target.coinCost || current.isActive !== target.isActive;
}

export function getChatModelCatalogPlan(currentRows: readonly ModelPricingSnapshot[]): {
  upserts: ChatModelCatalogEntry[];
  deactivateModelIds: string[];
} {
  const currentByExactId = new Map(currentRows.map((row) => [row.modelId, row]));
  const upserts = CHAT_MODEL_CATALOG.filter((target) => needsCanonicalUpsert(currentByExactId.get(target.modelId), target))
    .map((target) => ({ ...target }));
  const deactivateModelIds = currentRows.filter((row) => row.category === 'CHAT' && row.isActive
    && isManagedChatModelId(row.modelId) && !catalogById.has(row.modelId)).map((row) => row.modelId).sort();
  return { upserts, deactivateModelIds };
}
