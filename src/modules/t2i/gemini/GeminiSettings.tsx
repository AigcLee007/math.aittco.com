import * as React from 'react';
import { FormControl, Option, Select } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useCapabilityTextToImage } from '~/common/components/useCapabilities';

import { GeminiAspectRatio, useGeminiT2IStore } from './store-module-gemini';


const ASPECT_RATIOS: { value: GeminiAspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横向宽屏)' },
  { value: '9:16', label: '9:16 (纵向手机)' },
  { value: '4:3', label: '4:3 (标准横向)' },
  { value: '3:4', label: '3:4 (标准纵向)' },
  { value: '2:3', label: '2:3 (经典纵向)' },
  { value: '3:2', label: '3:2 (经典横向)' },
  { value: '21:9', label: '21:9 (电影宽屏)' },
  { value: '5:4', label: '5:4 (大画幅纵向)' },
  { value: '4:5', label: '4:5 (大画幅横向)' },
];


export function GeminiSettings() {

  // external state
  const { activeProviderId, providers } = useCapabilityTextToImage();
  const activeProvider = providers.find(p => p.providerId === activeProviderId);

  // state
  const { aspectRatio, setAspectRatio } = useGeminiT2IStore();

  const handleAspectRatioChange = (_event: any, value: GeminiAspectRatio | null) => {
    if (value) setAspectRatio(value);
  };

  // Only show if the active provider is 'googleai'
  if (activeProvider?.vendor !== 'googleai')
    return null;

  return (
    <>
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='宽高比' description='生成图片的比例' />
        <Select
          variant='outlined'
          value={aspectRatio}
          onChange={handleAspectRatioChange}
          slotProps={{
            root: { sx: { minWidth: '160px' } },
            indicator: { sx: { opacity: 0.5 } },
            button: { sx: { whiteSpace: 'inherit' } },
          }}
        >
          {ASPECT_RATIOS.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
      </FormControl>
    </>
  );
}
