'use client';

import * as React from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  IconButton,
  Modal,
  ModalClose,
  ModalDialog,
  Option,
  Select,
  Textarea,
  Typography,
} from '@mui/joy';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import type { BananaDescribeImageResult, BananaPromptOutputLanguage } from '../banana.api';
import { describeBananaImage } from '../banana.api';

interface ImageReversePromptModalProps {
  open: boolean;
  onClose: () => void;
  onApplyPrompt: (prompt: string) => void;
  onNotify?: (message: string) => void;
}

async function copyToClipboard(text: string) {
  if (!text)
    return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.focus();
  helper.select();
  document.execCommand('copy');
  document.body.removeChild(helper);
}

export function ImageReversePromptModal({ open, onClose, onApplyPrompt, onNotify }: ImageReversePromptModalProps) {
  const [imageData, setImageData] = React.useState('');
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [errorText, setErrorText] = React.useState('');
  const [result, setResult] = React.useState<BananaDescribeImageResult | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [outputLanguage, setOutputLanguage] = React.useState<BananaPromptOutputLanguage>('zh-CN');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setErrorText('');
      setIsAnalyzing(false);
      setCopiedKey(null);
    }
  }, [open]);

  const handleFile = React.useCallback((file: File | null) => {
    if (!file)
      return;
    if (!file.type.startsWith('image/')) {
      setErrorText('请上传图片文件。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl) {
        setImageData(dataUrl);
        setResult(null);
        setErrorText('');
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const analyzeImage = React.useCallback(async () => {
    if (!imageData || isAnalyzing)
      return;
    setIsAnalyzing(true);
    setErrorText('');
    setCopiedKey(null);
    try {
      const parsed = await describeBananaImage(imageData, outputLanguage);
      setResult(parsed);
    } catch (error: any) {
      const message = error?.message || '图片逆推失败，请稍后重试。';
      setErrorText(message);
      onNotify?.(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageData, isAnalyzing, onNotify, outputLanguage]);

  const onCopy = React.useCallback(async (key: string, value: string) => {
    await copyToClipboard(value);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1200);
  }, []);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        layout='center'
        size='lg'
        sx={{
          width: 'min(980px, calc(100vw - 2rem))',
          maxHeight: 'calc(100vh - 2rem)',
          overflow: 'auto',
          borderRadius: '18px',
          border: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
          background: (theme) => theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(16,20,30,0.98) 0%, rgba(12,15,24,0.98) 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          boxShadow: (theme) => theme.palette.mode === 'dark'
            ? '0 24px 70px rgba(0,0,0,0.5)'
            : '0 24px 70px rgba(15,23,42,0.16)',
          p: 2,
        }}
      >
        <ModalClose />

        <Typography level='h4'>图片逆推提示词</Typography>
        <Typography level='body-sm' sx={{ color: 'text.tertiary', mb: 1 }}>
          使用模型 `gemini-3-pro-preview`，每次解析消耗 3 🪙。
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Box
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0] || null);
              }}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                height: 240,
                borderRadius: '14px',
                border: '1px dashed',
                borderColor: 'divider',
                bgcolor: 'background.level1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'background-color 0.15s ease',
                '&:hover': { bgcolor: 'neutral.softBg' },
              }}
            >
              {imageData
                ? (
                    <Box
                      component='img'
                      src={imageData}
                      alt='reverse-source'
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )
                : (
                    <Box sx={{ textAlign: 'center', color: 'text.tertiary' }}>
                      <AddPhotoAlternateRoundedIcon sx={{ fontSize: '2rem', mb: 0.5 }} />
                      <Typography level='body-sm'>点击或拖拽上传一张图片</Typography>
                    </Box>
                  )}
            </Box>

            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFile(e.target.files?.[0] || null);
                e.currentTarget.value = '';
              }}
            />

            <FormControl size='sm'>
              <FormLabel>提示词输出语言</FormLabel>
              <Select
                value={outputLanguage}
                onChange={(_, value) => {
                  if (value)
                    setOutputLanguage(value);
                }}
                sx={{ borderRadius: '10px' }}
              >
                <Option value='zh-CN'>中文</Option>
                <Option value='en'>英语</Option>
                <Option value='ko'>韩语</Option>
                <Option value='es'>西班牙语</Option>
                <Option value='la'>拉丁文</Option>
              </Select>
            </FormControl>

            <Button
              color='primary'
              startDecorator={<AutoFixHighRoundedIcon />}
              onClick={() => void analyzeImage()}
              loading={isAnalyzing}
              disabled={!imageData || isAnalyzing}
              sx={{ borderRadius: '999px' }}
            >
              {isAnalyzing ? '解析中...' : '开始逆推'}
            </Button>

            {!!errorText && (
              <Typography level='body-xs' color='danger'>
                {errorText}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 1 }}>
              <Typography level='title-sm' sx={{ mb: 0.75 }}>专业解析</Typography>
              <Textarea
                minRows={5}
                maxRows={12}
                value={result?.analysis || ''}
                readOnly
                placeholder='解析结果会显示在这里...'
                sx={{ '--Textarea-focusedHighlight': 'transparent' }}
              />
            </Box>

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography level='title-sm'>普通格式提示词</Typography>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  <Button
                    size='sm'
                    variant='plain'
                    startDecorator={copiedKey === 'plain' ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
                    onClick={() => void onCopy('plain', result?.plainPrompt || '')}
                    disabled={!result?.plainPrompt}
                  >
                    {copiedKey === 'plain' ? '已复制' : '复制'}
                  </Button>
                  <Button
                    size='sm'
                    variant='soft'
                    onClick={() => {
                      if (result?.plainPrompt)
                        onApplyPrompt(result.plainPrompt);
                    }}
                    disabled={!result?.plainPrompt}
                  >
                    用于生图
                  </Button>
                </Box>
              </Box>
              <Textarea
                minRows={4}
                maxRows={10}
                value={result?.plainPrompt || ''}
                readOnly
                placeholder='普通提示词会显示在这里...'
                sx={{ '--Textarea-focusedHighlight': 'transparent' }}
              />
            </Box>

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography level='title-sm'>JSON 格式提示词</Typography>
                <IconButton
                  size='sm'
                  variant='plain'
                  onClick={() => void onCopy('json', result?.jsonPrompt || '')}
                  disabled={!result?.jsonPrompt}
                >
                  {copiedKey === 'json' ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
                </IconButton>
              </Box>
              <Textarea
                minRows={6}
                maxRows={14}
                value={result?.jsonPrompt || ''}
                readOnly
                placeholder='JSON 提示词会显示在这里...'
                sx={{ '--Textarea-focusedHighlight': 'transparent', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
              />
            </Box>
          </Box>
        </Box>
      </ModalDialog>
    </Modal>
  );
}
