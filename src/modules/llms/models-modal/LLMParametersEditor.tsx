import * as React from 'react';

import { Box, IconButton, Tooltip } from '@mui/joy';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ClearIcon from '@mui/icons-material/Clear';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

import type { DLLMMaxOutputTokens } from '~/common/stores/llms/llms.types';
import { DModelParameterId, DModelParameterRegistry, DModelParameterSpecAny, DModelParameterValues, FALLBACK_LLM_PARAM_RESPONSE_TOKENS, getAllModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { FormSelectControl } from '~/common/components/forms/FormSelectControl';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { useUIComplexityMode } from '~/common/stores/store-ui';
import { webGeolocationRequest } from '~/common/util/webGeolocationUtils';

import { AnthropicSkillsConfig } from './AnthropicSkillsConfig';


const _UNSPECIFIED = '_UNSPECIFIED' as const;
const _reasoningEffortOptions = [
  { value: 'high', label: '高', description: '深度、全面的分析' } as const,
  { value: 'medium', label: '中', description: '平衡的推理深度' } as const,
  { value: 'low', label: '低', description: '快速、简洁的响应' } as const,
  { value: _UNSPECIFIED, label: '默认', description: '默认值（未设置）' } as const,
] as const;
const _reasoningEffort4Options = [
  { value: 'high', label: '高', description: '深度、全面的分析' } as const,
  { value: 'medium', label: '中', description: '平衡的推理深度' } as const,
  { value: 'low', label: '低', description: '快速、简洁的响应' } as const,
  { value: 'minimal', label: '极低', description: '最快、最便宜、最少推理' } as const,
  { value: _UNSPECIFIED, label: '默认', description: '默认值（未设置）' } as const,
] as const;
const _reasoningEffort52Options = [
  { value: 'xhigh', label: '极高', description: '最强思考、最佳质量' } as const,
  { value: 'high', label: '高', description: '深度、全面的分析' } as const,
  { value: 'medium', label: '中', description: '平衡的推理深度' } as const,
  { value: 'low', label: '低', description: '快速、简洁的响应' } as const,
  { value: _UNSPECIFIED, label: '无', description: '默认（无推理）' } as const,
] as const;
const _reasoningEffort52ProOptions = [
  { value: 'xhigh', label: '极高', description: '最强思考、最佳质量' } as const,
  { value: 'high', label: '高', description: '深度、全面的分析' } as const,
  { value: 'medium', label: '中', description: '平衡的推理深度' } as const,
  { value: _UNSPECIFIED, label: '默认', description: '默认（中）' } as const,
] as const;
const _verbosityOptions = [
  { value: 'high', label: '详细', description: '详尽的响应，适合审计' } as const,
  { value: 'medium', label: '平衡', description: '标准详细级别（默认）' } as const,
  { value: 'low', label: '简略', description: '简洁的响应' } as const,
  { value: _UNSPECIFIED, label: '默认', description: '默认值（未设置）' } as const,
] as const;
const _webSearchContextOptions = [
  { value: 'high', label: '综合', description: '最大范围、最高成本、较慢' } as const,
  { value: 'medium', label: '中等', description: '平衡的上下文、成本和速度' } as const,
  { value: 'low', label: '低', description: '最小范围、最便宜、最快' } as const,
  { value: _UNSPECIFIED, label: '关闭', description: '默认（禁用）' } as const,
] as const;
const _perplexitySearchModeOptions = [
  { value: _UNSPECIFIED, label: '默认', description: '通用网络来源' },
  { value: 'academic', label: '学术', description: '学术和同行评审来源' },
] as const;
const _perplexityDateFilterOptions = [
  { value: _UNSPECIFIED, label: '所有时间', description: '无日期限制' },
  { value: '1m', label: '上个月', description: '过去 30 天的结果' },
  { value: '3m', label: '过去 3 个月', description: '过去 90 天的结果' },
  { value: '6m', label: '过去 6 个月', description: '过去 6 个月的结果' },
  { value: '1y', label: '去年', description: '过去 12 个月的结果' },
] as const;

const _geminiAspectRatioOptions = [
  { value: _UNSPECIFIED, label: '自动', description: '模型决定' },
  { value: '1:1', label: '1:1', description: '正方形' },
  { value: '2:3', label: '2:3', description: '纵向' },
  { value: '3:2', label: '3:2', description: '横向' },
  { value: '3:4', label: '3:4', description: '纵向' },
  { value: '4:3', label: '4:3', description: '横向' },
  { value: '9:16', label: '9:16', description: '高纵向' },
  { value: '16:9', label: '16:9', description: '宽横向' },
  { value: '21:9', label: '21:9', description: '超宽' },
] as const;

const _geminiImageSizeOptions = [
  { value: _UNSPECIFIED, label: '默认', description: '1K（默认）' },
  { value: '1K', label: '1K', description: '默认' },
  { value: '2K', label: '2K', description: '2K' },
  { value: '4K', label: '4K', description: '4K' },
] as const;

const _geminiCodeExecutionOptions = [
  { value: 'auto', label: '开启', description: '启用代码生成和执行' },
  { value: _UNSPECIFIED, label: '关闭', description: '禁用（默认）' },
] as const;

const _geminiGoogleSearchOptions = [
  { value: 'unfiltered', label: '开启', description: '网络搜索' },
  { value: '1d', label: '过去一天', description: '过去 24 小时' },
  { value: '1w', label: '过去一周', description: '最近的结果' },
  { value: '1m', label: '上个月', description: '上个月的结果' },
  { value: '1y', label: '去年', description: '去年的结果' },
  // { value: '6m', label: 'Last 6 Months', description: 'Results from last 6 months' },
  { value: _UNSPECIFIED, label: '关闭', description: '默认（禁用）' },
] as const;

const _geminiMediaResolutionOptions = [
  { value: 'mr_high', label: '高', description: '最佳质量，较高 Token 使用量' },
  { value: 'mr_medium', label: '中', description: '平衡质量和成本' },
  { value: 'mr_low', label: '低', description: '更快，更低成本' },
  { value: _UNSPECIFIED, label: '自动', description: '模型根据媒体类型决定' },
] as const;

// Gemini 3 Pro: 2-level thinking (high, low)
const _geminiThinkingLevelOptions = [
  { value: 'high', label: '高', description: '最大推理深度' },
  { value: 'low', label: '低', description: '快速响应' },
  { value: _UNSPECIFIED, label: '默认', description: '模型决定' },
] as const;

// Gemini 3 Flash: 4-level thinking (high, medium, low, minimal)
const _geminiThinkingLevel4Options = [
  { value: 'high', label: '高', description: '最大推理深度' },
  { value: 'medium', label: '中', description: '平衡推理' },
  { value: 'low', label: '低', description: '快速响应' },
  { value: 'minimal', label: '极低', description: '最快，最少推理' },
  { value: _UNSPECIFIED, label: '默认', description: '模型决定' },
] as const;

const _antWebSearchOptions = [
  { value: 'auto', label: '开启', description: '启用网络搜索以获取实时信息' },
  { value: _UNSPECIFIED, label: '关闭', description: '禁用（默认）' },
] as const;

const _antWebFetchOptions = [
  { value: 'auto', label: '开启', description: '启用获取网页内容和 PDF' },
  { value: _UNSPECIFIED, label: '关闭', description: '禁用（默认）' },
] as const;

const _antEffortOptions = [
  { value: 'high', label: '高', description: '最大能力' },
  { value: 'medium', label: '中', description: '平衡速度和质量' },
  { value: 'low', label: '低', description: '最快，最高效' },
  { value: _UNSPECIFIED, label: '默认', description: '默认值（高）' },
] as const;

const _antEffortMaxOptions = [
  { value: 'max', label: '最大', description: '最深层推理' },
  { value: 'high', label: '高', description: '最大能力' },
  { value: 'medium', label: '中', description: '平衡' },
  { value: 'low', label: '低', description: '最高效' },
  { value: _UNSPECIFIED, label: '默认', description: '默认值（高）' },
] as const;

const _moonReasoningEffortOptions = [
  { value: 'high', label: '开启', description: '多步推理' },
  { value: 'none', label: '关闭', description: '禁用思考模式' },
  { value: _UNSPECIFIED, label: '默认', description: '默认（开启）' },
] as const;

// const _moonshotWebSearchOptions = [
//   { value: 'auto', label: 'On', description: 'Enable Kimi $web_search ($0.005 per search)' },
//   { value: _UNSPECIFIED, label: 'Off', description: 'Disabled (default)' },
// ] as const;

const _ortWebSearchOptions = [
  { value: 'auto', label: '开启', description: '启用网络搜索（OpenAI/Anthropic原生，其他使用Exa）' },
  { value: _UNSPECIFIED, label: '关闭', description: '禁用（默认）' },
] as const;

const _imageGenerationOptions = [
  { value: _UNSPECIFIED, label: '关闭', description: '默认（禁用）' },
  { value: 'mq', label: '标准', description: '快速生成' },
  { value: 'hq', label: '高质量', description: '最佳观感' },
  { value: 'hq_edit', label: '精确编辑', description: '可控' },
  // { value: 'hq_png', label: 'HD PNG', description: 'Uncompressed' }, // TODO: re-enable when uncompressed PNG saving is implemented
] as const;

const _oaiCodeInterpreterOptions = [
  { value: 'auto', label: '开启', description: 'Python 代码执行（$0.03/容器）' },
  { value: _UNSPECIFIED, label: '关闭', description: '禁用（默认）' },
] as const;


// XAI

const _xaiWebSearchOptions = [
  { value: 'auto', label: '开启', description: '实时网络结果' },
  { value: _UNSPECIFIED, label: '关闭', description: '禁用（默认）' },
] as const;

const _xaiXSearchOptions = [
  { value: 'auto', label: '开启', description: '激活（Big-AGI 默认）' },
  { value: 'off', label: '关闭', description: '禁用' },
] as const;

const _xaiCodeExecutionOptions = [
  { value: 'auto', label: '开启', description: '服务端代码执行' },
  { value: _UNSPECIFIED, label: '关闭', description: '禁用（默认）' },
] as const;

const _xaiSearchIntervalOptions = [
  { value: _UNSPECIFIED, label: '无过滤', description: '无日期限制' },
  // Note: the wire format also accepts 'unfiltered', but we use _UNSPECIFIED (undefined) for clarity - both are equivalent on the server
  // { value: 'unfiltered', ... },
  { value: '1d', label: '过去一天', description: '过去 24 小时结果' },
  { value: '1w', label: '过去一周', description: '过去 7 天的结果' },
  { value: '1m', label: '上个月', description: '过去 30 天的结果' },
  { value: '6m', label: '过去 6 个月', description: '过去 6 个月的结果' },
  { value: '1y', label: '去年', description: '过去 12 个月的结果' },
] as const;


export function LLMParametersEditor(props: {
  // constants
  maxOutputTokens: DLLMMaxOutputTokens,
  parameterSpecs: DModelParameterSpecAny[],
  parameterOmitTemperature?: boolean,
  baselineParameters: DModelParameterValues,

  // value and onChange for the parameters
  parameters: undefined | DModelParameterValues,
  onChangeParameter: (parameterValue: DModelParameterValues) => void,
  onRemoveParameter: (parameterId: DModelParameterId) => void,

  // rendering options
  simplified?: boolean,
}) {

  // external state
  const isExtra = useUIComplexityMode() === 'extra';


  // registry (const) values
  const defAntTB = DModelParameterRegistry['llmVndAntThinkingBudget'];
  const defGemTB = DModelParameterRegistry['llmVndGeminiThinkingBudget'];

  // specs: whether a models supports a parameter
  const modelParamSpec = React.useMemo(() =>
      Object.fromEntries((props.parameterSpecs ?? []).map(spec => [spec.paramId, spec]))
    , [props.parameterSpecs]);


  // current values: { ...fallback, ...baseline, ...user }
  const allParameters = getAllModelParameterValues(props.baselineParameters, props.parameters);
  const {
    llmResponseTokens = FALLBACK_LLM_PARAM_RESPONSE_TOKENS, // fallback for undefined, result is number | null
    llmTemperature, // null: no temperature, number: temperature value, undefined: shall not happen, we treat is similarly to null
    llmForceNoStream,
    llmVndAnt1MContext,
    llmVndAntEffort,
    llmVndAntEffortMax,
    llmVndAntSkills,
    llmVndAntThinkingBudget,
    llmVndAntWebFetch,
    llmVndAntWebSearch,
    llmVndGeminiAspectRatio,
    llmVndGeminiCodeExecution,
    llmVndGeminiGoogleSearch,
    llmVndGeminiImageSize,
    llmVndGeminiMediaResolution,
    llmVndGeminiShowThoughts,
    llmVndGeminiThinkingBudget,
    llmVndGeminiThinkingLevel,
    llmVndGeminiThinkingLevel4,
    llmVndMoonReasoningEffort,
    // llmVndMoonshotWebSearch,
    llmVndOaiReasoningEffort,
    llmVndOaiReasoningEffort4,
    llmVndOaiReasoningEffort52,
    llmVndOaiReasoningEffort52Pro,
    llmVndOaiRestoreMarkdown,
    llmVndOaiWebSearchContext,
    llmVndOaiWebSearchGeolocation,
    llmVndOaiImageGeneration,
    llmVndOaiCodeInterpreter,
    llmVndOaiVerbosity,
    llmVndOrtWebSearch,
    llmVndPerplexityDateFilter,
    llmVndPerplexitySearchMode,

    llmVndXaiCodeExecution,
    llmVndXaiSearchInterval,
    llmVndXaiWebSearch,
    llmVndXaiXSearch,
    llmVndXaiXSearchHandles,
  } = allParameters;


  // state (here because the initial state depends on props)
  const tempAboveOne = llmTemperature !== null && llmTemperature !== undefined && llmTemperature > 1;
  const [overheat, setOverheat] = React.useState(tempAboveOne);
  const showOverheatButton = overheat || llmTemperature === 1 || tempAboveOne;


  // handlers

  const { onChangeParameter, onRemoveParameter } = props;

  const handleOverheatToggle = React.useCallback(() => {
    // snap to 1 when disabling overheating
    if (overheat && tempAboveOne)
      onChangeParameter({ llmTemperature: 1 });

    // toggle overheating
    setOverheat(on => !on);
  }, [onChangeParameter, overheat, tempAboveOne]);


  // semantics
  function showParam(paramId: DModelParameterId): boolean {
    return paramId in modelParamSpec && !modelParamSpec[paramId].hidden;
  }

  // Anthropic adaptive(-1)/extended(>1024) thinking disables temperature control
  const _antThinkingDefined = 'llmVndAntThinkingBudget' in modelParamSpec;
  const antThinkingEnabled = _antThinkingDefined && !!llmVndAntThinkingBudget; // both mullish mean "off"
  const antThinkingEnabled_Adaptive = antThinkingEnabled && llmVndAntThinkingBudget === -1;
  const antThinkingShown = _antThinkingDefined && !modelParamSpec['llmVndAntThinkingBudget'].hidden;

  const gemThinkingAuto = llmVndGeminiThinkingBudget === undefined;
  const gemThinkingOff = llmVndGeminiThinkingBudget === 0;

  // Get the range override if available for Gemini thinking budget
  const gemTBSpec = modelParamSpec['llmVndGeminiThinkingBudget'];
  const gemTBMinMax = gemTBSpec?.rangeOverride || defGemTB.range;

  // Check if web search should be disabled due to minimal/none reasoning effort
  const isOaiReasoningEffortMinimal = llmVndOaiReasoningEffort4 === 'minimal' || llmVndOaiReasoningEffort52 === 'none';

  return <>

    {!(props.simplified && props.parameterOmitTemperature) && <FormSliderControl
      title={<span style={{ minWidth: 100 }}>温度</span>} ariaLabel='Model Temperature'
      description={
        antThinkingEnabled_Adaptive ? '关闭 (自适应)' : antThinkingEnabled ? '关闭 (思考中)'
          : llmTemperature === null ? '不支持'
            : llmTemperature === undefined ? '默认'
              : llmTemperature < 0.33 ? '更严谨'
                : llmTemperature > 1 ? '超高随机性 ♨️'
                  : llmTemperature > 0.67 ? '更高自由度' : '创造力'
      }
      disabled={props.parameterOmitTemperature /* set when LLM_IF_HOTFIX_NoTemperature */ || antThinkingEnabled}
      min={0}
      max={overheat ? 2 : 1}
      step={0.1}
      defaultValue={0.5 /* FIXME: this wasn't FALLBACK_LLM_PARAM_TEMPERATURE, but we shall not need this */}
      valueLabelDisplay={props.parameters?.llmTemperature === undefined || antThinkingEnabled ? 'auto' : 'on'} // detect user-overridden or not
      value={llmTemperature ?? (overheat ? [1, 1] : [0.5, 0.5]) /* null and undefined both would become undefined (uncontrolled) in the slider */}
      onChange={value => onChangeParameter({ llmTemperature: value })}
      endAdornment={
        <Tooltip arrow disableInteractive title={overheat ? '禁用 LLM 过热模式' : '将最大温度提高到 2'} sx={{ p: 1 }}>
          <IconButton
            disabled={!showOverheatButton}
            variant={overheat ? 'soft' : 'plain'} color={overheat ? 'danger' : 'neutral'}
            onClick={handleOverheatToggle} sx={{ ml: 2 }}
          >
            <LocalFireDepartmentIcon />
          </IconButton>
        </Tooltip>
      }
    />}

    {llmResponseTokens === null || props.maxOutputTokens === null ? (
      <InlineError error='最大输出 Token：由于此模型未声明上下文窗口大小，Token 计算已禁用。' />
    ) : !props.simplified && (
      <Box sx={{ mr: 1 }}>
        <FormSliderControl
          title={<span style={{ minWidth: 100 }}>输出 Token</span>} ariaLabel='Model Max Tokens'
          description='最大长度'
          min={256} max={props.maxOutputTokens} step={256} defaultValue={1024}
          valueLabelDisplay={props.parameters?.llmResponseTokens !== undefined ? 'on' : 'auto'} // detect user-overridden or not
          value={llmResponseTokens}
          onChange={value => onChangeParameter({ llmResponseTokens: value })}
        />
      </Box>
    )}

    {antThinkingShown && (
      <FormSliderControl
        title={antThinkingEnabled ? '思考预算' : '禁用'} ariaLabel='Anthropic Extended Thinking Token Budget'
        description='Token'
        min={defAntTB.range[0]} max={defAntTB.range[1]} step={1024}
        valueLabelDisplay={antThinkingEnabled ? 'on' : 'off'}
        value={llmVndAntThinkingBudget ?? 0}
        disabled={!antThinkingEnabled}
        onChange={value => onChangeParameter({ llmVndAntThinkingBudget: value })}
        endAdornment={
          <Tooltip arrow disableInteractive title={antThinkingEnabled ? '禁用思考' : '启用思考'}>
            <IconButton
              variant={antThinkingEnabled ? 'outlined' : 'solid'}
              onClick={() => antThinkingEnabled
                ? onChangeParameter({ llmVndAntThinkingBudget: null })
                : onRemoveParameter('llmVndAntThinkingBudget')
              }
              sx={{ ml: 2 }}
            >
              <ClearIcon />
            </IconButton>
          </Tooltip>
        }
      />
    )}

    {showParam('llmVndAntEffortMax') && (
      <FormSelectControl
        title='思考强度'
        tooltip='控制思考深度。Max = 无限制的最深推理。High = 默认能力。Low = 最快、最高效。'
        value={llmVndAntEffortMax ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndAntEffortMax');
          else onChangeParameter({ llmVndAntEffortMax: value });
        }}
        options={_antEffortMaxOptions}
      />
    )}

    {showParam('llmVndAntEffort') && (
      <FormSelectControl
        title='思考强度'
        tooltip='控制 Token 使用量与全面性的权衡。Low = 最快、最高效。High = 最大能力（默认）。与思考预算配合使用。'
        value={llmVndAntEffort ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndAntEffort');
          else onChangeParameter({ llmVndAntEffort: value });
        }}
        options={_antEffortOptions}
      />
    )}

    {showParam('llmVndAntWebSearch') && (
      <FormSelectControl
        title='网络搜索'
        tooltip='启用网络搜索以获取实时信息'
        value={llmVndAntWebSearch ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value || value === 'off') onRemoveParameter('llmVndAntWebSearch');
          else onChangeParameter({ llmVndAntWebSearch: value });
        }}
        options={_antWebSearchOptions}
      />
    )}

    {showParam('llmVndAntWebFetch') && (
      <FormSelectControl
        title='网页获取'
        tooltip='启用获取网页和 PDF 文档的完整内容'
        value={llmVndAntWebFetch ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value || value === 'off') onRemoveParameter('llmVndAntWebFetch');
          else onChangeParameter({ llmVndAntWebFetch: value });
        }}
        options={_antWebFetchOptions}
      />
    )}

    {showParam('llmVndAnt1MContext') && (
      <FormSwitchControl
        title='1M 上下文窗口 (Beta)'
        description='启用 1M Token 上下文'
        tooltip='启用 1M Token 上下文窗口（大于 200K 输入 Token 时采用高级定价）。 - https://docs.claude.com/en/docs/build-with-claude/context-windows#1m-token-context-window'
        checked={!!llmVndAnt1MContext}
        onChange={checked => {
          if (!checked) onRemoveParameter('llmVndAnt1MContext');
          else onChangeParameter({ llmVndAnt1MContext: true });
        }}
      />
    )}

    {isExtra && showParam('llmVndAntSkills') && (
      <AnthropicSkillsConfig llmVndAntSkills={llmVndAntSkills} onChangeParameter={onChangeParameter} onRemoveParameter={onRemoveParameter} />
    )}


    {showParam('llmVndGeminiImageSize') && (
      <FormSelectControl
        title='图像尺寸'
        tooltip='控制生成图像的分辨率'
        value={llmVndGeminiImageSize ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiImageSize');
          else onChangeParameter({ llmVndGeminiImageSize: value });
        }}
        options={_geminiImageSizeOptions}
      />
    )}

    {showParam('llmVndGeminiAspectRatio') && (
      <FormSelectControl
        title='宽高比'
        tooltip='控制生成图像的宽高比'
        value={llmVndGeminiAspectRatio ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiAspectRatio');
          else onChangeParameter({ llmVndGeminiAspectRatio: value });
        }}
        options={_geminiAspectRatioOptions}
      />
    )}


    {showParam('llmVndGeminiGoogleSearch') && (
      <FormSelectControl
        title='谷歌搜索'
        // tooltip='Enable Google Search grounding to ground responses in real-time web content. Optionally filter results by publication date.'
        value={llmVndGeminiGoogleSearch ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiGoogleSearch');
          else onChangeParameter({ llmVndGeminiGoogleSearch: value });
        }}
        options={_geminiGoogleSearchOptions}
      />
    )}


    {showParam('llmVndGeminiShowThoughts') && (
      <FormSwitchControl
        title='显示推理'
        description='显示思维链'
        checked={!!llmVndGeminiShowThoughts}
        onChange={checked => onChangeParameter({ llmVndGeminiShowThoughts: checked })}
      />
    )}

    {showParam('llmVndGeminiThinkingBudget') && (
      <FormSliderControl
        title='思考预算' ariaLabel='Gemini Thinking Token Budget'
        description={gemThinkingAuto ? '自动' : gemThinkingOff ? '思考关闭' : 'Token'}
        min={gemTBMinMax[0]} max={gemTBMinMax[1]} step={1024}
        valueLabelDisplay={(gemThinkingAuto || gemThinkingOff) ? 'off' : 'on'}
        value={llmVndGeminiThinkingBudget ?? [gemTBMinMax[0], gemTBMinMax[1]]}
        variant={gemThinkingAuto ? 'soft' : undefined}
        // disabled={gemThinkingAuto}
        onChange={value => onChangeParameter({ llmVndGeminiThinkingBudget: Array.isArray(value) ? (value[0] || value[1]) : value })}
        startAdornment={gemTBMinMax[0] === 0 && (
          <Tooltip arrow disableInteractive title={gemThinkingOff ? '思考关闭' : '禁用思考'}>
            <IconButton
              variant={gemThinkingOff ? 'solid' : 'outlined'}
              // disabled={gemThinkingOff}
              onClick={() => onChangeParameter({ llmVndGeminiThinkingBudget: 0 })}
              sx={{ mr: 2 }}
            >
              {gemThinkingOff ? <ClearIcon sx={{ fontSize: 'lg' }} /> : <PowerSettingsNewIcon />}
            </IconButton>
          </Tooltip>
        )}
        endAdornment={
          <Tooltip arrow disableInteractive title={gemThinkingAuto ? '自动思考（默认）' : '自动预算'}>
            <IconButton
              variant={gemThinkingAuto ? 'solid' : 'outlined'}
              // disabled={gemThinkingAuto}
              onClick={() => onRemoveParameter('llmVndGeminiThinkingBudget')}
              sx={{ ml: 2 }}
            >
              <AutoModeIcon sx={{ fontSize: 'xl' }} />
            </IconButton>
          </Tooltip>
        }
      />
    )}

    {showParam('llmVndGeminiThinkingLevel') && (
      <FormSelectControl
        title='思考等级'
        tooltip='控制 Gemini 3 Pro 的内部推理深度。未设置时，模型动态决定。'
        value={llmVndGeminiThinkingLevel ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiThinkingLevel');
          else onChangeParameter({ llmVndGeminiThinkingLevel: value });
        }}
        options={_geminiThinkingLevelOptions}
      />
    )}

    {showParam('llmVndGeminiThinkingLevel4') && (
      <FormSelectControl
        title='思考等级'
        tooltip='控制 Gemini 3 Flash 的内部推理深度。未设置时，模型动态决定。'
        value={llmVndGeminiThinkingLevel4 ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiThinkingLevel4');
          else onChangeParameter({ llmVndGeminiThinkingLevel4: value });
        }}
        options={_geminiThinkingLevel4Options}
      />
    )}

    {showParam('llmVndGeminiCodeExecution') && (
      <FormSelectControl
        title='代码执行'
        tooltip='启用模型自动生成和执行 Python 代码'
        value={llmVndGeminiCodeExecution ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiCodeExecution');
          else onChangeParameter({ llmVndGeminiCodeExecution: value });
        }}
        options={_geminiCodeExecutionOptions}
      />
    )}

    {showParam('llmVndGeminiMediaResolution') && (
      <FormSelectControl
        title='媒体分辨率'
        tooltip='控制多模态输入的视觉处理质量。高分辨率可提高文本阅读和细节识别能力，但会增加 Token 使用量。'
        value={llmVndGeminiMediaResolution ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndGeminiMediaResolution');
          else onChangeParameter({ llmVndGeminiMediaResolution: value });
        }}
        options={_geminiMediaResolutionOptions}
      />
    )}


    {showParam('llmVndMoonReasoningEffort') && (
      <FormSelectControl
        title='思考'
        tooltip='启用 Kimi K2.5 的扩展多步推理'
        value={llmVndMoonReasoningEffort ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndMoonReasoningEffort');
          else onChangeParameter({ llmVndMoonReasoningEffort: value });
        }}
        options={_moonReasoningEffortOptions}
      />
    )}

    {/*{showParam('llmVndMoonshotWebSearch') && (*/}
    {/*  <FormSelectControl*/}
    {/*    title='Web Search'*/}
    {/*    tooltip='Enable Kimi $web_search builtin function for real-time web search. Costs $0.005 per search. Use kimi-k2-turbo-preview for dynamic context handling.'*/}
    {/*    value={llmVndMoonshotWebSearch ?? _UNSPECIFIED}*/}
    {/*    onChange={(value) => {*/}
    {/*      if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndMoonshotWebSearch');*/}
    {/*      else onChangeParameter({ llmVndMoonshotWebSearch: value });*/}
    {/*    }}*/}
    {/*    options={_moonshotWebSearchOptions}*/}
    {/*  />*/}
    {/*)}*/}

    {showParam('llmVndPerplexitySearchMode') && (
      <FormSelectControl
        title='搜索模式'
        tooltip='搜索结果中优先考虑的来源类型'
        value={llmVndPerplexitySearchMode ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndPerplexitySearchMode');
          else
            onChangeParameter({ llmVndPerplexitySearchMode: value });
        }}
        options={_perplexitySearchModeOptions}
      />
    )}

    {showParam('llmVndOaiWebSearchContext') && (
      <FormSelectControl
        title='网络搜索'
        tooltip={isOaiReasoningEffortMinimal ? '网络搜索不兼容极低推理强度' : '控制从网络检索的上下文数量（low = Perplexity 默认，medium = OpenAI 默认）。对于 GPT-5 模型，默认为关闭。'}
        disabled={isOaiReasoningEffortMinimal}
        value={llmVndOaiWebSearchContext ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiWebSearchContext');
          else
            onChangeParameter({ llmVndOaiWebSearchContext: value });
        }}
        options={_webSearchContextOptions}
      />
    )}

    {showParam('llmVndOaiWebSearchGeolocation') && (
      <FormSwitchControl
        title='添加用户位置'
        description='使用大致位置以获得更好的搜索结果'
        tooltip={isOaiReasoningEffortMinimal ? '网络搜索地理位置不兼容极低推理强度' : '启用后，使用浏览器地理位置 API 提供大致位置数据，以提高搜索结果的相关性'}
        disabled={isOaiReasoningEffortMinimal}
        checked={!!llmVndOaiWebSearchGeolocation}
        onChange={checked => {
          if (!checked)
            onRemoveParameter('llmVndOaiWebSearchGeolocation');
          else {
            webGeolocationRequest().then((locationOrNull) => {
              if (locationOrNull)
                onChangeParameter({ llmVndOaiWebSearchGeolocation: true });
            });
          }
        }}
      />
    )}

    {showParam('llmVndPerplexityDateFilter') && (
      <FormSelectControl
        title='日期范围'
        tooltip='按发布日期过滤搜索结果'
        value={llmVndPerplexityDateFilter ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndPerplexityDateFilter');
          else
            onChangeParameter({ llmVndPerplexityDateFilter: value });
        }}
        options={_perplexityDateFilterOptions}
      />
    )}

    {showParam('llmVndOaiReasoningEffort') && (
      <FormSelectControl
        title='推理强度'
        tooltip='控制模型在推理上投入的精力'
        value={llmVndOaiReasoningEffort ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiReasoningEffort');
          else
            onChangeParameter({ llmVndOaiReasoningEffort: value });
        }}
        options={_reasoningEffortOptions}
      />
    )}

    {showParam('llmVndOaiReasoningEffort4') && (
      <FormSelectControl
        title='推理强度'
        tooltip='控制模型在推理上投入的精力（4 级）'
        value={llmVndOaiReasoningEffort4 ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiReasoningEffort4');
          else
            onChangeParameter({ llmVndOaiReasoningEffort4: value });
        }}
        options={_reasoningEffort4Options}
      />
    )}

    {showParam('llmVndOaiReasoningEffort52') && (
      <FormSelectControl
        title='推理强度'
        tooltip='控制模型在推理上投入的精力（GPT-5.2 为 5 级）'
        value={(!llmVndOaiReasoningEffort52 /*|| llmVndOaiReasoningEffort52 === 'none'*/) ? _UNSPECIFIED : llmVndOaiReasoningEffort52}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndOaiReasoningEffort52');
          else onChangeParameter({ llmVndOaiReasoningEffort52: value });
        }}
        options={_reasoningEffort52Options}
      />
    )}

    {showParam('llmVndOaiReasoningEffort52Pro') && (
      <FormSelectControl
        title='推理强度'
        tooltip='控制模型在推理上投入的精力（GPT-5.2 Pro 为 3 级）'
        value={(!llmVndOaiReasoningEffort52Pro /*|| llmVndOaiReasoningEffort52Pro === 'medium'*/) ? _UNSPECIFIED : llmVndOaiReasoningEffort52Pro}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndOaiReasoningEffort52Pro');
          else onChangeParameter({ llmVndOaiReasoningEffort52Pro: value });
        }}
        options={_reasoningEffort52ProOptions}
      />
    )}

    {showParam('llmVndOaiVerbosity') && (
      <FormSelectControl
        title='详细程度'
        tooltip='控制响应长度和详细级别'
        value={llmVndOaiVerbosity ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiVerbosity');
          else
            onChangeParameter({ llmVndOaiVerbosity: value });
        }}
        options={_verbosityOptions}
      />
    )}

    {showParam('llmVndOaiImageGeneration') && (
      <FormSelectControl
        title='图像生成'
        tooltip='配置图像生成模式和质量'
        value={llmVndOaiImageGeneration ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiImageGeneration');
          else
            onChangeParameter({ llmVndOaiImageGeneration: value });
        }}
        options={_imageGenerationOptions}
      />
    )}

    {showParam('llmVndOaiCodeInterpreter') && (
      <FormSelectControl
        title='代码解释器'
        tooltip='在沙盒容器中启用 Python 代码执行。费用为 $0.03/容器（闲置 20 分钟后过期）。'
        value={llmVndOaiCodeInterpreter ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value)
            onRemoveParameter('llmVndOaiCodeInterpreter');
          else
            onChangeParameter({ llmVndOaiCodeInterpreter: value });
        }}
        options={_oaiCodeInterpreterOptions}
      />
    )}

    {showParam('llmVndOaiRestoreMarkdown') && (
      <FormSwitchControl
        title='恢复 Markdown'
        description='启用 Markdown 格式化'
        tooltip='API 中的 o1 和 o3 模型会避免生成带有 Markdown 格式的响应。此选项向模型发出信号以重新启用响应中的 Markdown 格式化'
        checked={!!llmVndOaiRestoreMarkdown}
        onChange={checked => {
          if (!checked)
            onChangeParameter({ llmVndOaiRestoreMarkdown: false });
          else
            onChangeParameter({ llmVndOaiRestoreMarkdown: true });
        }}
      />
    )}

    {showParam('llmForceNoStream') && (
      <FormSwitchControl
        title='禁用流式传输'
        description='适用于未验证的 OpenAI 组织'
        tooltip='禁用流式传和推理摘要，这两者都需要 OpenAI 组织验证。如果在使用 GPT-5 模型时遇到验证错误，请启用此选项。'
        checked={!!llmForceNoStream}
        onChange={checked => {
          if (!checked)
            onRemoveParameter('llmForceNoStream');
          else
            onChangeParameter({ llmForceNoStream: true });
        }}
      />
    )}


    {showParam('llmVndOrtWebSearch') && (
      <FormSelectControl
        title='网络搜索'
        tooltip='启用 OpenRouter 网络搜索插件。OpenAI/Anthropic 模型使用生搜索，其他模型使用 Exa。在响应中添加网络引用。'
        value={llmVndOrtWebSearch ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndOrtWebSearch');
          else onChangeParameter({ llmVndOrtWebSearch: value });
        }}
        options={_ortWebSearchOptions}
      />
    )}


    {showParam('llmVndXaiCodeExecution') && (
      <FormSelectControl
        title='运行代码'
        value={llmVndXaiCodeExecution ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value || value === 'off') onRemoveParameter('llmVndXaiCodeExecution');
          else onChangeParameter({ llmVndXaiCodeExecution: value });
        }}
        options={_xaiCodeExecutionOptions}
      />
    )}

    {showParam('llmVndXaiWebSearch') && (
      <FormSelectControl
        title='网络搜索'
        value={llmVndXaiWebSearch ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value || value === 'off') onRemoveParameter('llmVndXaiWebSearch');
          else onChangeParameter({ llmVndXaiWebSearch: value });
        }}
        options={_xaiWebSearchOptions}
      />
    )}

    {showParam('llmVndXaiXSearch') && (
      <FormSelectControl
        title='X 搜索'
        value={llmVndXaiXSearch ?? 'off'}
        onChange={(value) => onChangeParameter({ llmVndXaiXSearch: value /* we don't remove because there's a default to this param, so we must user-override it */ })}
        options={_xaiXSearchOptions}
      />
    )}

    {showParam('llmVndXaiSearchInterval') && (
      <FormSelectControl
        title='X 搜索周期'
        disabled={llmVndXaiXSearch !== 'auto'}
        value={llmVndXaiSearchInterval ?? _UNSPECIFIED}
        onChange={(value) => {
          if (value === _UNSPECIFIED || !value) onRemoveParameter('llmVndXaiSearchInterval');
          else onChangeParameter({ llmVndXaiSearchInterval: value });
        }}
        options={_xaiSearchIntervalOptions}
      />
    )}

    {showParam('llmVndXaiXSearchHandles') && llmVndXaiXSearch === 'auto' && (
      <FormTextField
        autoCompleteId='xai-x-handles'
        title='X 搜索账号'
        description='可选过滤'
        placeholder='@user1, @user2'
        value={llmVndXaiXSearchHandles ?? ''}
        onChange={(value) => {
          if (!value.trim()) onRemoveParameter('llmVndXaiXSearchHandles');
          else onChangeParameter({ llmVndXaiXSearchHandles: value });
        }}
        inputSx={{ maxWidth: 220 }}
      />
    )}

  </>;
}