import * as React from 'react';

import { FormControl, Option, Select, Slider, Switch, Typography } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { FormSelectControl } from '~/common/components/forms/FormSelectControl';
import { Link } from '~/common/components/Link';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { DALLE_DEFAULT_IMAGE_SIZE, DalleImageSize, DalleModelSelection, getImageModelFamily, resolveDalleModelId, useDalleStore } from './store-module-dalle';
import { openAIImageModelsPricing } from './openaiGenerateImages';


const CONF = {

  MODEL_OPTS: [
    { value: 'gpt-image-1.5', label: 'GPT Image 1.5' },
    { value: 'gpt-image-1', label: 'GPT Image 1' },
    { value: 'gpt-image-1-mini', label: 'GPT Image Mini' },
    { value: 'dall-e-2', label: 'DALL·E 2' },
    { value: 'dall-e-3', label: 'DALL·E 3' },
    { value: null, label: '自动' },
  ] as { value: DalleModelSelection; label: string, description?: string }[],

  RES_D2: ['256x256', '512x512', '1024x1024'] as DalleImageSize[],
  RES_D3: ['1024x1024', '1792x1024', '1024x1792'] as DalleImageSize[],
  RES_GI: ['1024x1024', '1536x1024', '1024x1536'] as DalleImageSize[],

  QUALITY_GI: [
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
  ],
  BACKGROUND_GI: [
    // { value: 'opaque', label: 'Opaque' },
    { value: 'transparent', label: '透明' },
    { value: 'auto', label: '自动' },
  ],
  OUT_FORMAT_GI: [
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
  ],
  MODERATION_GI: [
    { value: 'auto', label: '标准' },
    { value: 'low', label: '宽松' },
  ],

  STYLE_D3: [
    { value: 'natural', label: '自然' },
    { value: 'vivid', label: '生动' },
  ],

} as const;


export function DallESettings() {

  // state
  const advanced = useToggleableBoolean(false, 'DallESettings');

  // external state
  const {
    dalleModelId, setDalleModelId,
    dalleQualityD3, setDalleQualityD3,
    dalleQualityGI, setDalleQualityGI,
    dalleSizeD3, setDalleSizeD3,
    dalleSizeD2, setDalleSizeD2,
    dalleSizeGI, setDalleSizeGI,
    dalleStyleD3, setDalleStyleD3,
    dalleNoRewrite, setDalleNoRewrite,
    dalleBackgroundGI, setDalleBackgroundGI,
    dalleOutputFormatGI, setDalleOutputFormatGI,
    dalleOutputCompressionGI, setDalleOutputCompressionGI,
    dalleModerationGI, setDalleModerationGI,
  } = useDalleStore();


  const handleDalleQualityD3Change = (event: React.ChangeEvent<HTMLInputElement>) =>
    setDalleQualityD3(event.target.checked ? 'hd' : 'standard');

  const handleDalleNoRewriteChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setDalleNoRewrite(!event.target.checked);

  const handleResolutionD3Change = (_event: any, value: DalleImageSize | null) =>
    value && setDalleSizeD3(value as any);

  const handleResolutionD2Change = (_event: any, value: DalleImageSize | null) =>
    value && setDalleSizeD2(value as any);

  const handleResolutionGIChange = (_event: any, value: DalleImageSize | null) =>
    value && setDalleSizeGI(value as any);

  const handleCompressionChange = (_event: Event, newValue: number | number[]) =>
    setDalleOutputCompressionGI(newValue as number);

  const handleModerationGIChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setDalleModerationGI(!event.target.checked ? 'low' : 'auto');


  // derived state - resolve the actual model and family
  const resolvedDalleModelId = resolveDalleModelId(dalleModelId);
  const family = getImageModelFamily(resolvedDalleModelId);
  const isGI = family === 'gpt-image';
  const isD3 = family === 'dall-e-3';
  const isD2 = family === 'dall-e-2';

  const isD3HD = isD3 && dalleQualityD3 === 'hd';


  // Select resolution options based on model

  const resolutions = isD2 ? CONF.RES_D2 : isD3 ? CONF.RES_D3 : CONF.RES_GI;
  const currentResolution = isD2 ? dalleSizeD2 : isD3 ? dalleSizeD3 : dalleSizeGI;
  const hasResolution = resolutions.includes(currentResolution);

  const isGICompressible = dalleOutputFormatGI === 'webp' || dalleOutputFormatGI === 'jpeg';

  const showTransparencyWarning = isGI
    && dalleBackgroundGI === 'transparent'
    && dalleOutputFormatGI !== 'png'
    && dalleOutputFormatGI !== 'webp';

  const costPerImage = openAIImageModelsPricing(resolvedDalleModelId,
    isD3 ? dalleQualityD3 : isGI ? dalleQualityGI : 'standard',
    currentResolution);


  return <>

    <FormSelectControl
      title='模型'
      // description={dalleModelId === null ? `Latest (${resolvedDalleModelId})` : isGI ? 'Latest' : isD3 ? 'Good' : 'Older'}
      options={CONF.MODEL_OPTS.map(opt => ({ ...opt, value: opt.value || 'auto', description: opt.description ?? '' }))}
      value={dalleModelId || 'auto'}
      onChange={(value) => setDalleModelId(value === 'auto' ? null : value as DalleModelSelection)}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='分辨率'
                      description={!hasResolution
                        ? '不支持'
                        : currentResolution === DALLE_DEFAULT_IMAGE_SIZE ? '默认' : '自定义'
                      } />
      <Select
        variant='outlined'
        // color='primary'
        value={currentResolution}
        onChange={isD2 ? handleResolutionD2Change : isD3 ? handleResolutionD3Change : handleResolutionGIChange}
        startDecorator={hasResolution ? undefined : <WarningRoundedIcon color='warning' />}
        slotProps={{
          root: { sx: { minWidth: '120px' } },
          indicator: { sx: { opacity: 0.5 } },
          button: { sx: { whiteSpace: 'inherit' } },
        }}
      >
        {resolutions.map((resolution) =>
          <Option key={'res-' + resolution} value={resolution}>
            {resolution.replace('x', ' x ')}
          </Option>,
        )}
      </Select>
    </FormControl>

    {/* GPT-Image specific settings */}
    {isGI && <>
      <FormChipControl
        title='质量'
        // color='primary'
        description='高质量生成时间更长'
        options={CONF.QUALITY_GI}
        value={dalleQualityGI} onChange={setDalleQualityGI}
      />

      <FormChipControl
        title='背景'
        // color='primary'
        description={
          !showTransparencyWarning
            ? '透明度'
            : <Typography level='body-xs' color='warning'>
              透明背景需要 PNG 或 WebP 格式
            </Typography>
        }
        options={CONF.BACKGROUND_GI}
        value={dalleBackgroundGI} onChange={setDalleBackgroundGI}
      />

      {advanced.on && <FormChipControl
        title='文件格式'
        // color='primary'
        description='生成图像的文件格式'
        options={CONF.OUT_FORMAT_GI}
        value={dalleOutputFormatGI} onChange={setDalleOutputFormatGI}
      />}

      {advanced.on && /*(dalleOutputFormatGI === 'webp' || dalleOutputFormatGI === 'jpeg') &&*/ (
        <FormControl disabled={!isGICompressible} orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <FormLabelStart title='文件质量'
                          description={(isGICompressible && dalleOutputCompressionGI !== 100) ? `${100 - dalleOutputCompressionGI}% 压缩` : '未压缩'} />
          <Slider
            aria-label='File Quality'
            color='neutral'
            disabled={dalleOutputFormatGI !== 'webp' && dalleOutputFormatGI !== 'jpeg'}
            value={!isGICompressible ? 0 : dalleOutputCompressionGI}
            onChange={handleCompressionChange}
            min={5}
            max={100}
            step={5}
            // valueLabelDisplay='auto'
            sx={{ width: '180px', mr: 1 }}
          />
        </FormControl>
      )}

      {advanced.on && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='审查'
                        description='内容过滤严格程度'
          // description={dalleModerationGI === 'low' ? 'Less Restrictive' : 'Standard (default)'}
        />
        <Switch checked={dalleModerationGI === 'auto'} onChange={handleModerationGIChange}
                startDecorator={dalleModerationGI === 'low' ? '宽松' : '标准'} />
      </FormControl>}

    </>}


    {isD3 && <>
      <FormRadioControl
        title='风格'
        description={(isD3 && dalleStyleD3 === 'vivid') ? '超真实' : '写实'}
        disabled={!isD3}
        options={CONF.STYLE_D3}
        value={isD3 ? dalleStyleD3 : 'natural'} onChange={setDalleStyleD3}
      />

      <FormControl orientation='horizontal' disabled={!isD3} sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='质量'
                        description={isD3HD ? '细节丰富' : '默认'} />
        <Switch checked={isD3HD} onChange={handleDalleQualityD3Change}
                startDecorator={isD3HD ? 'HD' : '标准'} />
      </FormControl>
    </>}


    {advanced.on && (isD3 || isD2) && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='优化 Prompt'
                      description={dalleNoRewrite ? '不重写' : '重写 (默认)'}
                      tooltip={<>
                        OpenAI 默认会重写以优化 Prompt。
                        可以禁用此功能以获得对 Prompt 的更多控制权。
                        查看 <Link href='https://platform.openai.com/docs/guides/images-vision' target='_blank'>
                        OpenAI 文档 </Link>
                      </>}
      />
      <Switch checked={!dalleNoRewrite} onChange={handleDalleNoRewriteChange}
              startDecorator={dalleNoRewrite ? '否' : '优化'} />
    </FormControl>}

    {advanced.on && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='单张图片成本'
                      tooltip={!isGI ? undefined : 'OpenAI gpt-image-1 和类似模型还将收取输入文本 token 的费用'}
                      // description={<Link href='https://platform.openai.com/docs/models/gpt-image-1-mini' target='_blank' noLinkStyle sx={{ textDecoration: 'none' }}>OpenAI Pricing </Link>}
      />
      <Typography>{costPerImage}</Typography>
      {/*<Link href='https://platform.openai.com/docs/models/gpt-image-1-mini' target='_blank' typography='body-sm'>OpenAI Pricing </Link>*/}
    </FormControl>}


    <FormLabelStart title={advanced.on ? '隐藏高级选项' : '高级选项'} onClick={advanced.toggle} />

  </>;
}
