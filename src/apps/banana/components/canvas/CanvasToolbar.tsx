'use client';

import * as React from 'react';
import { Box, Button, Divider, IconButton, Modal, ModalDialog, Tooltip, Typography } from '@mui/joy';

import OpenWithRoundedIcon from '@mui/icons-material/OpenWithRounded';
import NearMeRoundedIcon from '@mui/icons-material/NearMeRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import ImageSearchRoundedIcon from '@mui/icons-material/ImageSearchRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';

import { useCanvasStore } from './useCanvasStore';

export type CanvasTool = 'select' | 'pan';

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onUpload: () => void;
  onOpenImageReverse: () => void;
  onOpenHistory: () => void;
}

export function CanvasToolbar({ activeTool, onToolChange, onUpload, onOpenImageReverse, onOpenHistory }: CanvasToolbarProps) {
  const undo = useCanvasStore(s => s.undo);
  const redo = useCanvasStore(s => s.redo);
  const undoStack = useCanvasStore(s => s.undoStack);
  const redoStack = useCanvasStore(s => s.redoStack);
  const autoGridLayout = useCanvasStore(s => s.autoGridLayout);
  const clearAll = useCanvasStore(s => s.clearAll);
  const selectedIds = useCanvasStore(s => s.selectedIds);
  const nodes = useCanvasStore(s => s.nodes);
  const zoomToNodes = useCanvasStore(s => s.zoomToNodes);
  const zoomIn = useCanvasStore(s => s.zoomIn);
  const zoomOut = useCanvasStore(s => s.zoomOut);
  const [showMoreTools, setShowMoreTools] = React.useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = React.useState(false);

  const handleClearAll = () => {
    if (nodes.length === 0)
      return;
    setIsClearConfirmOpen(true);
  };

  const handleBatchDownload = () => {
    window.dispatchEvent(new CustomEvent('canvas-batch-download'));
  };

  const btnSx = (isActive?: boolean) => ({
    borderRadius: '12px',
    width: 38,
    height: 38,
    color: isActive ? 'primary.plainColor' : 'text.secondary',
    bgcolor: isActive ? 'primary.softBg' : 'transparent',
    transition: 'background-color 0.16s ease, color 0.16s ease',
    '&:hover': {
      bgcolor: isActive ? 'primary.softHoverBg' : 'background.level2',
      color: 'text.primary',
      boxShadow: 'none',
      transform: 'none',
    },
  });

  return (
    <>
      <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        height: 'auto',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'transparent',
        '&::-webkit-scrollbar': { width: 0 },
        pt: 0,
        pb: 0.5,
        px: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 56,
          gap: 0.5,
          p: 0.75,
          borderRadius: '14px',
          bgcolor: 'background.surface',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}
      >
        <Tooltip title='选择工具 (V)' placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx(activeTool === 'select')} onClick={() => onToolChange('select')}>
            <NearMeRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>

        <Tooltip title='平移工具（Space+拖拽）' placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx(activeTool === 'pan')} onClick={() => onToolChange('pan')}>
            <OpenWithRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>

        <Tooltip title='图片逆推提示词 (Ctrl+Alt+I，消耗3🪙)' placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx()} onClick={onOpenImageReverse}>
            <ImageSearchRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>

        <Tooltip title='打开历史记录' placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx()} onClick={onOpenHistory}>
            <HistoryRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: '72%', my: 0.25, opacity: 0.6 }} />

        <Tooltip title={`撤销 (Ctrl+Z)${undoStack.length === 0 ? '，无可撤销' : ''}`} placement='right' size='sm'>
          <span>
            <IconButton variant='plain' size='sm' sx={btnSx()} disabled={undoStack.length === 0} onClick={undo}>
              <UndoRoundedIcon fontSize='small' />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={`重做 (Ctrl+Y)${redoStack.length === 0 ? '，无可重做' : ''}`} placement='right' size='sm'>
          <span>
            <IconButton variant='plain' size='sm' sx={btnSx()} disabled={redoStack.length === 0} onClick={redo}>
              <RedoRoundedIcon fontSize='small' />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title='一键网格排版整理 (A)' placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx()} onClick={() => autoGridLayout()}>
            <GridViewRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: '72%', my: 0.25, opacity: 0.6 }} />

        <Tooltip title='定位所有节点 (F)' placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx()} onClick={() => zoomToNodes()}>
            <MyLocationRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>

        <Tooltip title='缩小画布' placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx()} onClick={() => zoomOut()}>
            <ZoomOutRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>

        <Tooltip title='放大画布' placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx()} onClick={() => zoomIn()}>
            <ZoomInRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>

        <Divider sx={{ width: '72%', my: 0.25, opacity: 0.6 }} />

        <Tooltip title='上传图片到画布 (U，支持拖拽)' placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx()} onClick={onUpload}>
            <FileUploadRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>

        {showMoreTools && (
          <>
            <Tooltip title='打包下载全部选中项' placement='right' size='sm'>
              <span>
                <IconButton variant='plain' size='sm' sx={btnSx()} disabled={selectedIds.size === 0} onClick={handleBatchDownload}>
                  <DownloadRoundedIcon fontSize='small' />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title='清空画布 (Ctrl+Shift+Del)' placement='right' size='sm'>
              <span>
                <IconButton
                  variant='plain'
                  size='sm'
                  disabled={nodes.length === 0}
                  sx={{
                    ...btnSx(),
                    '&:hover': { color: 'danger.500', bgcolor: 'danger.softBg' },
                  }}
                  onClick={handleClearAll}
                >
                  <DeleteOutlineRoundedIcon fontSize='small' color='error' />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}

        <Divider sx={{ width: '72%', my: 0.25, opacity: 0.6 }} />

        <Tooltip title={showMoreTools ? '收起更多工具' : '更多工具'} placement='right' size='sm'>
          <IconButton variant='plain' size='sm' sx={btnSx()} onClick={() => setShowMoreTools((v) => !v)}>
            <MoreHorizRoundedIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </Box>
      </Box>
      <Modal open={isClearConfirmOpen} onClose={() => setIsClearConfirmOpen(false)}>
        <ModalDialog
          size='md'
          sx={{
            borderRadius: '14px',
            minWidth: 320,
            maxWidth: 'calc(100vw - 2rem)',
            p: 2,
          }}
        >
          <Typography level='title-md'>清空画布</Typography>
          <Typography level='body-sm' sx={{ color: 'text.tertiary' }}>
            确定要清空画布上的所有内容吗？此操作可通过 Ctrl+Z 撤销。
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
            <Button variant='plain' color='neutral' onClick={() => setIsClearConfirmOpen(false)}>
              取消
            </Button>
            <Button
              color='danger'
              onClick={() => {
                clearAll();
                setIsClearConfirmOpen(false);
              }}
            >
              确认清空
            </Button>
          </Box>
        </ModalDialog>
      </Modal>
    </>
  );
}
