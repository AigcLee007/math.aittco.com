import * as React from 'react';

import { Alert, Divider, IconButton } from '@mui/joy';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { BaseProduct } from '~/common/app.release';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorOpenAI } from './openai.vendor';
import { OpenAIHostAutocomplete } from './OpenAIHostAutocomplete';


// avoid repeating it all over
const HELICONE_OPENAI_HOST = 'https://oai.hconeai.com';


export function OpenAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs, updateSettings, updateLabel } =
    useServiceSetup(props.serviceId, ModelVendorOpenAI);

  // derived state
  const { clientSideFetch, oaiKey, oaiOrg, oaiHost, heliKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // state
  // const advanced = useToggleableBoolean(initialShowOAIAdvanced);
  // const showAdvanced = advanced.on;

  const keyValid = true; //isValidOpenAIApiKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  // [Custom] Auto-set host
  React.useEffect(() => {
    if (oaiKey && !oaiHost)
      updateSettings({ oaiHost: 'https://api.aittco.com' });
  }, [oaiKey, oaiHost, updateSettings]);

  return <>

    {/* <ApproximateCosts serviceId={service?.id} /> */}


    {/*{(showAdvanced || !!oaiHost) && (*/}
    {/*  <OpenAIHostAutocomplete*/}
    {/*    value={oaiHost}*/}
    {/*    onChange={host => updateSettings({ oaiHost: host })}*/}
    {/*  />*/}
    {/*)}*/}

    <FormInputKey
      autoCompleteId='openai-key' label='API Key'
      rightLabel={<>{needsUserKey
        ? (!oaiKey && !oaiHost && <Link level='body-sm' href='https://platform.openai.com/account/api-keys' target='_blank'>create key</Link>)
        : (!oaiHost && <AlreadySet /> /* only show "Already set" when using default OpenAI, not custom endpoints */)
      } {oaiKey && !oaiHost && keyValid && <Link level='body-sm' href='https://platform.openai.com/account/usage' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSettings({ oaiKey: value })}
      required={needsUserKey || !!oaiHost} isError={keyError}
      placeholder='sk-...'
    />

    <SetupFormRefetchButton refetch={refetch} disabled={isFetching} error={isError} loading={isFetching} />

    {isError && <InlineError error={error} />}

  </>;
}
