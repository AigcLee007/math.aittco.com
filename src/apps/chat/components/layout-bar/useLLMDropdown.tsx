import * as React from 'react';
import { Box, IconButton, ListItemButton, ListItemDecorator, useColorScheme } from '@mui/joy';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';
import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { DLLM, DLLMId, isLLMVisible, LLM_IF_OAI_Chat, LLM_IF_OAI_Responses } from '~/common/stores/llms/llms.types';
import { CHAT_MODEL_DESCRIPTIONS, isFixedTextModelId } from '~/common/models/chat-model-catalog';
import { DebouncedInputMemo } from '~/common/components/DebouncedInput';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';
import { OptimaBarControlMethods, OptimaBarDropdownMemo, OptimaDropdownItems } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { findModelsServiceOrNull, useModelsStore, llmsStoreActions } from '~/common/stores/llms/store-llms';
import { modelLabelTitleCase } from '~/common/util/textUtils';
import { isDeepEqual } from '~/common/util/hooks/useDeep';
import { optimaActions, optimaOpenModels } from '~/common/layout/optima/useOptima';
import { useAllLLMs } from '~/common/stores/llms/hooks/useAllLLMs';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';
import { useUIComplexityMode } from '~/common/stores/store-ui';
import { apiQuery } from '~/common/util/trpc.client';


// Map vendor ID to logo path in /public/logo/
function getVendorLogoSrc(vId: string | undefined): string | undefined {
  if (vId === 'googleai') return '/logo/google-gemini-icon.svg';
  if (vId === 'anthropic') return '/logo/claude-ai-icon.svg';
  if (vId === 'openai') return '/logo/openai-icon.svg';
  if (vId === 'xai') return '/logo/grok-icon.svg';
  return undefined;
}


// Map specific model labels to localized descriptions for a premium look
function getCustomModelDescription(label: string, fallback: string): string {
  const lcLabel = label.toLowerCase();
  if (lcLabel.includes('gemini-3.5-flash') || lcLabel.includes('gemini-3.7-flash')) return 'Google fast multimodal model, optimized for low-latency chat.';
  if (lcLabel.includes('gemini-3-flash')) return 'Google fast multimodal model, optimized for low-latency chat.';
  if (lcLabel.includes('gemini-3-pro')) return 'Google strong reasoning model, suitable for complex tasks.';
  if (lcLabel.includes('gemini-3.1-pro')) return 'Enhanced Gemini Pro with stronger reasoning and tool usage.';
  if (lcLabel.includes('claude-opus-4-8') || lcLabel.includes('claude-opus-5')) return 'Anthropic flagship model focused on deep reasoning and high-quality writing.';
  if (lcLabel.includes('claude-sonnet-5')) return 'Anthropic balanced model for fast, capable everyday assistance.';
  if (lcLabel.includes('claude-opus-4-6-thinking')) return 'Claude Opus with deeper chain-of-thought style reasoning.';
  if (lcLabel.includes('claude-opus-4-6-(adaptive)')) return 'Claude Opus adaptive variant for hard reasoning tasks.';
  if (lcLabel.includes('claude-opus-4-6')) return 'Anthropic flagship model focused on high-quality reasoning.';
  if (lcLabel.includes('gpt-5.5') || lcLabel.includes('gpt-5.6-sol')) return 'OpenAI frontier model with strong reasoning, coding, and general capabilities.';
  if (lcLabel.includes('gpt-5.6-terra')) return 'OpenAI model balancing response speed, reasoning, and coding quality.';
  if (lcLabel.includes('gpt-5.4')) return 'OpenAI flagship model with strong coding and general capabilities.';
  if (lcLabel.includes('grok-4.6')) return 'xAI frontier model with strong reasoning performance.';
  if (lcLabel.includes('grok-4')) return 'xAI frontier model with strong reasoning performance.';

  if (fallback?.startsWith('No description')) return 'Leading chat model in the current configured set.';
  return fallback || 'Configured chat model';
}


type ChatModelPricing = {
  modelId: string;
  modelName: string;
  coinCost: number;
};

type VendorGroup = 'googleai' | 'openai' | 'anthropic' | 'xai' | 'other';

function normalizeModelRef(modelRef: string): string {
  return modelRef.trim().replace(/^models\//, '').toLowerCase();
}

function stripProviderPrefix(modelRef: string): string {
  const normalized = normalizeModelRef(modelRef);
  return normalized
    .replace(/^anthropic\//, '')
    .replace(/^openai\//, '')
    .replace(/^google\//, '')
    .replace(/^googleai\//, '')
    .replace(/^xai\//, '');
}

function getLlmModelRef(llm: DLLM): string {
  const rawRef = llm.initialParameters?.llmRef;
  return typeof rawRef === 'string' ? normalizeModelRef(rawRef) : '';
}

function getConfiguredModelDescription(modelId: string, llm: DLLM): string {
  const normalizedModelId = normalizeModelRef(modelId);
  const descriptions: Record<string, string> = {
    ...CHAT_MODEL_DESCRIPTIONS,
    'gemini-3-flash-preview': 'Gemini 3 Flash：主打速度与低延迟，适合高频日常对话与轻量任务。',
    'gemini-3-pro-preview': 'Gemini 3 Pro：推理与代码能力更强，适合复杂分析与长上下文任务。',
    'claude-opus-4-6': 'Claude Opus 4.6：高端旗舰模型，擅长深度推理、长文写作与严谨表达。',
    'claude-opus-4-5': 'Claude Opus 4.5：强调高质量推理与文本理解，综合能力均衡。',
    'claude-sonnet-4-6': 'Claude Sonnet 4.6：速度与质量平衡，适合通用办公与研发协作。',
    'claude-sonnet-4-5': 'Claude Sonnet 4.5：响应速度快，适合中等复杂度问答与内容生成。',
    'gpt-5.4': 'GPT-5.4：新一代通用旗舰模型，代码、推理、写作与工具调用能力全面。',
    'gpt-5.3-codex': 'GPT-5.3 Codex：面向工程场景优化，适合代码生成、重构与调试。',
    'gpt-5.3-codex-high': 'GPT-5.3 Codex High：更偏深度推理与复杂代码任务，质量优先。',
    'gpt-5.3-codex-medium': 'GPT-5.3 Codex Medium：在速度与质量间平衡，适合多数开发任务。',
    'gpt-5.3-codex-low': 'GPT-5.3 Codex Low：响应更快、质量高，适合轻量编码需求。',
    'grok-4.1': 'Grok 4.1：通用对话与推理能力突出，适合实时问答与多领域分析。',
  };

  return descriptions[normalizedModelId] || getCustomModelDescription(llm.label, llm.description);
}

function ensureCanonicalTextCapabilities(llm: DLLM, modelId: string): DLLM {
  const normalized = stripProviderPrefix(modelId);
  if (!isFixedTextModelId(normalized) || !normalized.startsWith('gpt-') || llm.interfaces.includes(LLM_IF_OAI_Responses))
    return llm;
  return { ...llm, interfaces: [...llm.interfaces, LLM_IF_OAI_Responses] };
}

function inferVendorIdFromModelId(modelId: string): ModelVendorId | null {
  const id = stripProviderPrefix(modelId);
  if (id.startsWith('gemini-')) return 'googleai';
  if (id.startsWith('claude-')) return 'anthropic';
  if (id.startsWith('gpt-')) return 'openai';
  if (id.startsWith('grok-')) return 'xai';
  return null;
}

function toVendorGroup(modelId: string, llm?: DLLM): VendorGroup {
  const inferred = inferVendorIdFromModelId(modelId);
  if (inferred === 'googleai' || inferred === 'openai' || inferred === 'anthropic' || inferred === 'xai')
    return inferred;
  const vId = llm?.vId;
  if (vId === 'googleai' || vId === 'openai' || vId === 'anthropic' || vId === 'xai')
    return vId;
  return 'other';
}

const VENDOR_GROUP_ORDER: Record<VendorGroup, number> = {
  googleai: 1,   // Gemini
  anthropic: 2,  // Claude
  openai: 3,     // GPT
  xai: 4,        // Grok
  other: 99,
};

const VENDOR_GROUP_LABEL: Record<VendorGroup, string> = {
  googleai: 'GEMINI',
  openai: 'OPENAI',
  anthropic: 'ANTHROPIC',
  xai: 'XAI',
  other: 'OTHER',
};

function isAdaptiveThinkingVariant(llm: DLLM): boolean {
  const byLabel = /\(adaptive\)|\(thinking\)/i.test(llm.label || '');
  const byBudget = !!llm.parameterSpecs?.some((spec: any) =>
    spec?.paramId === 'llmVndAntThinkingBudget' && spec?.initialValue === -1,
  );
  return byLabel || byBudget;
}

function vendorToServiceId(vendorId: ModelVendorId): DModelsServiceId {
  // For this project, service id aligns with vendor id.
  return vendorId as DModelsServiceId;
}

function createFallbackTemplate(vendorId: ModelVendorId): DLLM {
  const now = Date.now();
  return {
    id: `cfg-template-${vendorId}`,
    label: vendorId.toUpperCase(),
    created: now,
    updated: now,
    description: 'Configured chat model',
    hidden: false,
    contextTokens: null,
    maxOutputTokens: null,
    interfaces: [LLM_IF_OAI_Chat],
    parameterSpecs: [],
    initialParameters: {},
    sId: vendorToServiceId(vendorId),
    vId: vendorId,
  };
}

function createVirtualConfiguredLLM(template: DLLM, modelId: string, modelName: string, vendorId: ModelVendorId): DLLM {
  const normalizedModelId = normalizeModelRef(modelId);
  return {
    ...template,
    id: `cfg-${template.sId}-${normalizedModelId}`,
    vId: vendorId,
    sId: vendorToServiceId(vendorId),
    label: modelName || modelLabelTitleCase(normalizedModelId),
    created: Date.now(),
    updated: Date.now(),
    hidden: false,
    initialParameters: {
      ...template.initialParameters,
      llmRef: normalizedModelId,
    },
  };
}

function LLMDropdown(props: {
  dropdownRef: React.Ref<OptimaBarControlMethods>,
  llms: ReadonlyArray<DLLM>,
  chatLlmId: undefined | DLLMId | null,
  setChatLlmId: (llmId: DLLMId | null) => void,
  keepInputOrder?: boolean,
  modelMetaByLlmId?: ReadonlyMap<string, { title: string; description?: string; coinCost?: number; vendorGroup?: VendorGroup }>,
  placeholder?: string,
}) {

  // state
  const [filterString, setfilterString] = React.useState<string | null>(null);

  // external state
  const { mode } = useColorScheme();
  const uiComplexityMode = useUIComplexityMode();
  const showSymbols = uiComplexityMode !== 'minimal';

  // derived state
  const { chatLlmId, llms, setChatLlmId } = props;

  const llmsCount = llms.filter(isLLMVisible).length;
  const showFilter = true; // Always show search as per redesign

  const handleChatLLMChange = React.useCallback((value: DLLMId | null) => {
    value && setChatLlmId(value);
  }, [setChatLlmId]);

  const handleOpenLLMOptions = React.useCallback(() => {
    return chatLlmId && optimaActions().openModelOptions(chatLlmId);
  }, [chatLlmId]);


  // dropdown items - cached
  const stabilizeLlmOptionsRaw = React.useRef<any>(undefined);
  const stabilizeLlmOptionsClean = React.useRef<OptimaDropdownItems>(undefined);

  const llmDropdownItems: OptimaDropdownItems = React.useMemo(() => {
    const llmItems: OptimaDropdownItems = {};
    let prevGroupKey: string | null = null;
    let sepCount = 0;

    const lcFilterString = filterString?.toLowerCase();
    const filteredLLMs = llms.filter(llm => {
      const configuredMeta = props.modelMetaByLlmId?.get(llm.id);
      const searchText = (configuredMeta?.title || modelLabelTitleCase(llm.label)).toLowerCase();

      if (chatLlmId && llm.id === chatLlmId)
        return true;

      // filter-out models that don't contain the search string
      if (lcFilterString && !searchText.includes(lcFilterString))
        return false;

      // filter-out hidden models from the dropdown
      return lcFilterString ? true : isLLMVisible(llm);
    });

    if (!props.keepInputOrder) {
      // Custom sort: Gemini, Claude, OpenAI, Grok
      const vendorPriority: Record<string, number> = {
        'googleai': 1,
        'anthropic': 2,
        'openai': 3,
        'xai': 4,
      };
      filteredLLMs.sort((a, b) => {
        const pA = vendorPriority[a.vId] ?? 99;
        const pB = vendorPriority[b.vId] ?? 99;
        if (pA !== pB) return pA - pB;
        return a.label.localeCompare(b.label);
      });
    }

    for (const llm of filteredLLMs) {
      const configuredMeta = props.modelMetaByLlmId?.get(llm.id);
      const modelRef = getLlmModelRef(llm) || llm.label || llm.id;
      const group = configuredMeta?.vendorGroup || toVendorGroup(modelRef, llm);
      const groupKey = `group-${group}`;
      const groupTitle = VENDOR_GROUP_LABEL[group] || 'OTHER';

      // add separators when changing services
      if (!prevGroupKey || groupKey !== prevGroupKey) {
        llmItems[`sep-${groupKey}`] = {
          type: 'separator',
          title: groupTitle,
          // NOTE: commenting because not useful, and creates a recursive issue in isDeepEqual - not needed, so kthxbye
          // icon: vendor?.Icon ? <vendor.Icon /> : undefined,
        };
        prevGroupKey = groupKey;
        sepCount++;
      }

      // add the model item
      llmItems[llm.id] = {
        title: configuredMeta?.title || modelLabelTitleCase(llm.label),
        ...(llm.userStarred ? { symbol: '*' } : {}),
        // store the logo src as a string to avoid isDeepEqual recursion on JSX
        // @ts-ignore
        vendorLogoSrc: getVendorLogoSrc(llm.vId),
        // @ts-ignore
        vendorId: llm.vId,
        description: configuredMeta?.description || getCustomModelDescription(llm.label, llm.description),
        coinCost: configuredMeta?.coinCost,
      };
    }

    // if there's a single separator (i.e. only one source), remove it
    if (sepCount === 1) {
      for (const key in llmItems) {
        if (key.startsWith('sep-')) {
          delete llmItems[key];
          break;
        }
      }
    }

    // stabilize the items: reuse the full array if nothing changed
    const prevRaw = stabilizeLlmOptionsRaw.current;
    if (prevRaw && isDeepEqual(prevRaw, llmItems))
      return stabilizeLlmOptionsClean.current!;

    // Otherwise, hydrate the icons and update the cache
    const hydratedItems: OptimaDropdownItems = { ...llmItems };
    for (const key in hydratedItems) {
      const item = hydratedItems[key];
      // @ts-ignore
      const logoSrc = item.vendorLogoSrc;
      if (logoSrc) {
        // @ts-ignore
        const vId = item.vendorId;
        const isDark = mode === 'dark';
        const invert = isDark && (vId === 'openai' || vId === 'xai');
        item.icon = (
          <Box
            component='img'
            src={logoSrc}
            alt=''
            sx={{
              width: 28,
              height: 28,
              objectFit: 'contain',
              display: 'block',
              filter: invert ? 'invert(1) brightness(1.5)' : undefined,
            }}
          />
        );
      }
    }

    stabilizeLlmOptionsRaw.current = llmItems;
    return stabilizeLlmOptionsClean.current = hydratedItems;
  }, [chatLlmId, llms, filterString, mode, props.keepInputOrder, props.modelMetaByLlmId]);


  // "Model Options" button (only on the active item)
  const llmDropdownButton = React.useMemo(() => (
    <GoodTooltip title={
      <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
        模型选项
        <KeyStroke variant='outlined' combo='Ctrl + Shift + O' sx={{ my: 0.5 }} />
      </Box>
    }>
      <IconButton
        variant='outlined' color='neutral'
        onClick={handleOpenLLMOptions}
        sx={{
          ml: 'auto',
          // mr: -0.5,
          my: '-0.25rem' /* absorb the menuItem padding */,
          backgroundColor: 'background.surface',
          boxShadow: 'xs',
        }}
      >
        <SettingsIcon sx={{ fontSize: 'xl' }} />
      </IconButton>
    </GoodTooltip>
  ), [handleOpenLLMOptions]);


  // "Models Filter" box
  const llmDropdownPrependOptions = React.useMemo(() =>
    !showFilter ? undefined : (
      <DebouncedInputMemo
        aggressiveRefocus
        debounceTimeout={300}
        onDebounce={setfilterString}
        placeholder={`搜索 ${llmsCount} 个模型...`}
        sx={{
          '--Input-radius': '0.75rem',
          backgroundColor: 'neutral.softBg',
          border: 'none',
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: 'neutral.softHoverBg',
          }
        }}
      />
    ), [showFilter, llmsCount]);

  // [effect] clear filter when the active model changes
  // Note: this doesn't work because the debounced component holds the filter string
  // React.useEffect(() => {
  //   if (chatLlmId) {
  //     setsearchQuery(null);
  //     console.log('cleared');
  //   }
  // }, [chatLlmId]);


  // Zero State - no models available
  const hasDropdownOptions = Object.keys(llmDropdownItems || {}).length > 0;

  // "Models Setup" button
  const llmDropdownAppendOptions = React.useMemo(() => <>

    {/*{chatLlmId && (*/}
    {/*  <ListItemButton key='menu-opt' onClick={handleOpenLLMOptions}>*/}
    {/*    <ListItemDecorator><SettingsIcon color='success' /></ListItemDecorator>*/}
    {/*    <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>*/}
    {/*      Options*/}
    {/*      <KeyStroke combo='Ctrl + Shift + O' />*/}
    {/*    </Box>*/}
    {/*  </ListItemButton>*/}
    {/*)}*/}

    <ListItemButton key='menu-llms' onClick={optimaOpenModels} sx={{ backgroundColor: 'background.surface', py: 'calc(2 * var(--ListDivider-gap))' }}>
      <ListItemDecorator>{!hasDropdownOptions ? '+' : <BuildCircleIcon color='success' />}</ListItemDecorator>
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
        {!hasDropdownOptions ? '添加模型' : '模型设置'}
        {/*<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>*/}
        {/*  <KeyStroke variant='outlined' size='sm' combo='Ctrl + Shift + M' sx={{ ml: 2, bgcolor: 'background.popup' }} />*/}
        <ArrowForwardRoundedIcon sx={{ ml: 'auto', fontSize: 'xl' }} />
        {/*</Box>*/}
      </Box>
    </ListItemButton>

  </>, [hasDropdownOptions]);


  return (
    <OptimaBarDropdownMemo
      ref={props.dropdownRef}
      items={llmDropdownItems}
      value={chatLlmId}
      onChange={handleChatLLMChange}
      placeholder={props.placeholder || '选择模型'}
      prependOption={llmDropdownPrependOptions}
      appendOption={llmDropdownAppendOptions}
      activeEndDecorator={llmDropdownButton}
      showSymbols={showSymbols ? 'compact' : false}
    />
  );
}


export function useChatLLMDropdown(dropdownRef: React.Ref<OptimaBarControlMethods>) {

  // external state
  const llms = useAllLLMs();
  const { domainModelId: chatLLMId, assignDomainModelId: setChatLLMId } = useModelDomain('primaryChat');
  const { data: chatModelPricing } = (apiQuery.coin.getChatModels as any).useQuery(undefined, {
    staleTime: 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const orderedConfiguredModels = React.useMemo(() => {
    if (!Array.isArray(chatModelPricing) || !chatModelPricing.length)
      return null;

    const modelRefToLlms = new Map<string, DLLM[]>();
    const templateByVendor = new Map<ModelVendorId, DLLM>();

    for (const llm of llms) {
      const modelRef = getLlmModelRef(llm);
      if (!modelRef)
        continue;

      const list = modelRefToLlms.get(modelRef) || [];
      list.push(llm);
      modelRefToLlms.set(modelRef, list);

      if (!templateByVendor.has(llm.vId))
        templateByVendor.set(llm.vId, llm);
    }

      const configured: Array<{ llm: DLLM; pricing: ChatModelPricing; vendorGroup: VendorGroup }> = [];
      const seenLlmIds = new Set<string>();

    for (const item of chatModelPricing as ChatModelPricing[]) {
      const modelRef = stripProviderPrefix(item.modelId);
      const candidates = modelRefToLlms.get(modelRef) || [];
      const preferredVendorId = inferVendorIdFromModelId(modelRef);
      const vendorMatched = preferredVendorId
        ? candidates.filter((llm) => llm.vId === preferredVendorId)
        : [];
      const pool = vendorMatched.length ? vendorMatched : candidates;
      const wantsAdaptive = /\b(adaptive|thinking)\b/i.test(`${item.modelId} ${item.modelName || ''}`);
      const rankedPool = [...pool].sort((a, b) => {
        const aScore = (a.isUserClone ? 10 : 0) + ((!wantsAdaptive && isAdaptiveThinkingVariant(a)) ? 1 : 0);
        const bScore = (b.isUserClone ? 10 : 0) + ((!wantsAdaptive && isAdaptiveThinkingVariant(b)) ? 1 : 0);
        return aScore - bScore;
      });
      const matchedLlm = rankedPool[0];

      const llm = matchedLlm ? ensureCanonicalTextCapabilities(matchedLlm, modelRef)
        : (() => {
        const vendorId = inferVendorIdFromModelId(modelRef);
        if (!vendorId)
          return null;
        const vendorTemplate = templateByVendor.get(vendorId) || llms[0] || createFallbackTemplate(vendorId);
        if (!vendorTemplate)
          return null;
        return ensureCanonicalTextCapabilities(createVirtualConfiguredLLM(vendorTemplate, item.modelId, item.modelName || item.modelId, vendorId), modelRef);
      })();

      if (!llm || seenLlmIds.has(llm.id))
        continue;

      const vendorGroup = toVendorGroup(modelRef, llm);
      seenLlmIds.add(llm.id);
      configured.push({ llm, pricing: item, vendorGroup });
    }

    configured.sort((a, b) => {
      const ga = VENDOR_GROUP_ORDER[a.vendorGroup] ?? 99;
      const gb = VENDOR_GROUP_ORDER[b.vendorGroup] ?? 99;
      if (ga !== gb) return ga - gb;
      return a.pricing.modelId.localeCompare(b.pricing.modelId);
    });

    return configured;
  }, [chatModelPricing, llms]);

  const dropdownLlms = React.useMemo(
    () => orderedConfiguredModels?.map((item) => item.llm) || [],
    [orderedConfiguredModels],
  );

  React.useEffect(() => {
    if (!orderedConfiguredModels?.length)
      return;

    const store = useModelsStore.getState();
    const existingLlms = store.llms;
    const byService = new Map<DModelsServiceId, DLLM[]>();
    const ensuredServices = new Set<DModelsServiceId>();

    for (const { llm } of orderedConfiguredModels) {
      const list = byService.get(llm.sId) || [];
      list.push(llm);
      byService.set(llm.sId, list);
    }

    byService.forEach((virtualModels, serviceId) => {
      if (!ensuredServices.has(serviceId)) {
        const existingService = findModelsServiceOrNull(serviceId);
        if (!existingService) {
          const vendor = findModelVendor(virtualModels[0]?.vId);
          if (vendor) {
            llmsStoreActions().createModelsService(vendor);
          }
        }
        ensuredServices.add(serviceId);
      }
      const existing = existingLlms.filter((llm) => llm.sId === serviceId);
      const existingIds = new Set(existing.map((llm) => llm.id));
      const missing = virtualModels.filter((llm) => !existingIds.has(llm.id));
      if (!missing.length)
        return;
      const merged = [...existing, ...missing];
      store.setServiceLLMs(serviceId, merged, true, false);
    });
  }, [orderedConfiguredModels]);

  const modelMetaByLlmId = React.useMemo(() => {
    if (!orderedConfiguredModels?.length)
      return undefined;
    const modelMeta = new Map<string, { title: string; description?: string; coinCost?: number; vendorGroup?: VendorGroup }>();
    for (const { llm, pricing, vendorGroup } of orderedConfiguredModels) {
      modelMeta.set(llm.id, {
        title: pricing.modelName || pricing.modelId,
        description: getConfiguredModelDescription(pricing.modelId, llm),
        coinCost: pricing.coinCost,
        vendorGroup,
      });
    }
    return modelMeta;
  }, [orderedConfiguredModels]);

  React.useEffect(() => {
    if (!orderedConfiguredModels?.length)
      return;
    if (chatLLMId && orderedConfiguredModels.some((item) => item.llm.id === chatLLMId))
      return;
    setChatLLMId(orderedConfiguredModels[0].llm.id);
  }, [chatLLMId, orderedConfiguredModels, setChatLLMId]);

  const chatLLMDropdown = React.useMemo(() => {
    return (
      <LLMDropdown
        dropdownRef={dropdownRef}
        llms={dropdownLlms}
        chatLlmId={chatLLMId}
        setChatLlmId={setChatLLMId}
        keepInputOrder={!!orderedConfiguredModels?.length}
        modelMetaByLlmId={modelMetaByLlmId}
      />
    );
  }, [chatLLMId, dropdownRef, dropdownLlms, setChatLLMId, orderedConfiguredModels, modelMetaByLlmId]);

  return { chatLLMId, chatLLMDropdown };
}

/*export function useTempLLMDropdown(props: { initialLlmId: DLLMId | null }) {
  // local state
  const [llmId, setLlmId] = React.useState<DLLMId | null>(props.initialLlmId);

  // external state
  const llms = useModelsStore(state => state.llms);

  const chatLLMDropdown = React.useMemo(
    () => <LLMDropdown llms={llms} llmId={llmId} setLlmId={setLlmId} />,
    [llms, llmId, setLlmId],
  );

  return { llmId, chatLLMDropdown };
}*/
