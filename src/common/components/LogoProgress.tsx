import * as React from 'react';

import { Box, CircularProgress } from '@mui/joy';
import FunctionsIcon from '@mui/icons-material/Functions';


/**
 * 64x64 logo with a circular progress indicator around it
 */
export function LogoProgress(props: { showProgress: boolean }) {
  return <Box sx={{
    width: 64,
    height: 64,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <Box sx={{ position: 'absolute', mb: 0.5 }}>
      <FunctionsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
    </Box>
    {props.showProgress && <CircularProgress size='lg' sx={{ position: 'absolute' }} />}
  </Box>;
}