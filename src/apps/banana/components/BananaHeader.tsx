'use client';

import * as React from 'react';
import {
  Box,
  Dropdown,
  IconButton,
  ListDivider,
  Menu,
  MenuButton,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/joy';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DebouncedInputMemo } from '~/common/components/DebouncedInput';
import { DarkModeToggleButton } from '~/common/components/DarkModeToggleButton';
import { AnnouncementCenter } from '~/common/components/AnnouncementCenter';
import { UserMenu } from '~/common/layout/optima/nav/UserMenu';
import { LayoutSidebarRight } from '~/common/components/icons/LayoutSidebarRight';
import {
  getNanoBananaDisplayLabel,
  NANO_BANANA_PRO_LINE1_MODEL_ID,
  NANO_BANANA_PRO_LINE2_MODEL_ID,
} from '../nanoBananaLine1';

export type BananaModelOption = {
  id: string;
  label: string;
  description?: string;
  coinCost?: number;
  iconSrc?: string;
  priceByResolution?: Partial<Record<'1K' | '2K' | '4K', number>>;
  category?: 'IMAGE' | 'VIDEO';
};

interface BananaHeaderProps {
  activeModelId: string;
  onModelChange: (modelId: string) => void;
  models: BananaModelOption[];
  activeResolution?: string;
  queueRunning?: number;
  queuePending?: number;
  onBackNavigation?: () => void;
}

const FALLBACK_MODELS: BananaModelOption[] = [
  {
    id: NANO_BANANA_PRO_LINE1_MODEL_ID,
    label: getNanoBananaDisplayLabel(NANO_BANANA_PRO_LINE1_MODEL_ID, 'Nano Banana Pro'),
    description: '高质量生图旗舰，细节表现与画面一致性更强，适合商业海报与精细创作。',
    coinCost: 12,
    iconSrc: '/logo/google-gemini-icon.svg',
  },
  {
    id: NANO_BANANA_PRO_LINE2_MODEL_ID,
    label: getNanoBananaDisplayLabel(NANO_BANANA_PRO_LINE2_MODEL_ID, 'Nano Banana Pro'),
    description: '备用线路版本，适合在主线路繁忙时继续完成高质量生图任务。',
    coinCost: 12,
    iconSrc: '/logo/google-gemini-icon.svg',
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Nano Banana 2',
    description: '速度与质量均衡，适合多数日常设计与内容配图场景。',
    coinCost: 6,
    iconSrc: '/logo/google-gemini-icon.svg',
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    description: '轻量快速，适合草图探索、风格尝试与高频出图。',
    coinCost: 3,
    iconSrc: '/logo/google-gemini-icon.svg',
  },
  {
    id: 'grok-4.2-image',
    label: 'Grok-4.2-Image',
    description: 'xAI 生图模型，风格表达鲜明，适合创意概念图与视觉风格化生成。',
    coinCost: 8,
    iconSrc: '/logo/grok-icon.svg',
  },
];

function normalizeResolution(resolution?: string): '1K' | '2K' | '4K' {
  if ((resolution || '').toUpperCase() === '2K')
    return '2K';
  if ((resolution || '').toUpperCase() === '4K')
    return '4K';
  return '1K';
}

function getDisplayCoinCost(model: BananaModelOption, resolution?: string): number | undefined {
  const normalizedResolution = normalizeResolution(resolution);
  if (model.priceByResolution?.[normalizedResolution] != null)
    return model.priceByResolution[normalizedResolution];
  return model.coinCost;
}

function getDisplayCoinCostStart(model: BananaModelOption): number | undefined {
  if (model.priceByResolution) {
    const all = (['1K', '2K', '4K'] as const)
      .map((resolution) => model.priceByResolution?.[resolution])
      .filter((value): value is number => typeof value === 'number');
    if (all.length)
      return Math.max(...all);
  }
  return model.coinCost;
}

function getResolutionPriceSummary(model: BananaModelOption): string | undefined {
  if (!model.priceByResolution)
    return undefined;

  const parts = (['1K', '2K', '4K'] as const)
    .filter((resolution) => model.priceByResolution?.[resolution] != null)
    .map((resolution) => `${resolution} ${model.priceByResolution?.[resolution]}🪙`);

  return parts.length ? parts.join(' / ') : undefined;
}

function isVideoModelOption(model?: BananaModelOption): boolean {
  if (model?.category)
    return model.category === 'VIDEO';
  const modelId = model?.id;
  const normalized = String(modelId || '').trim().toLowerCase();
  return normalized.startsWith('sora-')
    || normalized.startsWith('veo3.1')
    || normalized.includes('video');
}

export function BananaHeader(props: BananaHeaderProps) {
  const [filterString, setFilterString] = React.useState<string | null>(null);
  const models = props.models.length > 0 ? props.models : FALLBACK_MODELS;
  const queueRunning = Math.max(0, props.queueRunning || 0);
  const queuePending = Math.max(0, props.queuePending || 0);
  const shouldShowQueueBadge = queueRunning + queuePending > 0;

  const activeModel = models.find((m) => m.id === props.activeModelId) || models[0];
  const filteredModels = React.useMemo(() => {
    if (!filterString)
      return models;
    const keyword = filterString.toLowerCase();
    return models.filter((model) =>
      model.label.toLowerCase().includes(keyword)
      || (model.description || '').toLowerCase().includes(keyword),
    );
  }, [filterString, models]);

  const imageModels = React.useMemo(
    () => filteredModels.filter((model) => !isVideoModelOption(model)),
    [filteredModels],
  );
  const videoModels = React.useMemo(
    () => filteredModels.filter((model) => isVideoModelOption(model)),
    [filteredModels],
  );

  const renderModelItem = (model: BananaModelOption) => {
    const isActive = model.id === props.activeModelId;
    const displayCoinCostStart = getDisplayCoinCostStart(model);
    const priceSummary = getResolutionPriceSummary(model);
    return (
      <MenuItem
        key={model.id}
        selected={isActive}
        onClick={() => props.onModelChange(model.id)}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            minWidth: 40,
            borderRadius: '0.625rem',
            bgcolor: 'background.surface',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            p: '4px',
          }}
        >
          <Box component="img" src={model.iconSrc || '/logo/google-gemini-icon.svg'} sx={{ width: 24, height: 24, flexShrink: 0 }} />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: isActive ? 'primary.plainColor' : 'text.primary' }}>
              {model.label}
            </Typography>
            {typeof displayCoinCostStart === 'number' && (
              <Typography
                level='body-sm'
                sx={{
                  ml: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  fontWeight: 700,
                  color: '#B26B00',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayCoinCostStart} <span aria-label='coin'>{'\u{1FA99}'}</span>起
              </Typography>
            )}
          </Box>
          <Typography
            level="body-xs"
            title={priceSummary ? `${model.description || model.id} | ${priceSummary}` : (model.description || model.id)}
            sx={{
              color: 'text.tertiary',
              fontSize: '0.75rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.45,
            }}
          >
            {priceSummary ? `${priceSummary} · ${model.description || model.id}` : (model.description || model.id)}
          </Typography>
        </Box>
      </MenuItem>
    );
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1.5,
        zIndex: 10,
        backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(28, 28, 28, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        userSelect: 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 1 } }}>
        {/* Back Button (Mobile Only) */}
        {props.onBackNavigation && (
          <IconButton 
            variant="plain" 
            color="neutral" 
            onClick={props.onBackNavigation} 
            sx={{ display: { xs: 'flex', md: 'none' }, minWidth: 40 }}
          >
            <ArrowBackIcon />
          </IconButton>
        )}

        <Dropdown>
          <MenuButton
            slots={{ root: IconButton }}
            slotProps={{
              root: {
                variant: 'soft',
                color: 'neutral',
                sx: {
                  borderRadius: '2rem',
                  px: 1.5,
                  width: { xs: 'auto', sm: 260 },
                  maxWidth: { xs: 'calc(100vw - 160px)', sm: 260 },
                  py: 0.5,
                  bgcolor: 'neutral.softBg',
                  '&:hover': { bgcolor: 'neutral.softHoverBg' },
                },
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', px: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box component="img" src={activeModel?.iconSrc || '/logo/google-gemini-icon.svg'} sx={{ width: 22, height: 22, flexShrink: 0 }} />
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'text.primary' }}>
                  {activeModel?.label || '选择模型'}
                </Typography>
              </Box>
              <KeyboardArrowDownIcon sx={{ color: 'text.tertiary', fontSize: '1.2rem' }} />
            </Box>
          </MenuButton>
          <Menu
            variant="outlined"
            placement="bottom-start"
            sx={{
              borderRadius: '1.5rem',
              boxShadow: '0 12px 24px -4px rgba(0,0,0,0.1), 0 4px 12px -2px rgba(0,0,0,0.05)',
              width: 360,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'min(78vh, 720px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              p: 0,
              mt: 0.5,
              border: '1px solid',
              borderColor: 'divider',
              zIndex: 1000,
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': {
                width: 8,
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(120,120,120,0.45)',
                borderRadius: 8,
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
              },
              '& .MuiMenuItem-root': {
                minHeight: '3.25rem',
                borderRadius: '0.75rem',
                mx: 0.75,
                my: 0.25,
                px: 0.75,
                gap: 1.5,
                transition: 'background 0.2s',
                '&:hover': { bgcolor: 'neutral.softBg' },
                '&.Mui-selected': {
                  bgcolor: 'primary.softBg',
                  color: 'primary.plainColor',
                  '&:hover': { bgcolor: 'primary.softHoverBg' },
                },
              },
            }}
          >
            <Box sx={{ p: 1.5, pb: 0.5 }}>
              <DebouncedInputMemo
                aggressiveRefocus
                debounceTimeout={300}
                onDebounce={setFilterString}
                placeholder={`搜索 ${models.length} 个模型...`}
                sx={{
                  '--Input-radius': '0.75rem',
                  backgroundColor: 'neutral.softBg',
                  border: 'none',
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: 'neutral.softHoverBg',
                  },
                }}
              />
            </Box>

            {imageModels.length > 0 && (
              <>
                <ListDivider
                  sx={{
                    '--ListDivider-gap': '1rem',
                    '&::before, &::after': { borderTop: '1px solid', borderColor: 'divider', opacity: 0.5 },
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'text.tertiary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    py: 1,
                  }}
                >
                  图片模型
                </ListDivider>
                {imageModels.map(renderModelItem)}
              </>
            )}

            {videoModels.length > 0 && (
              <>
                <ListDivider
                  sx={{
                    '--ListDivider-gap': '1rem',
                    '&::before, &::after': { borderTop: '1px solid', borderColor: 'divider', opacity: 0.5 },
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'text.tertiary',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    py: 1,
                  }}
                >
                  视频模型
                </ListDivider>
                {videoModels.map(renderModelItem)}
              </>
            )}
          </Menu>
        </Dropdown>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {shouldShowQueueBadge && (
          <Box
            sx={{
              px: { xs: 0.8, sm: 1.25 },
              py: 0.5,
              borderRadius: '999px',
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(101, 164, 255, 0.55)' : 'primary.outlinedBorder',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(24, 78, 165, 0.3)' : 'primary.softBg',
              color: (theme) => theme.palette.mode === 'dark' ? '#9CC8FF' : 'primary.700',
              fontSize: { xs: '0.65rem', sm: '0.78rem' },
              fontWeight: 700,
              whiteSpace: 'nowrap',
              mr: { xs: 0, sm: 0.5 },
              boxShadow: (theme) => theme.palette.mode === 'dark' ? 'inset 0 0 0 1px rgba(7, 27, 61, 0.35)' : 'none',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>并发队列 运行中 </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>⚡ </Box>
            {queueRunning}/5 
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}> · 排队中 {queuePending}</Box>
          </Box>
        )}

        <AnnouncementCenter showStrip={false} />

        <Tooltip title="白昼/暗夜切换" placement="bottom">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DarkModeToggleButton />
          </Box>
        </Tooltip>
        
        {/* History Entry (Mobile Only, replacing UserMenu at Mark 1) */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', ml: 0.5 }}>
          <Tooltip title="历史记录" variant="soft">
            <IconButton
              variant="soft"
              color="primary"
              onClick={() => window.dispatchEvent(new CustomEvent('banana-open-history'))}
              sx={{ borderRadius: '50%', width: 40, height: 40 }}
            >
              <HistoryRoundedIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Tooltip title="图片历史记录" placement="bottom">
          <IconButton
            size="sm"
            variant="plain"
            color="neutral"
            onClick={() => window.dispatchEvent(new CustomEvent('banana-open-history'))}
            sx={{
              borderRadius: '0.5rem',
              '&:hover': { bgcolor: 'neutral.softBg' },
            }}
          >
            <LayoutSidebarRight />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
