import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, ButtonGroup, Checkbox, Divider, Dropdown, FormControl, Grid, IconButton, Input, Link, ListDivider, ListItemDecorator, Menu, MenuButton, MenuItem, Switch, Tooltip, Typography } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RestoreIcon from '@mui/icons-material/Restore';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { DPricingChatGenerate } from '~/common/stores/llms/llms.pricing';
import type { ModelOptionsContext } from '~/common/layout/optima/store-layout-optima';
import { DLLMId, DModelInterfaceV1, getLLMContextTokens, getLLMMaxOutputTokens, getLLMPricing, isLLMVisible, LLM_IF_HOTFIX_NoStream, LLM_IF_HOTFIX_NoTemperature, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';
import { FALLBACK_LLM_PARAM_TEMPERATURE } from '~/common/stores/llms/llms.parameters';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { ModelDomainsList, ModelDomainsRegistry } from '~/common/stores/llms/model.domains.registry';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { optimaActions, optimaOpenModels } from '~/common/layout/optima/useOptima';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useModelDomains } from '~/common/stores/llms/hooks/useModelDomains';
import { useLLM, useModelsServices } from '~/common/stores/llms/llms.hooks';

import { LLMOptionsClone } from './LLMOptionsClone';
import { LLMOptionsGlobal } from './LLMOptionsGlobal';
import { LLMVendorIconSprite } from '../components/LLMVendorIconSprite';


// configuration
export const ENABLE_STARRING_ICON = true;
const ENABLE_PURPOSEFUL_VISIBILITY = false;
const ENABLE_HIDING_ICON = false;


const _styles = {
  fullContainer: {
    mx: 'calc(-1 * var(--Card-padding, 1rem))', padding: 'var(--Card-padding, 1rem)', // fill card

    borderTop: '1px solid',
    borderBottom: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'background.level1',

    // repeat layout
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--Card-padding)',
  },
  multiSelectButton: {
    backgroundColor: 'background.surface',
  },
} as const;


function prettyPricingComponent(pricingChatGenerate: DPricingChatGenerate): React.ReactNode {
  if (!pricingChatGenerate) return '价格不可用';

  const formatPrice = (price: DPricingChatGenerate['input']): string => {
    if (!price) return 'N/A';
    if (price === 'free') return '免费';
    if (typeof price === 'number') return `$${price.toFixed(2)}`;
    if (Array.isArray(price))
      return price.map(bp => `${bp.upTo === null ? '>' : '<='} ${bp.upTo || ''} tokens: ${formatPrice(bp.price)}`).join(', ');
    return '未知';
  };

  const inputPrice = formatPrice(pricingChatGenerate.input);
  const outputPrice = formatPrice(pricingChatGenerate.output);

  let cacheInfo = '';
  if (pricingChatGenerate.cache) {
    switch (pricingChatGenerate.cache.cType) {
      case 'ant-bp': {
        const { read, write, duration } = pricingChatGenerate.cache;
        cacheInfo = `缓存: 读取 ${formatPrice(read)}, 写入 ${formatPrice(write)}, 时长: ${duration}s`;
        break;
      }
      case 'oai-ac': {
        const { read } = pricingChatGenerate.cache;
        cacheInfo = `缓存: 读取 ${formatPrice(read)}`;
        break;
      }
      default:
        throw new Error('LLMOptionsModal: Unknown cache type');
    }
  }

  return (
    <div>
      <span>价格 ($/M tokens):</span><br />
      &nbsp;- 输入: {inputPrice}<br />
      &nbsp;- 输出: {outputPrice}<br />
      {cacheInfo && <>&nbsp;- {cacheInfo}<br /></>}
    </div>
  );
}


export function LLMOptionsModal(props: { id: DLLMId, context?: ModelOptionsContext, onClose: () => void }) {

  // external state
  const isMobile = useIsMobile();
  const llm = useLLM(props.id);
  const cloneSourceLlm = useLLM(llm?.cloneSourceId ?? null);

  const { modelsServices, setConfServiceId } = useModelsServices();
  const modelService = llm ? modelsServices.find(s => s.id === llm.sId) : null;

  // state - auto-open overrides if user has customized pricing or token limits
  const [showDetails, setShowDetails] = React.useState(false);
  const [showOverrides, setshowOverrides] = React.useState(!!llm?.userPricing || llm?.userContextTokens !== undefined || llm?.userMaxOutputTokens !== undefined);
  const [cloneDialogOpen, setCloneDialogOpen] = React.useState(false);
  const domainAssignments = useModelDomains();
  const { removeLLM, updateLLM, assignDomainModelId, resetLLMUserParameters } = llmsStoreActions();

  const handleResetParameters = React.useCallback(() => {
    llm?.id && resetLLMUserParameters(llm?.id);
  }, [llm?.id, resetLLMUserParameters]);

  const handleInterfaceToggle = React.useCallback((iface: DModelInterfaceV1, enable: boolean) => {
    if (!llm?.isUserClone) return; // safety: only clones can modify interfaces

    const hasInterface = llm.interfaces.includes(iface);
    if (enable === hasInterface) return; // no change needed

    const newInterfaces = enable ? [...llm.interfaces, iface]
      : llm.interfaces.filter(i => i !== iface);

    const updates: Partial<typeof llm> = { interfaces: newInterfaces };
    switch (iface) {
      case LLM_IF_HOTFIX_NoTemperature:
        updates.initialParameters = { ...llm.initialParameters, llmTemperature: enable ? null : FALLBACK_LLM_PARAM_TEMPERATURE };
        const { llmTemperature: _, ...otherUserParameters } = { ...llm.userParameters };
        updates.userParameters = otherUserParameters;
        break;
    }

    updateLLM(llm.id, updates);
  }, [llm, updateLLM]);


  if (!llm)
    return <>选项问题：未找到 ID 为 {props.id} 的模型</>;

  const handleLlmLabelSet = (event: React.ChangeEvent<HTMLInputElement>) => updateLLM(llm.id, { label: event.target.value || '' });

  const handleLlmVisibilityToggle = () => updateLLM(llm.id, { userHidden: isLLMVisible(llm) });

  const handleLlmStarredToggle = () => updateLLM(llm.id, { userStarred: !llm.userStarred });


  // Overrides > user Context/MaxOutput

  const handleContextTokensChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateLLM(llm.id, { userContextTokens: value ? parseInt(value, 10) : undefined });
  };

  const handleContextTokensReset = () => updateLLM(llm.id, { userContextTokens: undefined });

  const handleMaxOutputTokensChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateLLM(llm.id, { userMaxOutputTokens: value ? parseInt(value, 10) : undefined });
  };

  const handleMaxOutputTokensReset = () => updateLLM(llm.id, { userMaxOutputTokens: undefined });


  // Overrides > user Pricing

  const handleInputPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numValue = value ? parseFloat(value) : undefined;
    updateLLM(llm.id, {
      userPricing: {
        chat: {
          ...llm.userPricing?.chat,
          input: numValue,
          // output: llm.userPricing?.chat?.output,
        },
      },
    });
  };

  const handleInputPriceReset = () => {
    const newPricing = { ...llm.userPricing };
    if (newPricing.chat) {
      delete newPricing.chat.input;
      // If no other pricing fields are set, clear userPricing entirely
      if (!newPricing.chat.output && !newPricing.chat.cache) {
        updateLLM(llm.id, { userPricing: undefined });
      } else {
        updateLLM(llm.id, { userPricing: newPricing });
      }
    }
  };

  const handleOutputPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numValue = value ? parseFloat(value) : undefined;
    updateLLM(llm.id, {
      userPricing: {
        chat: {
          ...llm.userPricing?.chat,
          // input: llm.userPricing?.chat?.input,
          output: numValue,
        },
      },
    });
  };

  const handleOutputPriceReset = () => {
    const newPricing = { ...llm.userPricing };
    if (newPricing.chat) {
      delete newPricing.chat.output;
      // If no other pricing fields are set, clear userPricing entirely
      if (!newPricing.chat.input && !newPricing.chat.cache) {
        updateLLM(llm.id, { userPricing: undefined });
      } else {
        updateLLM(llm.id, { userPricing: newPricing });
      }
    }
  };


  const handleGoToService = () => {
    if (!modelService?.id) return;
    props.onClose();
    setConfServiceId(modelService.id);
    optimaOpenModels();
  };

  const handleLlmDelete = () => {
    removeLLM(llm.id);
    props.onClose();
  };

  const handleLlmCloned = (cloneId: DLLMId) => {
    // switch to the newly created clone
    optimaActions().openModelOptions(cloneId, props.context);
  };

  const handleGoToCloneSource = () => {
    if (llm.cloneSourceId)
      optimaActions().openModelOptions(llm.cloneSourceId, props.context);
  };

  const visible = isLLMVisible(llm);

  const hasUserParameters = llm.userParameters && Object.keys(llm.userParameters).length > 0;
  const resetButton = !hasUserParameters ? null : (
    <Link
      component='button'
      color='neutral'
      level='body-sm'
      onClick={handleResetParameters}
      // sx={{ mt: 0.125 }}
    >
      重置为默认值 ...
    </Link>
  );


  // if 'full' or missing, show all options
  const showFull = !ENABLE_PURPOSEFUL_VISIBILITY || props.context !== 'parameters';


  return (

    <GoodModal
      autoOverflow
      // strongerTitle
      title={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1, md: 3 } }}>

            {/* Star + Model Name */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, md: 1 } }} onClick={event => event.shiftKey && console.log({ llm })}>
            {ENABLE_STARRING_ICON && <TooltipOutlined title={llm.userStarred ? '取消收藏' : '收藏此模型'}>
              <IconButton size='sm' onClick={handleLlmStarredToggle} sx={{ ml: -0.5 }}>
                {llm.userStarred ? <StarIcon sx={{ color: '#fad857', fontSize: 'xl2' }} /> : <StarBorderIcon />}
              </IconButton>
            </TooltipOutlined>}
            {ENABLE_HIDING_ICON && <TooltipOutlined title={visible ? '在应用中显示此模型' : '从应用中隐藏此模型'}>
              <IconButton size='sm' onClick={handleLlmVisibilityToggle} sx={{ ml: -0.5 }}>
                {visible ? <VisibilityIcon sx={{ fontSize: 'xl' }} /> : <VisibilityOffIcon />}
              </IconButton>
            </TooltipOutlined>}
            <div>{llm.label} <span style={{ opacity: 0.5 }}>选项</span></div>
          </Box>

          {/* [Desktop] Reset to default - show only when user has customized parameters */}
          {!isMobile && resetButton}
        </Box>
      }
      open={!!props.id} onClose={props.onClose}
      startButton={
        <Dropdown>
          <TooltipOutlined title='更多...' placement='top-start'>
            <MenuButton slots={{ root: IconButton }} slotProps={{ root: { variant: 'soft' } }}>
              <MoreVertIcon sx={{ fontSize: 'xl' }} />
            </MenuButton>
          </TooltipOutlined>
          <Menu placement='bottom-start' disablePortal sx={{ minWidth: 220 }}>

            {/* -> Models Service */}
            {modelService && <>
              <MenuItem onClick={handleGoToService}>
                <ListItemDecorator><LLMVendorIconSprite vendorId={llm.vId} /></ListItemDecorator>
                {modelService.label}
                <ArrowForwardRoundedIcon sx={{ ml: 'auto' }} />
              </MenuItem>
              <ListDivider />
            </>}

            {/* Reset to Defaults */}
            <MenuItem disabled={!hasUserParameters} onClick={handleResetParameters}>
              <ListItemDecorator><RestoreIcon /></ListItemDecorator>
              重置参数
            </MenuItem>

            <ListDivider />

            {/* Duplicate Model */}
            <MenuItem onClick={() => setCloneDialogOpen(true)}>
              <ListItemDecorator><AddRoundedIcon /></ListItemDecorator>
              复制模型 ...
            </MenuItem>

            <ListDivider />

            {/*View toggles */}
            <MenuItem onClick={() => setShowDetails(!showDetails)}>
              <ListItemDecorator><Checkbox color='neutral' checked={showDetails} /></ListItemDecorator>
              显示详情
            </MenuItem>
            <MenuItem onClick={() => setshowOverrides(!showOverrides)}>
              <ListItemDecorator><Checkbox color='neutral' checked={showOverrides} /></ListItemDecorator>
              显示覆盖配置
            </MenuItem>

            <ListDivider />

            {/*  Delete */}
            <MenuItem color='danger' onClick={handleLlmDelete}>
              <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
              删除
            </MenuItem>
          </Menu>
        </Dropdown>
      }
      // darkBottomClose
    >

      <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
        <LLMOptionsGlobal llm={llm} />
        {/* On Mobile, display the button below the settings */}
        {isMobile && resetButton}
      </Box>

      {/* Clone Source Info */}
      {llm.isUserClone && (
        <Typography level='body-sm' sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          ➕ 克隆自：{' '}
          {cloneSourceLlm
            ? <Link component='button' onClick={handleGoToCloneSource}>{cloneSourceLlm.label}</Link>
            : <Typography component='span' sx={{ color: 'text.tertiary' }}>{llm.cloneSourceId} (未找到)</Typography>
          }
        </Typography>
      )}


      {/* General Settings */}

      {/*{showFull && <Divider />} replaced by the border of the following */}

      {showFull && <Box sx={_styles.fullContainer}>

        <Grid container spacing={2} alignItems='center'>

          <Grid xs={12} md={8}>
            <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <FormLabelStart title='名称' sx={{ minWidth: 80 }} />
              <Input variant='outlined' value={llm.label} onChange={handleLlmLabelSet} />
            </FormControl>
          </Grid>

          <Grid xs={12} md={4}>
            {!ENABLE_HIDING_ICON && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <FormLabelStart title='显示' sx={{ minWidth: 80 }} />
              <Tooltip title={visible ? '在聊天模型列表中显示此模型' : '从聊天模型列表中隐藏此模型'}>
                <Switch checked={visible} onChange={handleLlmVisibilityToggle}
                        endDecorator={visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                        slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
              </Tooltip>
            </FormControl>}
          </Grid>

        </Grid>

        <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <FormLabelStart title='默认' description='模型用途' sx={{ minWidth: 80 }} />
          <ButtonGroup orientation='horizontal' size='sm' variant='outlined'>
            {ModelDomainsList.filter(dId => !['imageCaption'].includes(dId)).map(domainId => {
              const domainSpec = ModelDomainsRegistry[domainId];
              const domainModelId = domainAssignments[domainId]?.modelId;
              const isActive = domainModelId === llm.id;
              return (
                // Note: use Tooltip instead of GoodTooltip here, because GoodTooltip is not working well with ButtonGroup
                <Tooltip arrow placement='top' key={domainId} title={domainSpec.confTooltip}>
                  <Button
                    variant={isActive ? 'solid' : undefined}
                    onClick={() => assignDomainModelId(domainId, isActive ? null : llm.id)}
                    sx={isActive ? undefined : _styles.multiSelectButton}
                  >
                    {domainSpec.confLabel}
                  </Button>
                </Tooltip>
              );
            })}
          </ButtonGroup>
        </FormControl>

        {!ENABLE_STARRING_ICON && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <FormLabelStart title='收藏' sx={{ minWidth: 80 }} />
          <Tooltip title={llm.userStarred ? '取消收藏' : '收藏此模型'}>
            <Switch checked={!!llm.userStarred} onChange={handleLlmStarredToggle}
                    endDecorator={llm.userStarred ? <StarIcon sx={{ color: '#fad857' }} /> : <StarBorderIcon />}
                    slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
            />
          </Tooltip>
        </FormControl>}

        {/* Clone Interface Toggles (only for clones) */}
        {!!llm.isUserClone && <Box sx={{ display: 'flex' }}>
          <FormLabelStart title='特殊' description='高级' tooltip='更改特殊技术参数，仅适用于克隆模型。' sx={{ minWidth: 96 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Switch
              size='sm'
              checked={!llm.interfaces.includes(LLM_IF_HOTFIX_NoTemperature)}
              onChange={(e) => handleInterfaceToggle(LLM_IF_HOTFIX_NoTemperature, !e.target.checked)}
              endDecorator={<Typography level='body-sm'>🌡️ 温度</Typography>}
            />
            <Switch
              size='sm'
              checked={!llm.interfaces.includes(LLM_IF_HOTFIX_NoStream)}
              onChange={(e) => handleInterfaceToggle(LLM_IF_HOTFIX_NoStream, !e.target.checked)}
              endDecorator={<Typography level='body-sm'>流式传输</Typography>}
            />
            <Switch
              size='sm'
              checked={llm.interfaces.includes(LLM_IF_OAI_Reasoning)}
              onChange={(e) => handleInterfaceToggle(LLM_IF_OAI_Reasoning, e.target.checked)}
              endDecorator={<Typography level='body-sm'>图标: 🧠</Typography>}
            />
          </Box>
        </Box>}

      </Box>}


      {/* Details Text */}

      {showDetails && <FormControl orientation='horizontal' sx={{ flexWrap: 'nowrap', gap: 1 }}>

        <Link
          component='button'
          color='neutral'
          level='title-sm'
          onClick={() => setShowDetails(!showDetails)}
          sx={{ color: 'text.primary', whiteSpace: 'nowrap', mb: 'auto', textDecoration: 'underline' }}
        >
          {showDetails ? '详情：' : '详情...'}
        </Link>
        
        {showDetails && <Box sx={{ display: 'flex', flexDirection: 'column', wordBreak: 'break-word', gap: 1 }}>
          {!!llm.description && <Typography level='title-sm'>
            {llm.description}
          </Typography>}

          {!!getLLMPricing(llm)?.chat?._isFree && <Typography level='body-xs'>
            🎁 免费模型 - 注意：刷新模型以检查价格更新
          </Typography>}

          <Typography level='body-xs'>
            ID: {llm.id}<br />
            上下文: <b>{getLLMContextTokens(llm)?.toLocaleString() ?? '未提供'}</b> Token{` · `}
            最大输出: <b>{getLLMMaxOutputTokens(llm)?.toLocaleString() ?? '未提供'}</b><br />
            {!!llm.created && <>创建时间: <TimeAgo date={new Date(llm.created * 1000)} /><br /></>}
            {/*· tags: {llm.tags.join(', ')}*/}
            {!!getLLMPricing(llm)?.chat && prettyPricingComponent(getLLMPricing(llm)!.chat!)}
            {/*{!!llm.benchmark && <>benchmark: <b>{llm.benchmark.cbaElo?.toLocaleString() || '(unk) '}</b> CBA Elo<br /></>}*/}
            {!!llm.interfaces?.length && <>接口: {llm.interfaces.join(', ')}<br /></>}
            {llm.parameterSpecs?.length > 0 && <>选项: {llm.parameterSpecs.map(ps => ps.paramId).join(', ')}<br /></>}
            {Object.keys(llm.initialParameters || {}).length > 0 && <>初始参数: {JSON.stringify(llm.initialParameters, null, 2)}<br /></>}
            {Object.keys(llm.userParameters || {}).length > 0 && <>用户参数: {JSON.stringify(llm.userParameters, null, 2)}<br /></>}
          </Typography>

        </Box>}

      </FormControl>}


      {/* Overrides */}

      {showOverrides ? <Divider>专家：覆盖配置 <WarningRoundedIcon sx={{ color: 'text.tertiary', ml: 1 }} /></Divider> : null}

      {/* Overrides: Token & Pricing Overrides */}
      {showOverrides && <Grid container spacing={2} alignItems='center'>
        <Grid xs={12} md={6}>
          <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <FormLabelStart title='上下文窗口' description='Token 覆盖' sx={{ minWidth: 120 }} />
            <Input
              type='number'
              variant='outlined'
              placeholder={
                // NOTE: direct access to the underlying, instead of via getLLMContextTokens
                llm.contextTokens?.toLocaleString() ?? '默认'
              }
              value={llm.userContextTokens ?? ''}
              onChange={handleContextTokensChange}
              endDecorator={llm.userContextTokens !== undefined && (
                <Button size='sm' variant='plain' onClick={handleContextTokensReset}>重置</Button>
              )}
              slotProps={{ input: { min: 1 } }}
              sx={{ flex: 1 }}
            />
          </FormControl>
        </Grid>

        <Grid xs={12} md={6}>
          <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <FormLabelStart title='最大输出' description='Token 覆盖' sx={{ minWidth: 120 }} />
            <Input
              type='number'
              variant='outlined'
              placeholder={
                // NOTE: direct access to the underlying, instead of via getLLMMaxOutputTokens
                llm.maxOutputTokens?.toLocaleString() ?? '默认'
              }
              value={llm.userMaxOutputTokens ?? ''}
              onChange={handleMaxOutputTokensChange}
              slotProps={{ input: { min: 1 } }}
              endDecorator={llm.userMaxOutputTokens !== undefined && (
                <Button size='sm' variant='plain' onClick={handleMaxOutputTokensReset}>重置</Button>
              )}
              sx={{ flex: 1 }}
            />
          </FormControl>
        </Grid>

        {/*<Grid xs={12}>*/}
        {/*  <Typography level='title-sm'>*/}
        {/*    Pricing Override (for hypothetical cost tracking)*/}
        {/*  </Typography>*/}
        {/*</Grid>*/}

        <Grid xs={12} md={6}>
          <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <FormLabelStart title='输入价格' description='$/M 覆盖' sx={{ minWidth: 120 }} />
            <Input
              type='number'
              variant='outlined'
              placeholder={
                // NOTE: direct access to the underlying, instead of via getLLMPricing
                typeof llm.pricing?.chat?.input === 'number' ? llm.pricing.chat.input.toString() : '未设置'
              }
              value={
                typeof llm.userPricing?.chat?.input === 'number' ? llm.userPricing.chat.input ?? '' : ''
              }
              onChange={handleInputPriceChange}
              endDecorator={llm.userPricing?.chat?.input !== undefined && (
                <Button size='sm' variant='plain' onClick={handleInputPriceReset}>重置</Button>
              )}
              slotProps={{ input: { min: 0, step: 0.01 } }}
              sx={{ flex: 1 }}
            />
          </FormControl>
        </Grid>

        <Grid xs={12} md={6}>
          <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <FormLabelStart title='输出价格' description='$/M 覆盖' sx={{ minWidth: 120 }} />
            <Input
              type='number'
              variant='outlined'
              placeholder={
                // NOTE: direct access to the underlying, instead of via getLLMPricing
                typeof llm.pricing?.chat?.output === 'number' ? llm.pricing.chat.output.toString() : '未设置'
              }
              value={
                typeof llm.userPricing?.chat?.output === 'number' ? llm.userPricing.chat.output ?? '' : ''
              }
              onChange={handleOutputPriceChange}
              slotProps={{ input: { min: 0, step: 0.01 } }}
              endDecorator={llm.userPricing?.chat?.output !== undefined && (
                <Button size='sm' variant='plain' onClick={handleOutputPriceReset}>重置</Button>
              )}
              sx={{ flex: 1 }}
            />
          </FormControl>
        </Grid>
      </Grid>}

      {/* Clone Model Dialog */}
      {cloneDialogOpen && (
        <LLMOptionsClone
          llmId={llm.id}
          onClose={() => setCloneDialogOpen(false)}
          onCloned={handleLlmCloned}
        />
      )}

    </GoodModal>

  );
}