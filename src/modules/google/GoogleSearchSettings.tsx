import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { FormControl, Input, Typography } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import SearchIcon from '@mui/icons-material/Search';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { ExternalLink } from '~/common/components/ExternalLink';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Link } from '~/common/components/Link';

import { isValidGoogleCloudApiKey, isValidGoogleCseId } from './search.client';
import { useGoogleSearchStore } from './store-module-google';


export function GoogleSearchSettings() {

  // external state
  const backendHasGoogle = getBackendCapabilities().hasGoogleCustomSearch;
  const { googleCloudApiKey, setGoogleCloudApiKey, googleCSEId, setGoogleCSEId, restrictToDomain, setRestrictToDomain } = useGoogleSearchStore(useShallow(state => ({
    googleCloudApiKey: state.googleCloudApiKey, setGoogleCloudApiKey: state.setGoogleCloudApiKey,
    googleCSEId: state.googleCSEId, setGoogleCSEId: state.setGoogleCSEId,
    restrictToDomain: state.restrictToDomain, setRestrictToDomain: state.setRestrictToDomain,
  })));


  // derived state
  const isValidKey = googleCloudApiKey ? isValidGoogleCloudApiKey(googleCloudApiKey) : backendHasGoogle;
  const isValidId = googleCSEId ? isValidGoogleCseId(googleCSEId) : backendHasGoogle;


  const handleGoogleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCloudApiKey(e.target.value);

  const handleCseIdChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoogleCSEId(e.target.value);

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => setRestrictToDomain(e.target.value);


  return <>

    <Typography level='body-sm'>
      用于自定义搜索引擎或特定域的搜索。大多数模型都有原生搜索功能。使用 Google <ExternalLink href='https://developers.google.com/custom-search/v1/overview'>Programmable Search Engine</ExternalLink> API。
    </Typography>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='GCP API Key'
                      description={<>在此 <Link href='https://console.cloud.google.com/apis/credentials' noLinkStyle target='_blank'>创建</Link> 一个</>}
                      tooltip='创建您的 Google Cloud "API Key Credential" 并在此处输入' />
      <Input
        variant='outlined' placeholder={backendHasGoogle ? '...' : '缺失'} error={!isValidKey}
        value={googleCloudApiKey} onChange={handleGoogleApiKeyChange}
        startDecorator={<KeyIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='搜索引擎 ID'
                      description={<>在此 <Link href='https://programmablesearchengine.google.com/' noLinkStyle target='_blank'>获取</Link></>}
                      tooltip='创建您的 Google "Programmable Search Engine" 并在此处输入其 ID' />
      <Input
        variant='outlined' placeholder={backendHasGoogle ? '...' : '缺失'} error={!isValidId}
        value={googleCSEId} onChange={handleCseIdChange}
        startDecorator={<SearchIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='限制到域名'
                      description='可选'
                      tooltip='限制搜索到特定域名 (例如 "wikipedia.org")' />
      <Input
        variant='outlined' placeholder='example.com'
        value={restrictToDomain} onChange={handleDomainChange}
        // startDecorator={<LanguageIcon />}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

  </>;
}