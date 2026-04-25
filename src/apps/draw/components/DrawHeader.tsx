import * as React from 'react';
import { Box, Typography } from '@mui/joy';
import ShuffleRoundedIcon from '@mui/icons-material/ShuffleRounded';
import SettingsInputComponentRoundedIcon from '@mui/icons-material/SettingsInputComponentRounded';
import LayoutRoundedIcon from '@mui/icons-material/DashboardRounded';
import { DarkModeToggleButton } from '~/common/components/DarkModeToggleButton';

export function DrawHeader() {
  const [tab, setTab] = React.useState<'Inspiration' | 'Your Creations'>('Inspiration');

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
        px: 4,
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Left Empty for balance or could have a minor logo */}
      <Box sx={{ width: 100 }} />

      {/* Center Tabs */}
      <Box sx={{ display: 'flex', gap: 4 }}>
        {['Inspiration', 'Your Creations'].map((t) => (
          <Box
            key={t}
            onClick={() => setTab(t as any)}
            sx={{
              cursor: 'pointer',
              position: 'relative',
              pb: 1,
            }}
          >
            <Typography
              level="title-md"
              sx={{
                fontWeight: 600,
                color: tab === t ? 'text.primary' : 'text.tertiary',
                transition: 'color 0.2s',
              }}
            >
              {t}
            </Typography>
            {tab === t && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -8,
                  left: 0,
                  right: 0,
                  height: 3,
                  backgroundColor: 'primary.main',
                  borderRadius: '2px',
                }}
              />
            )}
          </Box>
        ))}
      </Box>

      {/* Right Icons */}
      <Box sx={{ display: 'flex', gap: 1.5, color: 'text.tertiary', alignItems: 'center' }}>
        <DarkModeToggleButton />
        <ShuffleRoundedIcon sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' } }} />
        <LayoutRoundedIcon sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' } }} />
        <SettingsInputComponentRoundedIcon sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' } }} />
      </Box>
    </Box>
  );
}
