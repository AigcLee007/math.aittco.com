import * as React from 'react';
import { Box, Typography, Stack, useColorScheme, Card, IconButton, Tooltip } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';
import { useLLM } from '~/common/stores/llms/llms.hooks';

import { themeSerifFontFamilyCss } from '~/common/app.theme';

// Claude Starburst Icon SVG
const ClaudeStarburst = ({ color = '#D97757', size = 48 }: { color?: string, size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 15L52 35L50 50L48 35L50 15Z" fill={color} />
    <path d="M50 85L48 65L50 50L52 65L50 85Z" fill={color} />
    <path d="M15 50L35 52L50 50L35 48L15 50Z" fill={color} />
    <path d="M85 50L65 48L50 50L65 52L85 50Z" fill={color} />
    <path d="M25 25L40 40L50 50L40 40L25 25Z" fill={color} />
    <path d="M75 75L60 60L50 50L60 60L75 75Z" fill={color} />
    <path d="M25 75L40 60L50 50L40 60L25 75Z" fill={color} />
    <path d="M75 25L60 40L50 50L60 40L75 25Z" fill={color} />
    {/* Additional rays for density */}
    <path d="M35 15L45 42L50 50L43 38L35 15Z" fill={color} opacity="0.8" />
    <path d="M65 85L55 58L50 50L57 62L65 85Z" fill={color} opacity="0.8" />
    <path d="M15 35L42 45L50 50L38 43L15 35Z" fill={color} opacity="0.8" />
    <path d="M85 65L58 55L50 50L62 57L85 65Z" fill={color} opacity="0.8" />
    <path d="M35 85L45 58L50 50L43 62L35 85Z" fill={color} opacity="0.8" />
    <path d="M65 15L55 42L50 50L57 38L65 15Z" fill={color} opacity="0.8" />
    <path d="M15 65L42 55L50 50L38 57L15 65Z" fill={color} opacity="0.8" />
    <path d="M85 35L58 45L50 50L62 43L85 35Z" fill={color} opacity="0.8" />
  </svg>
);

const GREETINGS = [
  'Start a new chat to begin.',
  'Welcome back to your workspace.',
  'Let\'s build something together.',
  'What\'s on your mind?',
  'I\'m here to help you think, write, and create.',
  'Ready to dive into a new project?',
  'What shall we think through?',
];

const ToolIcon = ({ src, alt }: { src: string, alt: string }) => (
  <Box 
    component="img" 
    src={src} 
    alt={alt}
    sx={{ 
      width: 16, 
      height: 16, 
      borderRadius: '2px',
      filter: 'grayscale(0.2)',
      '&:hover': { filter: 'grayscale(0)' }
    }} 
  />
);

export function MathWelcome(props: {
  composer?: React.ReactNode;
}) {
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';

  const { domainModelId: chatLLMId } = useModelDomain('primaryChat');
  const chatLLM = useLLM(chatLLMId);

  const welcomeMessage = React.useMemo(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)], []);

  let logoSrc = '/logo/openai-icon.svg'; // fallback
  if (chatLLM?.vId === 'googleai') logoSrc = '/logo/google-gemini-icon.svg';
  else if (chatLLM?.vId === 'anthropic') logoSrc = '/logo/claude-ai-icon.svg';
  else if (chatLLM?.vId === 'xai') logoSrc = '/logo/grok-icon.svg';
  else if (chatLLM?.vId === 'openai') logoSrc = '/logo/openai-icon.svg';

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      minHeight: 0,
      px: { xs: 2, md: 4 },
      py: 4,
      gap: 4,
    }}>
      

      {/* Greeting Section */}
      <Stack direction="row" alignItems="center" spacing={2.5}>
        <Box 
          component="img" 
          src={logoSrc} 
          alt="Model Logo"
          sx={{ 
            width: 42, 
            height: 42, 
            borderRadius: '8px',
            filter: (isDark && (chatLLM?.vId === 'openai' || chatLLM?.vId === 'xai')) ? 'invert(1) brightness(1.5)' : undefined,
            userSelect: 'none',
            pointerEvents: 'none',
          }} 
        />
        <Typography
          level="h1"
          sx={{
            fontFamily: themeSerifFontFamilyCss,
            fontSize: { xs: '2.5rem', md: '3.4rem' },
            fontWeight: 400,
            fontVariationSettings: '"opsz" 48',
            fontFeatureSettings: '"liga" 1',
            letterSpacing: '-0.02em',
            color: 'text.primary',
            userSelect: 'none',
            lineHeight: 1.1,
          }}
        >
          {welcomeMessage}
        </Typography>
      </Stack>

      <Stack sx={{ width: '100%', maxWidth: { xs: '100%', md: '60vw' }, gap: 1 }}>
        {/* Main Mock Search Box or Real Composer */}
        {props.composer || (
          <Card
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: '1.5rem',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              boxShadow: '0 4px 20px -5px rgba(0,0,0,0.05)',
              minHeight: 140,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              userSelect: 'none',
            }}
          >
            <Typography 
              level="body-lg" 
              sx={{ 
                  color: 'text.tertiary',
                  fontSize: '1.125rem',
                  ml: 1,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                  userSelect: 'none',
                  pointerEvents: 'none',
              }}
            >
              How can I help you today?
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <IconButton variant="plain" color="neutral" sx={{ borderRadius: '50%' }}>
                  <AddIcon />
              </IconButton>
              
              <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      px: 1.5, 
                      py: 0.5, 
                      borderRadius: '1rem',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'background.level2' }
                  }}>
                      <Typography level="body-sm" sx={{ fontWeight: 500, color: 'text.secondary' }}>Sonnet 4.6</Typography>
                      <ChevronRightIcon sx={{ fontSize: '1rem', rotate: '90deg', color: 'text.tertiary' }} />
                  </Box>
                  <IconButton variant="plain" color="neutral" sx={{ borderRadius: '50%' }}>
                      <GraphicEqIcon />
                  </IconButton>
              </Stack>
            </Box>
          </Card>
        )}

      </Stack>

    </Box>
  );
}
