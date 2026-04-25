import * as React from 'react';
import { Box, IconButton, Sheet, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { useArtifactsStore } from '~/common/stores/artifacts/store-artifacts';
import { RenderCodeMemo } from '~/modules/blocks/code/RenderCode';

export function ArtifactPane() {
  const activeArtifact = useArtifactsStore(state => state.activeArtifact);
  const closeArtifact = useArtifactsStore(state => state.closeArtifact);

  if (!activeArtifact) return null;

  const { title, type, content } = activeArtifact;

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: 'background.surface',
    }}>
      {/* Header */}
      <Sheet sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        p: 1, borderBottom: '1px solid', borderColor: 'divider',
        backgroundColor: 'background.popup',
      }}>
        <Typography level='title-md' sx={{ ml: 1 }} className='agi-ellipsize'>
          {title}
        </Typography>
        <IconButton variant='plain' color='neutral' size='sm' onClick={closeArtifact}>
          <CloseRoundedIcon />
        </IconButton>
      </Sheet>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <RenderCodeMemo
          semiStableId={'artifact-preview'}
          title={title}
          code={content}
          isPartial={false}
          fitScreen={true}
          initialShowHTML={true}
          renderHideTitle={true} // we already have the title in the header
          sx={{
            m: 0,
            border: 'none',
            borderRadius: 0,
            minHeight: '100%',
          }}
        />
      </Box>
    </Box>
  );
}
