import * as React from 'react';

import { Alert, Box, FormControl, Typography } from '@mui/joy';

import { useChatAutoAI } from '../../../../apps/chat/store-app-chat';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidAnthropicApiKey, ModelVendorAnthropic } from './anthropic.vendor';


export function AnthropicServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorAnthropic);

  const { autoVndAntBreakpoints, setAutoVndAntBreakpoints } = useChatAutoAI();

  // derived state
  const { anthropicKey, anthropicHost, anthropicInferenceGeo, clientSideFetch, heliconeKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch;

  const keyValid = isValidAnthropicApiKey(anthropicKey);
  const keyError = (/*needsUserKey ||*/ !!anthropicKey) && !keyValid;
  const shallFetchSucceed = anthropicKey ? keyValid : (!needsUserKey || !!anthropicHost);

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  // [Custom] Auto-set host
  React.useEffect(() => {
    if (anthropicKey && !anthropicHost)
      updateSettings({ anthropicHost: 'https://api.aittco.com' });
  }, [anthropicKey, anthropicHost, updateSettings]);

  return <>

    <ApproximateCosts serviceId={service?.id}>
      {/* <Box sx={{ level: 'body-sm' }}> */}
      {/*   Supports <b>Sonnet</b>, <b>Opus</b> and <b>Haiku</b>. Experiencing Issues? Check <Link href='https://status.anthropic.com/' level='body-sm' target='_blank'>Anthropic status</Link>. */}
      {/* </Box> */}
    </ApproximateCosts>

    <FormInputKey
      autoCompleteId='anthropic-key' label={!!anthropicHost ? 'API 密钥' : 'Anthropic API 密钥'}
      rightLabel={<>{needsUserKey
        ? !anthropicKey && <Link level='body-sm' href='https://www.anthropic.com/earlyaccess' target='_blank'>获取密钥</Link>
        : <AlreadySet />
      }
      </>}
      value={anthropicKey} onChange={value => updateSettings({ anthropicKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-...'
    />

    {showAdvanced && <FormSwitchControl
      title='自动缓存 (Pre-fill)' on='开启' off='关闭'
      tooltip='自动断点：会在 System 指令以及最近 2 条 User 消息上始终设置断点。用户还可以手动设置 1 个断点。（最多 4 个）'
      description={autoVndAntBreakpoints ? <>最近 2 条用户消息</> : '已禁用'}
      checked={autoVndAntBreakpoints}
      onChange={setAutoVndAntBreakpoints}
    />}


    {showAdvanced && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart
        title='缓存开关'
        description='按消息切换'
        tooltip='您可以为每条消息开启/关闭缓存。开启缓存会使新输入稍微贵一些，但复用缓存后的输入会便宜得多。详情请参阅 Anthropic 文档。'
      />
      <Typography level='title-sm'>
        {autoVndAntBreakpoints ? '用户 & 自动' : '用户手动'}
      </Typography>
    </FormControl>}

    {/* API Host field removed per user request */}

    {/* Helicone Key field removed per user request */}
    {/*
    {showAdvanced && <FormTextField
      autoCompleteId='anthropic-helicone-key'
      title='Helicone 密钥' disabled={!!anthropicHost}
      description={<>在此 <Link level='body-sm' href='https://www.helicone.ai/keys' target='_blank'>生成</Link></>}
      placeholder='sk-...'
      value={heliconeKey || ''}
      onChange={text => updateSettings({ heliconeKey: text })}
    />}
    */}

    {(showAdvanced || !!anthropicInferenceGeo) && <FormSwitchControl
      title='仅限美国节点 (US-only Inference)' on='美国 (US)' off='全球 (Global)'
      tooltip='将模型推理限制在美国数据中心（价格为 1.1倍）。仅支持 Claude Opus 4.6 及更新模型——旧模型会报错。'
      description={anthropicInferenceGeo ? '美国区域 (1.1x)' : '默认路由'}
      checked={!!anthropicInferenceGeo}
      onChange={on => updateSettings({ inferenceGeoUS: on })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!anthropicKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText="使用浏览器而不是服务器直接获取模型并向 Anthropic API 发起请求。有助于绕过服务器限制或确保请求直接使用您的 API 密钥。"
    />}

    {/*
    {!!heliconeKey && <Alert variant='soft' color='success'>
      高级选项：您设置了 Helicone 密钥，Anthropic 的文本请求将通过 Helicone 路由。
    </Alert>}
    */}

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}