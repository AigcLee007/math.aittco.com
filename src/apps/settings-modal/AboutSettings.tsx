import * as React from 'react';
import { Box, Typography, Chip, List, ListItem, Sheet } from '@mui/joy';
import { apiQuery } from '~/common/util/trpc.client';

type ChatModelPricing = {
  modelId: string;
  modelName: string;
  coinCost: number;
};

type GenerateModelPricing = {
  modelId: string;
  modelName: string;
  coinCost: number;
  category: 'IMAGE' | 'VIDEO';
};

function getModelLogo(modelId: string, category?: 'IMAGE' | 'VIDEO'): string {
  const normalized = modelId.trim().replace(/^models\//, '').toLowerCase();
  if (normalized.startsWith('claude-'))
    return '/logo/claude-ai-icon.svg';
  if (normalized.startsWith('gpt-') || normalized.startsWith('openai/'))
    return '/logo/openai-icon.svg';
  if (normalized.startsWith('grok-'))
    return '/logo/grok-icon.svg';
  if (normalized.startsWith('gemini-') || normalized.startsWith('veo') || category === 'IMAGE' || category === 'VIDEO')
    return '/logo/google-gemini-icon.svg';
  return '/logo.svg';
}

function PriceCard(props: {
  title: string;
  subtitle: string;
  accent: string;
  accentSoftBg?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet
      variant='outlined'
      sx={{
        p: 1.5,
        borderRadius: 'lg',
        background: props.accentSoftBg || 'background.surface',
        borderColor: 'divider',
        minHeight: 180,
      }}
    >
      <Typography level='title-sm' sx={{ fontWeight: 700, color: props.accent }}>
        {props.title}
      </Typography>
      <Typography level='body-xs' sx={{ color: 'text.secondary', mt: 0.5, mb: 1.25, lineHeight: 1.6 }}>
        {props.subtitle}
      </Typography>
      {props.children}
    </Sheet>
  );
}

function LowestModelRow(props: {
  model: GenerateModelPricing | null;
  fallback: string;
}) {
  if (!props.model) {
    return (
      <Typography level='body-sm' sx={{ mt: 1.5 }}>
        当前最低模型：<b>{props.fallback}</b>
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
      <Box
        component='img'
        src={getModelLogo(props.model.modelId, props.model.category)}
        alt=''
        sx={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }}
      />
      <Typography level='body-sm'>
        当前最低模型：<b>{props.model.modelName || props.model.modelId}</b>
      </Typography>
    </Box>
  );
}

function PriceBadge(props: {
  value: number | null;
  accentColor: string;
  softBg: string;
}) {
  return (
    <Sheet
      variant='soft'
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        px: 1.25,
        py: 1,
        borderRadius: 'xl',
        background: props.softBg,
        boxShadow: 'sm',
      }}
    >
      <Typography level='h2' sx={{ fontSize: '2.4rem', fontWeight: 900, color: props.accentColor, lineHeight: 1 }}>
        {props.value ?? '--'}
      </Typography>
      <Typography level='body-xs' sx={{ color: 'text.secondary', mt: 0.35 }}>
        金币 / 次起
      </Typography>
    </Sheet>
  );
}

export function AboutSettings() {
  const { data: chatModels } = (apiQuery.coin.getChatModels as any).useQuery(undefined, {
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
  const { data: generateModels } = (apiQuery.coin.getGenerateModels as any).useQuery(undefined, {
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const chatPricing = React.useMemo<ChatModelPricing[]>(() => {
    if (!Array.isArray(chatModels))
      return [];
    return [...chatModels]
      .filter((item): item is ChatModelPricing => !!item && typeof item.modelId === 'string' && typeof item.coinCost === 'number')
      .sort((a, b) => a.coinCost - b.coinCost || (a.modelName || a.modelId).localeCompare(b.modelName || b.modelId));
  }, [chatModels]);

  const generatePricing = React.useMemo<GenerateModelPricing[]>(() => {
    if (!Array.isArray(generateModels))
      return [];
    return [...generateModels]
      .filter((item): item is GenerateModelPricing => !!item
        && typeof item.modelId === 'string'
        && typeof item.coinCost === 'number'
        && (item.category === 'IMAGE' || item.category === 'VIDEO'));
  }, [generateModels]);

  const imagePricing = React.useMemo(
    () => generatePricing.filter(item => item.category === 'IMAGE').sort((a, b) => a.coinCost - b.coinCost || (a.modelName || a.modelId).localeCompare(b.modelName || b.modelId)),
    [generatePricing],
  );

  const videoPricing = React.useMemo(
    () => generatePricing.filter(item => item.category === 'VIDEO').sort((a, b) => a.coinCost - b.coinCost || (a.modelName || a.modelId).localeCompare(b.modelName || b.modelId)),
    [generatePricing],
  );

  const cheapestImage = imagePricing[0] || null;
  const cheapestVideo = videoPricing[0] || null;
  const visibleChatPricing = chatPricing.slice(0, 6);
  const hasMoreChatModels = chatPricing.length > visibleChatPricing.length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <Box component='img' src='/logo.svg' sx={{ width: 56, height: 56, objectFit: 'contain', mb: 0.5 }} />

      <Typography level='title-lg' sx={{ fontWeight: 'bold' }}>
        数模工作台
      </Typography>

      <Chip variant='soft' size='sm'>
        v1.1.0
      </Chip>

      <Typography
        level='body-sm'
        sx={{
          textAlign: 'justify',
          textJustify: 'inter-ideograph',
          maxWidth: 600,
          color: 'text.secondary',
          lineHeight: 1.5,
          letterSpacing: '0.01em',
          mt: 1,
          px: 1,
        }}
      >
        数模工作台是面向建模、创作与协作的智能工作平台，支持多模型调用、文档处理与内容生成，帮助你更高效地完成从想法到结果的全流程工作。
      </Typography>

      <Typography
        level='body-xs'
        sx={{
          color: 'danger.plainColor',
          textAlign: 'center',
          maxWidth: 500,
          background: 'rgba(var(--joy-palette-danger-mainChannel) / 0.05)',
          py: 1,
          px: 1.5,
          borderRadius: 'md',
          border: '1px solid',
          borderColor: 'danger.softBorder',
          mt: 1,
        }}
      >
        注意：本站 API 仅用于技术测试与体验，请遵守当地法律法规并合法使用。
      </Typography>

      <Sheet
        variant='soft'
        sx={{
          width: '100%',
          maxWidth: 820,
          mt: 1.5,
          px: { xs: 1.5, md: 2 },
          py: { xs: 1.5, md: 2 },
          borderRadius: 'lg',
          border: '1px solid',
          borderColor: 'divider',
          background: 'rgba(var(--joy-palette-primary-mainChannel) / 0.04)',
        }}
      >
        <Typography level='title-sm' sx={{ fontWeight: 700, mb: 1 }}>
          价格说明
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr 1fr' },
            gap: 1.5,
          }}
        >
          <PriceCard title='文本模型' subtitle='按单次对话请求扣费，下面展示当前启用文本模型的单次金币价格。' accent='primary.500'>
            <List size='sm' sx={{ '--List-gap': '0.45rem' }}>
              {visibleChatPricing.length ? visibleChatPricing.map(model => (
                <ListItem key={model.modelId} sx={{ py: 0.15, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0, color: 'text.primary' }}>{model.modelName || model.modelId}</Box>
                  <Typography level='body-sm' sx={{ whiteSpace: 'nowrap', color: 'primary.600', fontWeight: 700 }}>
                    {model.coinCost} 金币
                  </Typography>
                </ListItem>
              )) : (
                <ListItem sx={{ py: 0.25, color: 'text.secondary' }}>暂未读取到文本模型价格配置</ListItem>
              )}
            </List>
            {hasMoreChatModels && (
              <Typography level='body-xs' sx={{ color: 'text.tertiary', mt: 0.75 }}>
                更多模型以后台配置为准。
              </Typography>
            )}
          </PriceCard>

          <PriceCard
            title='生图模型'
            subtitle='生图按所选模型与线路结算，以下展示当前启用模型中的最低门槛。'
            accent='success.600'
            accentSoftBg='linear-gradient(180deg, rgba(var(--joy-palette-success-mainChannel) / 0.10) 0%, rgba(var(--joy-palette-success-mainChannel) / 0.03) 100%)'
          >
            <PriceBadge
              value={cheapestImage?.coinCost ?? null}
              accentColor='var(--joy-palette-success-600)'
              softBg='rgba(var(--joy-palette-success-mainChannel) / 0.12)'
            />
            <LowestModelRow model={cheapestImage} fallback='暂未配置' />
          </PriceCard>

          <PriceCard
            title='视频模型'
            subtitle='视频按所选模型结算，以下展示当前启用视频模型中的最低门槛。'
            accent='warning.600'
            accentSoftBg='linear-gradient(180deg, rgba(var(--joy-palette-warning-mainChannel) / 0.12) 0%, rgba(var(--joy-palette-warning-mainChannel) / 0.04) 100%)'
          >
            <PriceBadge
              value={cheapestVideo?.coinCost ?? null}
              accentColor='var(--joy-palette-warning-700)'
              softBg='rgba(var(--joy-palette-warning-mainChannel) / 0.14)'
            />
            <LowestModelRow model={cheapestVideo} fallback='暂未配置' />
          </PriceCard>
        </Box>

        <Typography level='body-xs' sx={{ color: 'text.tertiary', mt: 1.5 }}>
          实际扣费以你当前选择的具体模型、线路和后台启用配置为准；如果管理员调整价格，这里的说明会自动同步更新。
        </Typography>
      </Sheet>

      <Typography level='body-xs' sx={{ color: 'text.tertiary', mt: 1.5, mb: 1 }}>
        © 2025 数模工作台. All rights reserved.
      </Typography>
    </Box>
  );
}
