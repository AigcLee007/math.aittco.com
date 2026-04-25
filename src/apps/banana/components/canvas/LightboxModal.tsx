'use client';

import * as React from 'react';
import { Box, IconButton, Modal, ModalClose, Sheet } from '@mui/joy';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import { useCanvasStore } from './useCanvasStore';

import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';
import FormatPaintRoundedIcon from '@mui/icons-material/FormatPaintRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';

/**
 * 大图预览弹窗 (Lightbox)
 * 通过双击画布节点触发
 */
export function LightboxModal(props: {
  onRegenerate?: (prompt: string) => void;
  onUseAsReference?: (image: string) => void;
  onOpenHistory?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [currentNodeId, setCurrentNodeId] = React.useState<string | null>(null);
  const nodes = useCanvasStore(s => s.nodes);

  const currentNode = nodes.find(n => n.id === currentNodeId);
  const currentIndex = currentNode ? nodes.indexOf(currentNode) : -1;

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCurrentNodeId(detail.nodeId);
      setOpen(true);
    };
    window.addEventListener('canvas-lightbox', handler);
    return () => window.removeEventListener('canvas-lightbox', handler);
  }, []);

  const goPrev = () => {
    if (currentIndex > 0) setCurrentNodeId(nodes[currentIndex - 1].id);
  };

  const goNext = () => {
    if (currentIndex < nodes.length - 1) setCurrentNodeId(nodes[currentIndex + 1].id);
  };

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!currentNode) return null;

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Sheet
        variant="plain"
        sx={{
          position: 'relative',
          maxWidth: '92vw',
          maxHeight: '92vh',
          borderRadius: '1rem',
          overflow: 'hidden',
          boxShadow: '0 32px 64px rgba(0,0,0,0.3)',
          backgroundColor: 'transparent',
          outline: 'none',
        }}
      >
        <ModalClose
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 10,
            bgcolor: 'rgba(0,0,0,0.5)',
            color: '#fff',
            borderRadius: '50%',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        />

        <Box
          component="img"
          src={currentNode.image}
          alt={currentNode.prompt || 'preview'}
          sx={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            objectFit: 'contain',
            display: 'block',
          }}
        />

        {/* Nav buttons */}
        {currentIndex > 0 && (
          <IconButton
            onClick={goPrev}
            sx={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              borderRadius: '50%',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
            }}
          >
            <NavigateBeforeRoundedIcon />
          </IconButton>
        )}
        {currentIndex < nodes.length - 1 && (
          <IconButton
            onClick={goNext}
            sx={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              borderRadius: '50%',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
            }}
          >
            <NavigateNextRoundedIcon />
          </IconButton>
        )}

        {/* Counter */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 2,
            py: 0.5,
            borderRadius: '1rem',
            bgcolor: 'rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {currentIndex + 1} / {nodes.length}
        </Box>

        {/* Mobile Action Buttons */}
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            position: 'absolute',
            bottom: 48,
            left: 0,
            right: 0,
            justifyContent: 'center',
            gap: 2,
            padding: 2,
          }}
        >
          <IconButton onClick={() => {
              if (!currentNode.image) return;
              const a = document.createElement('a');
              a.href = currentNode.image;
              a.download = `banana-${currentNode.id}.png`;
              a.click();
          }} sx={{ borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>
             <DownloadRoundedIcon />
          </IconButton>
          {currentNode.prompt && (
            <IconButton onClick={() => {
              props.onRegenerate?.(currentNode.prompt!);
              setOpen(false);
            }} sx={{ borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>
               <AutorenewRoundedIcon />
            </IconButton>
          )}
          <IconButton onClick={() => {
             if (currentNode.image) props.onUseAsReference?.(currentNode.image);
             setOpen(false);
          }} sx={{ borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>
             <LayersRoundedIcon />
          </IconButton>
          <IconButton onClick={() => {
             props.onOpenHistory?.();
             setOpen(false);
          }} sx={{ borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>
             <HistoryRoundedIcon />
          </IconButton>
        </Box>
      </Sheet>
    </Modal>
  );
}
