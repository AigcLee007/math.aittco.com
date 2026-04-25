/**
 * Parameter Registry and Model Configuration
 *
 * This module provides a type-safe parameter management system for LLM models.
 * It handles parameter definitions, validation, and runtime values while
 * maintaining strict type safety throughout the application.
 *
 * Key concepts:
 * - ParameterRegistry: Defines all possible parameters and their constraints
 * - ParameterSpec: Model-specific parameter configurations
 * - ParameterValues: Runtime parameter values (initial and user overrides)
 *
 * @module llms
 */


// shared constants
export const FALLBACK_LLM_PARAM_RESPONSE_TOKENS = 4096;
export const FALLBACK_LLM_PARAM_TEMPERATURE = 0.5;
// const FALLBACK_LLM_PARAM_REF_UNKNOWN = 'unknown_id';


/// Registry Entry Types (for compile-time validation)

type _ParameterRegistryEntry =
  | _IntegerParamDef
  | _FloatParamDef
  | _StringParamDef
  | _BooleanParamDef
  | _EnumParamDef;

interface _ParamDefBase {
  readonly label: string;
  readonly description: string;
}

interface _IntegerParamDef extends _ParamDefBase {
  readonly type: 'integer';
  readonly range?: readonly [number, number];
  readonly nullable?: { readonly meaning: string };
  readonly requiredFallback?: number;
  readonly initialValue?: number | null;
}

interface _FloatParamDef extends _ParamDefBase {
  readonly type: 'float';
  readonly range?: readonly [number, number];
  readonly nullable?: { readonly meaning: string };
  readonly requiredFallback?: number;
  readonly initialValue?: number | null;
}

interface _StringParamDef extends _ParamDefBase {
  readonly type: 'string';
  readonly initialValue?: string;
}

interface _BooleanParamDef extends _ParamDefBase {
  readonly type: 'boolean';
  readonly initialValue?: boolean;
}

interface _EnumParamDef extends _ParamDefBase {
  readonly type: 'enum';
  readonly values: readonly string[];
  readonly requiredFallback?: string;
  readonly initialValue?: string;
}


/// Registry

export const DModelParameterRegistry = {

  /// Common parameters, normally available in all models ///
  // Note: we still use pre-v2 names for compatibility and ease of migration

  llmRef: {
    label: '模型 ID',
    type: 'string',
    description: '上游模型引用',
  },

  llmResponseTokens: {
    label: '最大 Token 数',
    type: 'integer',
    description: '生成文本的最大长度',
    nullable: {
      meaning: 'Explicitly avoid sending max_tokens to upstream API',
    },
    requiredFallback: FALLBACK_LLM_PARAM_RESPONSE_TOKENS,   // if required and not specified/user overridden, use this value
  },

  llmTemperature: {
    label: '温度',
    type: 'float',
    description: '控制输出的随机性',
    range: [0.0, 2.0] as const,
    nullable: {
      meaning: 'Explicitly avoid sending temperature to upstream API',
    },
    requiredFallback: FALLBACK_LLM_PARAM_TEMPERATURE,
  },

  /// Extended parameters, specific to certain models/vendors

  llmTopP: {
    label: 'Top P',
    type: 'float',
    description: '核采样阈值',
    range: [0.0, 1.0] as const,
    requiredFallback: 1.0,
  },

  /**
   * First introduced as a user-configurable parameter for the 'Verification' required by o3.
   * [2025-04-16] Adding parameter to disable streaming for o3, and possibly more models.
   *
   * [2026-01-21] OpenAI Responses API: Reasoning Summaries require organization verification.
   * Per OpenAI docs, both streaming AND reasoning summaries require org verification for GPT-5/5.1/5.2.
   *  - https://help.openai.com/en/articles/10362446-api-model-availability-by-usage-tier-and-verification-status
   *  - Rather than adding a separate param, we piggyback on llmForceNoStream.
   *  - AIX Wire type `vndOaiReasoningSummary` is derived from `llmForceNoStream` in aix.client.ts.
   */
  llmForceNoStream: {
    label: '禁用流式传输',
    type: 'boolean',
    description: '禁用此模型的流式传输',
    // initialValue: false, // we don't need the initial value here, will be assumed off
  },

  llmVndAnt1MContext: {
    label: '1M 上下文窗口 (Beta)',
    type: 'boolean',
    description: '启用 1M Token 上下文窗口（>200K 输入 Token 时为高级定价）',
    // No initialValue - undefined means off (e.g. default 200K context window)
  },

  llmVndAntEffortMax: { // introduced with Claude Opus 4.6; this adds the 'max' level on top of llmVndAntEffort
    label: '思考强度',
    type: 'enum' as const,
    description: '控制思考深度。max = 无限制的最深推理，high = 默认。',
    values: ['low', 'medium', 'high', 'max'] as const,
    // No initialValue - undefined means high effort (default)
  } as const,

  llmVndAntEffort: {
    label: '思考强度',
    type: 'enum' as const,
    description: '控制 Token 使用量与全面性的权衡。与思考预算配合使用。',
    values: ['low', 'medium', 'high'] as const,
    // No initialValue - undefined means high effort (default, equivalent to omitting the parameter)
  } as const,

  llmVndAntSkills: {
    label: '文档技能',
    type: 'string',
    description: '逗号分隔的技能 (xlsx,pptx,pdf,docx)',
    initialValue: '', // empty string = disabled
  },

  /**
   * Important: when this is set to anything other than nullish, it enables Adaptive(-1)/Extended(int > 1024) thinking,
   * and as a side effect **disables the temperature** in the requests (even when tunneled through OpenRouter). So this
   * control must disable the UI controls for temperature in both the side panel and the model configuration dialog.
   */
  llmVndAntThinkingBudget: {
    label: '思考预算',
    type: 'integer',
    description: '扩展思考的预算',
    range: [1024, 65536] as const,
    initialValue: 16384, // special: '-1' is an out-of-range sentinel for 'adaptive' thinking (hidden, used for 4.6+)
    nullable: { // null means to not turn on thinking at all, and it's the user-overridden equivalent to the param missing
      meaning: 'Disable extended thinking',
    },
  },

  llmVndAntWebFetch: { // implies: LLM_IF_Tools_WebSearch
    label: '网页获取',
    type: 'enum',
    description: '启用从网页和 PDF 获取内容',
    values: ['auto', 'off'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  llmVndAntWebSearch: { // implies: LLM_IF_Tools_WebSearch
    label: '网络搜索',
    type: 'enum',
    description: '启用网络搜索以获取实时信息',
    values: ['auto', 'off'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  // llmVndAntToolSearch: { // Not user set
  //   label: 'Tool Search',
  //   type: 'enum' as const,
  //   description: 'Search algorithm for discovering tools on-demand (regex=pattern-based, bm25=natural language)',
  //   values: ['regex', 'bm25'] as const,
  //   // No initialValue - undefined means off (tool search disabled)
  // } as const,

  llmVndGeminiAspectRatio: { // implies: LLM_IF_Outputs_Image
    label: '宽高比',
    type: 'enum',
    description: '控制生成图像的宽高比',
    values: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] as const,
    // No initial value - when undefined, the model decides the aspect ratio
  },

  llmVndGeminiCodeExecution: {
    label: '代码执行',
    type: 'enum',
    description: '启用模型自动生成和执行 Python 代码',
    values: ['auto'] as const,
    // No initialValue - undefined means off
  },

  llmVndGeminiComputerUse: {
    label: '计算机使用环境',
    type: 'enum',
    description: '计算机使用工具的环境类型（计算机使用模型必需）',
    values: ['browser'] as const,
    initialValue: 'browser',
    // requiredFallback: 'browser', // See `const _requiredParamId: DModelParameterId[]` in llms.parameters.ts for why custom params don't have required values at AIX invocation...
  },

  llmVndGeminiGoogleSearch: { // implies: LLM_IF_Tools_WebSearch
    label: '谷歌搜索',
    type: 'enum',
    description: '启用带有可选时间过滤器的谷歌搜索落地 (Grounding)',
    values: ['unfiltered', '1d', '1w', '1m', '6m', '1y'] as const,
    // No initialValue - undefined means off
  },

  llmVndGeminiImageSize: { // implies: LLM_IF_Outputs_Image - [Gemini, 2025-11-20] Nano Banana launch
    label: '图像尺寸',
    type: 'enum',
    description: '控制生成图像的分辨率',
    values: ['1K', '2K', '4K'] as const,
    // No initial value - when undefined, the model decides the image size
  },

  llmVndGeminiMediaResolution: {
    label: '媒体分辨率',
    type: 'enum',
    description: '控制多模态输入的视觉处理质量。高分辨率可提高文本阅读和细节识别能力，但会增加 Token 使用量。',
    values: ['mr_high', 'mr_medium', 'mr_low'] as const,
    // No initialValue - undefined: "If unspecified, the model uses optimal defaults based on the media type." (Images: high, PDFs: medium, Videos: low/medium (rec: high for OCR))
  },

  llmVndGeminiShowThoughts: {
    label: '显示思考过程',
    type: 'boolean',
    description: '显示 Gemini 的推理过程',
    // initialValue: true, // no initial value
  },

  llmVndGeminiThinkingBudget: {
    label: '思考预算',
    type: 'integer',
    /**
     * can be overwritten, as gemini models seem to have different ranges which also does not include 0
     * - value = 0 disables thinking
     * - value = undefined means 'auto thinking budget'.
     */
    range: [0, 24576] as const,
    // initialValue: unset, // auto-budgeting
    description: '扩展思考的预算。0 为禁用思考。如果未设置，模型将自动选择。',
  },

  llmVndGeminiThinkingLevel: {
    label: '思考等级',
    type: 'enum',
    description: '控制 Gemini 3 Pro 的内部推理深度。未设置时，模型动态决定。',
    values: ['high', 'low'] as const,
    // No initialValue - undefined means 'dynamic', which for Gemini Pro is the same as 'high'
  },

  llmVndGeminiThinkingLevel4: {
    label: '思考等级',
    type: 'enum',
    description: '控制 Gemini 3 Flash 的内部推理深度。未设置时，模型动态决定。',
    values: ['high', 'medium', 'low', 'minimal'] as const,
    // No initialValue - undefined means 'dynamic'
  },

  // NOTE: we don't have this as a parameter, as for now we use it in tandem with llmVndGeminiGoogleSearch
  // llmVndGeminiUrlContext: {
  //   label: 'URL Context',
  //   type: 'enum' as const,
  //   description: 'Enable fetching and analyzing content from URLs provided in prompts (up to 20 URLs, 34MB each)',
  //   values: ['auto'] as const,
  //   // No initialValue - undefined means off
  // } as const,

  // Moonshot-specific parameters

  llmVndMoonReasoningEffort: {
    label: '推理强度',
    type: 'enum',
    description: '控制 Kimi K2.5 的思考深度。High 启用扩展多步推理（默认）。',
    values: ['none', 'high'] as const,
    // No initialValue - undefined means high (thinking enabled, the default for K2.5)
  },

  llmVndMoonshotWebSearch: { // implies: LLM_IF_Tools_WebSearch
    label: '网络搜索',
    type: 'enum',
    description: '启用 Kimi 的 $web_search 内置函数进行实时网络搜索（每次搜索 $0.005）',
    values: ['auto'] as const,
    // No initialValue - undefined means off
  },

  // OpenAI-specific parameters
  // Reasoning effort levels per model:
  // - GPT-5: minimal, low, medium (default), high
  // - GPT-5.1: none (default), low, medium, high
  // - GPT-5.2: none (default), low, medium, high, xhigh
  // - GPT-5.2 Pro: medium (default), high, xhigh

  llmVndOaiReasoningEffort: {
    label: '推理强度',
    type: 'enum',
    description: '限制 OpenAI 推理模的推理强度',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  },

  llmVndOaiReasoningEffort4: {
    label: '推理强度',
    type: 'enum',
    description: '限制 OpenAI 高级推理模型的推理强度',
    values: ['minimal', 'low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  },

  llmVndOaiReasoningEffort52: {
    label: '推理强度',
    type: 'enum',
    description: '限制 GPT-5.2 模型的推理强度。未设置时，默认为 none（快速响应）。',
    values: ['none', 'low', 'medium', 'high', 'xhigh'] as const,
    // No requiredFallback - unset = none (the default for GPT-5.2)
    // No initialValue - starts undefined, which the UI should display as "none"
  },

  llmVndOaiReasoningEffort52Pro: {
    label: '推理强度',
    type: 'enum',
    description: '限制 GPT-5.2 Pro 的推理强度。默认为 medium。',
    values: ['medium', 'high', 'xhigh'] as const,
    // No requiredFallback - unset = medium (the default for GPT-5.2 Pro)
  },

  llmVndOaiRestoreMarkdown: {
    label: '恢复 Markdown',
    type: 'boolean',
    description: '恢复输出中的 Markdown 格式',
    initialValue: true,
  },

  llmVndOaiVerbosity: {
    label: '详细程度',
    type: 'enum',
    description: '控制响应长度和详细级别',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  },

  llmVndOaiWebSearchContext: { // implies: LLM_IF_Tools_WebSearch
    label: '搜索上下文大小',
    type: 'enum',
    description: '从网络检索的上下文数量',
    values: ['low', 'medium', 'high'] as const,
    requiredFallback: 'medium',
  },

  llmVndOaiWebSearchGeolocation: {
    // NOTE: for now this is a boolean to enable/disable using client-side geolocation, but
    // in the future we could have it a more complex object. Note that the payload that comes
    // back if of type AixAPI_Model.userGeolocation, which is the AIX Wire format for the
    // location payload.
    label: '添加用户位置 (地理位置 API)',
    type: 'boolean',
    description: '搜索结果的大致位置',
    initialValue: false,
  },

  llmVndOaiImageGeneration: { // implies: LLM_IF_Outputs_Image
    label: '图像生成',
    type: 'enum',
    description: '图像生成模式和质量',
    values: ['mq', 'hq', 'hq_edit' /* precise input editing */, 'hq_png' /* uncompressed */] as const,
    // No initialValue - defaults to undefined (off)
    // No requiredFallback - this is optional
  },

  llmVndOaiCodeInterpreter: {
    label: '代码解释器',
    type: 'enum',
    description: 'Python 代码执行（$0.03/容器）',
    values: ['off', 'auto'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  // Perplexity-specific parameters

  // llmVndPerplexityReasoningEffort - we reuse the OpenAI reasoning effort parameter

  llmVndPerplexityDateFilter: {
    label: '日期范围',
    type: 'enum',
    description: '按发布日期过滤结果',
    values: ['unfiltered', '1m', '3m', '6m', '1y'] as const,
    // requiredFallback: 'unfiltered',
  },

  llmVndOrtWebSearch: { // implies: LLM_IF_Tools_WebSearch
    label: '网络搜索',
    type: 'enum',
    description: '启用 OpenRouter 网络搜索（OpenAI/Anthropic 使用原生搜索，其他使用 Exa）',
    values: ['auto'] as const,
    // No initialValue - undefined means off
  },

  llmVndPerplexitySearchMode: { // implies: LLM_IF_Tools_WebSearch
    label: '搜索模式',
    type: 'enum',
    description: '搜索来源类型',
    values: ['default', 'academic'] as const,
    // requiredFallback: 'default', // or leave unset for "unspecified"
  },

  // xAI-specific parameters

  llmVndXaiCodeExecution: {
    label: '代码执行',
    type: 'enum',
    description: '启用模型服务端代码执行',
    values: ['off', 'auto'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  llmVndXaiSearchInterval: {
    label: '搜索间隔', // "X Search only" for now, fw comp to web search
    type: 'enum',
    description: '在此间隔内搜索',
    values: ['unfiltered', '1d', '1w', '1m', '6m', '1y'] as const,
    // No initialValue - undefined means unfiltered
  },

  llmVndXaiWebSearch: { // implies: LLM_IF_Tools_WebSearch
    label: '网络搜索',
    type: 'enum',
    description: '启用网络搜索以获取实时信息',
    values: ['off', 'auto'] as const,
    // No initialValue - undefined means off (same as 'off')
  },

  llmVndXaiXSearch: { // implies: LLM_IF_Tools_WebSearch
    label: 'X 搜索',
    type: 'enum',
    description: '启用 X/Twitter 搜索社交媒体内容',
    values: ['off', 'auto'] as const,
    // NOTE: disabling or this could be slow
    // initialValue: 'auto', // we default to 'auto' for our users, as they may expect "X search" out of the box
  },

  llmVndXaiXSearchHandles: {
    label: 'X 账号过滤',
    type: 'string',
    description: '将 X 搜索过滤为特定账号（逗号分隔，例如 @elonmusk, @xai）',
    // initialValue: '', // empty = no filter
  },

} as const satisfies Record<string, _ParameterRegistryEntry>;


/// Types

/** Stores runtime parameter values (initial and user overrides). */
export type DModelParameterValues = {
  [K in DModelParameterId]?: DModelParameterValue<K>;
};

export type DModelParameterId = keyof typeof DModelParameterRegistry;

/** Maps a parameter ID to its TypeScript value type (with nullable handling). */
export type DModelParameterValue<T extends DModelParameterId> =
  typeof DModelParameterRegistry[T] extends { nullable: object }
    ? _ParamTypeToBaseValue<T> | null
    : _ParamTypeToBaseValue<T>;


// helper: map parameter type to base TypeScript type (before nullable handling)
type _ParamTypeToBaseValue<T extends DModelParameterId> =
  typeof DModelParameterRegistry[T]['type'] extends 'integer' ? number :
    typeof DModelParameterRegistry[T]['type'] extends 'float' ? number :
      typeof DModelParameterRegistry[T]['type'] extends 'string' ? string :
        typeof DModelParameterRegistry[T]['type'] extends 'boolean' ? boolean :
          typeof DModelParameterRegistry[T]['type'] extends 'enum' ? _EnumValues<typeof DModelParameterRegistry[T]> :
            never;

type _EnumValues<T> = T extends { readonly type: 'enum'; readonly values: readonly (infer U)[] } ? U : never;


/**
 * Union of all possible model parameter specifications.
 */
export type DModelParameterSpecAny = {
  [K in DModelParameterId]: DModelParameterSpec<K>;
}[DModelParameterId];

/**
 * Model-specific parameter configuration
 * Defines which parameters a model supports and their per-model settings.
 *
 * Note: This is the client-side TypeScript definition that matches
 * ModelParameterSpec_schema in `llm.server.types.ts`.
 */
interface DModelParameterSpec<T extends DModelParameterId> {
  paramId: T;
  required?: boolean;
  hidden?: boolean;
  initialValue?: DModelParameterValue<T>;
  // upstreamDefault?: DModelParameterValue<T>;
  /**
   * (optional, rare) Special: [min, max] range override for this parameter.
   * Used by llmVndGeminiThinkingBudget to allow different ranges for different models.
   */
  rangeOverride?: [number, number];
}


/// Utility Functions

export function applyModelParameterSpecsInitialValues(destValues: DModelParameterValues, modelParameterSpecs: DModelParameterSpecAny[], overwriteExisting: boolean): void {
  for (const parameterSpec of modelParameterSpecs) {
    const paramId = parameterSpec.paramId;

    // skip if already present
    // NOTE: for the currently only caller, the destValues already has llmRef, llmTemperature, llmResponseTokens
    if (!overwriteExisting && paramId in destValues)
      continue;

    // 1. (if present) apply Spec.initialValue
    if (parameterSpec.initialValue !== undefined) {
      destValues[paramId] = parameterSpec.initialValue as DModelParameterValue<typeof paramId>;
      continue;
    }

    // 2. (if present) apply Registry[paramId].initialValue
    const registryDef = DModelParameterRegistry[paramId];
    if (registryDef) {
      if ('initialValue' in registryDef && registryDef.initialValue !== undefined)
        destValues[paramId] = registryDef.initialValue as DModelParameterValue<typeof paramId>;
    } else
      console.warn(`applyModelParameterInitialValues: unknown parameter id '${paramId}'`);
  }
}


/**
 * Implicit common parameters always supported by all models, not listed in parameterSpecs.
 * Must be preserved during model refresh operations.
 */
export const LLMS_ImplicitParamIds: readonly DModelParameterId[] = [
  // 'llmRef', // disabled: we know this can't have a fallback value in the registry
  'llmResponseTokens', // DModelParameterRegistry.llmResponseTokens.requiredFallback = FALLBACK_LLM_PARAM_RESPONSE_TOKENS
  'llmTemperature', // DModelParameterRegistry.llmTemperature.requiredFallback = FALLBACK_LLM_PARAM_TEMPERATURE
];

export function getAllModelParameterValues(initialParameters: undefined | DModelParameterValues, userParameters?: DModelParameterValues): DModelParameterValues {

  // fallback values
  const fallbackParameters: DModelParameterValues = {};
  for (const requiredParamId of LLMS_ImplicitParamIds) {
    if ('requiredFallback' in DModelParameterRegistry[requiredParamId])
      fallbackParameters[requiredParamId] = DModelParameterRegistry[requiredParamId].requiredFallback as DModelParameterValue<typeof requiredParamId>;
  }

  // accumulate initial and user values
  return {
    ...fallbackParameters,
    ...initialParameters,
    ...userParameters,
  };
}


/**
 * NOTE: this is actually only used for `llmResponseTokens` from the Composer for now (!)
 */
export function getModelParameterValueOrThrow<T extends DModelParameterId>(
  paramId: T,
  initialValues: undefined | DModelParameterValues,
  userValues: undefined | DModelParameterValues,
  fallbackValue: undefined | DModelParameterValue<T>,
): DModelParameterValue<T> {

  // check user values first
  if (userValues && paramId in userValues) {
    const value = userValues[paramId];
    if (value !== undefined) return value;
  }

  // then check initial values
  if (initialValues && paramId in initialValues) {
    const value = initialValues[paramId];
    if (value !== undefined) return value;
  }

  // then try provided fallback
  if (fallbackValue !== undefined) return fallbackValue;

  // finally the global registry fallback
  const paramDef = DModelParameterRegistry[paramId];
  if ('requiredFallback' in paramDef && paramDef.requiredFallback !== undefined)
    return paramDef.requiredFallback as DModelParameterValue<T>;

  // if we're here, we couldn't find a value
  // [DANGER] VERY DANGEROUS, but shall NEVER happen
  throw new Error(`getModelParameterValue: missing required parameter '${paramId}'`);
}
