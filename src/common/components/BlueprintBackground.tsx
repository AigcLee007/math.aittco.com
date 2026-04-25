import * as React from 'react';
import { Box, Typography, useColorScheme } from '@mui/joy';

export function BlueprintBackground() {
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: isDark
          ? 'linear-gradient(135deg, #04070F 0%, #0A1220 100%)'
          : 'linear-gradient(135deg, #F0F4F8 0%, #FFFFFF 100%)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          opacity: isDark ? 0.15 : 0.4,
          backgroundImage: isDark ? `
            linear-gradient(#1E3A5F 1px, transparent 1px),
            linear-gradient(90deg, #1E3A5F 1px, transparent 1px),
            linear-gradient(#1E3A5F 0.5px, transparent 0.5px),
            linear-gradient(90deg, #1E3A5F 0.5px, transparent 0.5px)
          ` : `
            linear-gradient(#DDE7EE 1px, transparent 1px),
            linear-gradient(90deg, #DDE7EE 1px, transparent 1px),
            linear-gradient(#DDE7EE 0.5px, transparent 0.5px),
            linear-gradient(90deg, #DDE7EE 0.5px, transparent 0.5px)
          `,
          backgroundSize: '50px 50px, 50px 50px, 10px 10px, 10px 10px',
        },
        '&::after': {
          content: '"e^{i\\\\pi} + 1 = 0    \\\\int_{-\\\\infty}^{\\\\infty} e^{-x^2} dx = \\\\sqrt{\\\\pi}    \\\\nabla \\\\times \\\\mathbf{B} = \\\\mu_0 \\\\mathbf{J}"',
          position: 'absolute',
          top: '10%',
          left: '5%',
          fontSize: '4rem',
          fontFamily: 'serif',
          color: isDark ? '#1E3A5F' : '#DDE7EE',
          opacity: isDark ? 0.03 : 0.15,
          whiteSpace: 'pre',
          fontStyle: 'italic',
          display: { xs: 'none', md: 'block' },
        },
        '& > .blueprint-label': {
          position: 'absolute',
          top: '6rem',
          right: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          opacity: isDark ? 0.2 : 0.5,
          color: isDark ? '#5089BA' : '#8AABBD',
          pointerEvents: 'none',
          '& .title': {
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '0.2rem',
            textTransform: 'uppercase',
            fontFamily: '"Inter", sans-serif',
            mb: 0.5,
          },
          '& .subtitle': {
            fontSize: '0.7rem',
            letterSpacing: '0.3rem',
            opacity: 0.8,
            fontWeight: 500,
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            right: '-1rem',
            top: '10%',
            height: '80%',
            width: '2px',
            backgroundColor: 'currentColor',
            opacity: 0.6,
          },
        },
      }}
    >
      <Box className='blueprint-label'>
        <Typography component='span' className='title'>
          数模工作台
        </Typography>
        <Typography component='span' className='subtitle'>
          MATH WORKBENCH · AI WORKSPACE
        </Typography>
      </Box>
    </Box>
  );
}
