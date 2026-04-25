'use client';

import * as React from 'react';
import { Box, IconButton, Tooltip, Divider } from '@mui/joy';
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignHorizontalCenterIcon from '@mui/icons-material/AlignHorizontalCenter';
import AlignHorizontalRightIcon from '@mui/icons-material/AlignHorizontalRight';
import AlignVerticalTopIcon from '@mui/icons-material/AlignVerticalTop';
import AlignVerticalCenterIcon from '@mui/icons-material/AlignVerticalCenter';
import AlignVerticalBottomIcon from '@mui/icons-material/AlignVerticalBottom';
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useCanvasStore } from './useCanvasStore';

/**
 * 多选时浮动在画布上方的对齐工具栏
 */
export function AlignmentToolbar() {
  const selectedIds = useCanvasStore(s => s.selectedIds);
  const alignNodes = useCanvasStore(s => s.alignNodes);
  const distributeNodes = useCanvasStore(s => s.distributeNodes);
  const autoGridLayout = useCanvasStore(s => s.autoGridLayout);
  const duplicateNodes = useCanvasStore(s => s.duplicateNodes);
  const removeNodes = useCanvasStore(s => s.removeNodes);

  const count = selectedIds.size;
  if (count < 2) return null;

  const ids = Array.from(selectedIds);

  const btnSx = {
    borderRadius: '0.5rem',
    minWidth: 36,
    minHeight: 36,
    color: 'text.secondary',
    '&:hover': { bgcolor: 'neutral.softHoverBg', color: 'text.primary' },
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: '5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 0.75,
        borderRadius: '1rem',
        backgroundColor: 'background.popup',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)',
        border: '1px solid',
        borderColor: 'divider',
        zIndex: 200,
        backdropFilter: 'blur(12px)',
        userSelect: 'none',
      }}
    >
      {/* Align buttons */}
      <Tooltip title="左对齐" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => alignNodes('left')}><AlignHorizontalLeftIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="水平居中" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => alignNodes('center-h')}><AlignHorizontalCenterIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="右对齐" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => alignNodes('right')}><AlignHorizontalRightIcon fontSize="small" /></IconButton></Tooltip>

      <Divider orientation="vertical" sx={{ mx: 0.5, height: 20 }} />

      <Tooltip title="顶部对齐" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => alignNodes('top')}><AlignVerticalTopIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="垂直居中" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => alignNodes('center-v')}><AlignVerticalCenterIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="底部对齐" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => alignNodes('bottom')}><AlignVerticalBottomIcon fontSize="small" /></IconButton></Tooltip>

      {count >= 3 && (
        <>
          <Divider orientation="vertical" sx={{ mx: 0.5, height: 20 }} />
          <Tooltip title="水平等距" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => distributeNodes('horizontal')}><ViewColumnRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="垂直等距" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => distributeNodes('vertical')}><TableRowsRoundedIcon fontSize="small" /></IconButton></Tooltip>
        </>
      )}

      <Divider orientation="vertical" sx={{ mx: 0.5, height: 20 }} />

      <Tooltip title="自动整理" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => autoGridLayout()}><GridViewRoundedIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="复制" size="sm"><IconButton size="sm" variant="plain" sx={btnSx} onClick={() => duplicateNodes(ids)}><ContentCopyRoundedIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="删除" size="sm"><IconButton size="sm" variant="plain" sx={{ ...btnSx, '&:hover': { color: 'danger.500', bgcolor: 'danger.softBg' } }} onClick={() => removeNodes(ids)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>

      {/* Count badge */}
      <Box sx={{ ml: 0.5, px: 1, py: 0.25, borderRadius: '0.5rem', bgcolor: 'primary.softBg', color: 'primary.plainColor', fontSize: '0.75rem', fontWeight: 700 }}>
        {count} 选中
      </Box>
    </Box>
  );
}
