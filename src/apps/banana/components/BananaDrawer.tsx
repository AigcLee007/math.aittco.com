import * as React from 'react';
import Router from 'next/router';

import { Box, ListItemButton, ListItemDecorator, Typography, useColorScheme } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';

import { ClaudeSettingsIcon } from '~/common/layout/optima/nav/ClaudeIcons';
import { OptimaDrawerHeader } from '~/common/layout/optima/drawer/OptimaDrawerHeader';
import { OptimaDrawerList } from '~/common/layout/optima/drawer/OptimaDrawerList';
import { optimaCloseDrawer, optimaOpenPreferences, useOptimaDrawerOpen } from '~/common/layout/optima/useOptima';
import { themeSerifFontFamilyCss, themeScalingMap } from '~/common/app.theme';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';
import { useLLM } from '~/common/stores/llms/llms.hooks';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { CanvasToolbar } from './canvas/CanvasToolbar';
import type { CanvasTool } from './canvas/CanvasToolbar';

export const BananaDrawerMemo = React.memo(BananaDrawer);

function BananaDrawer(props: {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onUpload: () => void;
}) {
  const isDrawerOpen = useOptimaDrawerOpen();
  const { mode } = useColorScheme();
  const contentScaling = useUIPreferencesStore(state => state.contentScaling);

  const { domainModelId: activeLLMId } = useModelDomain('primaryChat');
  const activeLLM = useLLM(activeLLMId);
  const sidebarTitle = React.useMemo(() => {
    const vId = activeLLM?.vId;
    if (vId === 'googleai')
      return 'Gemini';
    if (vId === 'anthropic')
      return 'Claude';
    if (vId === 'openai')
      return 'GPT';
    if (vId === 'xai')
      return 'xAI';
    if (vId === 'deepseek')
      return 'DeepSeek';
    if (vId === 'groq')
      return 'Groq';
    if (vId === 'mistral')
      return 'Mistral';
    return 'AI';
  }, [activeLLM?.vId]);

  const handleButtonNew = React.useCallback(() => {
    Router.push('/');
    optimaCloseDrawer();
  }, []);

  return <>
    <OptimaDrawerHeader title='' onClose={optimaCloseDrawer}>
      <Box
        onClick={handleButtonNew}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          flexGrow: 1,
          '&:hover': { opacity: 0.8 },
        }}
      >
        {(() => {
          let logoSrc = '/logo/openai-icon.svg';
          const vId = activeLLM?.vId;
          if (vId === 'googleai')
            logoSrc = '/logo/google-gemini-icon.svg';
          else if (vId === 'anthropic')
            logoSrc = '/logo/claude-ai-icon.svg';
          else if (vId === 'xai')
            logoSrc = '/logo/grok-icon.svg';
          else if (vId === 'openai')
            logoSrc = '/logo/openai-icon.svg';

          return <Box
            component='img'
            src={logoSrc}
            alt='Model Logo'
            draggable={false}
            sx={{
              width: 24,
              height: 24,
              borderRadius: '4px',
              ml: '32px',
              filter: (mode === 'dark' && (vId === 'openai' || vId === 'xai')) ? 'invert(1) brightness(1.5)' : undefined,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />;
        })()}
        <Typography
          className='stationary-icon'
          sx={{
            fontFamily: themeSerifFontFamilyCss,
            fontSize: '1.25rem',
            fontWeight: 600,
            flexGrow: 1,
            ml: 1,
            visibility: isDrawerOpen ? 'visible' : 'hidden',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {activeLLM?.vId === 'xai' ? 'Grok' : sidebarTitle}
        </Typography>
      </Box>
    </OptimaDrawerHeader>

    <Box
      sx={{
        flexGrow: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.surface',
        borderRight: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        minWidth: { xs: 'calc(100svw - 56px)', sm: 'auto' },
      }}
    >
      <OptimaDrawerList variant='plain' noTopPadding noBottomPadding tallRows>
        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1, px: 0, gap: 0.5 }}>
          <ListItemButton onClick={handleButtonNew} sx={{ borderRadius: '0.5rem', py: 1, px: 0, mx: 1 }}>
            <ListItemDecorator className='stationary-icon' sx={{ minWidth: '8px', justifyContent: 'center', ml: '4px', visibility: 'hidden' }}>
              <AddIcon />
            </ListItemDecorator>
            <Typography level='body-sm' sx={{ fontWeight: 500, userSelect: 'none' }}>新对话</Typography>
          </ListItemButton>

          <ListItemButton onClick={() => Router.push('/history')} sx={{ borderRadius: '0.5rem', py: 0.75, px: 0, mx: 1, bgcolor: Router.pathname === '/history' ? 'background.level1' : 'transparent' }}>
            <ListItemDecorator className='stationary-icon' sx={{ minWidth: '8px', justifyContent: 'center', ml: '4px', visibility: 'hidden' }}>
              <EventNoteOutlinedIcon sx={{ fontSize: '1.2rem' }} />
            </ListItemDecorator>
            <Typography level='body-sm' sx={{ userSelect: 'none' }}>历史记录</Typography>
          </ListItemButton>

          <ListItemButton
            onClick={() => Router.push('/banana')}
            sx={{ borderRadius: '0.5rem', py: 0.75, px: 0, mx: 1, bgcolor: Router.pathname === '/banana' ? 'background.level1' : 'transparent' }}
          >
            <ListItemDecorator className='stationary-icon' sx={{ minWidth: '8px', justifyContent: 'center', ml: '4px', visibility: 'hidden' }}>
              <ImageOutlinedIcon sx={{ fontSize: '1.2rem' }} />
            </ListItemDecorator>
            <Typography level='body-sm' sx={{ userSelect: 'none' }}>图像生成</Typography>
          </ListItemButton>

          <Typography level='body-xs' sx={{ mt: 2, mb: 0.5, px: 0, ml: '12px', color: 'text.tertiary', fontWeight: 600, userSelect: 'none' }}>
            画布工具
          </Typography>
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: '20rem',
            overflowY: 'auto',
            ...themeScalingMap[contentScaling].chatDrawerItemSx,
            p: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: '240px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <CanvasToolbar
              activeTool={props.activeTool}
              onToolChange={props.onToolChange}
              onUpload={props.onUpload}
              onOpenImageReverse={() => {
                window.dispatchEvent(new CustomEvent('banana-open-image-reverse'));
              }}
              onOpenHistory={() => {
                window.dispatchEvent(new CustomEvent('banana-open-history'));
              }}
            />
          </Box>
        </Box>
      </OptimaDrawerList>

      <Box
        sx={{
          mt: 'auto',
          p: 1,
          pb: '12px',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ListItemButton
          onClick={() => optimaOpenPreferences()}
          sx={{ borderRadius: '0.5rem', py: 1, px: 0, mx: 1 }}
        >
          <ListItemDecorator className='stationary-icon' sx={{ minWidth: '8px', justifyContent: 'center', ml: '4px', visibility: 'hidden' }}>
            <ClaudeSettingsIcon />
          </ListItemDecorator>
          <Typography level='body-sm' sx={{ fontWeight: 500, userSelect: 'none' }}>设置</Typography>
        </ListItemButton>
      </Box>
    </Box>
  </>;
}
