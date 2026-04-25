'use client';

import * as React from 'react';
import { Box, Divider, ListItemDecorator, MenuItem, MenuList, Typography } from '@mui/joy';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SmartDisplayRoundedIcon from '@mui/icons-material/SmartDisplayRounded';
import GroupWorkRoundedIcon from '@mui/icons-material/GroupWorkRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { useCanvasStore } from './useCanvasStore';
import type { ContextMenuState } from './canvasTypes';

interface CanvasContextMenuProps {
  onUseAsReference?: (image: string) => void;
  onRegenerate?: (prompt: string, model?: string) => void;
}

export function CanvasContextMenu({ onUseAsReference, onRegenerate }: CanvasContextMenuProps) {
  const [menu, setMenu] = React.useState<ContextMenuState | null>(null);
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const removeNodes = useCanvasStore((s) => s.removeNodes);
  const duplicateNodes = useCanvasStore((s) => s.duplicateNodes);
  const groupSelected = useCanvasStore((s) => s.groupSelected);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMenu(detail);
    };
    window.addEventListener('canvas-context-menu', handler);

    const close = () => setMenu(null);
    window.addEventListener('click', close);

    return () => {
      window.removeEventListener('canvas-context-menu', handler);
      window.removeEventListener('click', close);
    };
  }, []);

  if (!menu)
    return null;

  const targetNode = menu.nodeId ? nodes.find((n) => n.id === menu.nodeId) : null;
  const isVideoNode = Boolean(targetNode?.video);
  const ids = Array.from(selectedIds);
  const hasGroup = targetNode?.groupId != null;

  const handleDownload = () => {
    const fileUrl = targetNode?.video || targetNode?.image;
    if (!fileUrl)
      return;
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = `banana_${targetNode?.prompt?.slice(0, 20) || (isVideoNode ? 'video' : 'image')}_${Date.now()}.${isVideoNode ? 'mp4' : 'png'}`;
    a.click();
    setMenu(null);
  };

  const handleLightbox = () => {
    if (targetNode?.video) {
      window.open(targetNode.video, '_blank');
    } else if (targetNode?.image) {
      window.dispatchEvent(new CustomEvent('canvas-lightbox', { detail: { nodeId: targetNode.id, image: targetNode.image } }));
    }
    setMenu(null);
  };

  const handleCopyLink = async () => {
    const fileUrl = targetNode?.video || targetNode?.image;
    if (!fileUrl)
      return;
    try {
      await navigator.clipboard.writeText(fileUrl);
      setMenu(null);
    } catch {
      // ignore
    }
  };

  const handleDelete = () => {
    if (ids.length > 0)
      removeNodes(ids);
    setMenu(null);
  };

  const handleDuplicate = () => {
    if (ids.length > 0)
      duplicateNodes(ids);
    setMenu(null);
  };

  const handleUseAsRef = () => {
    if (targetNode?.image && onUseAsReference)
      onUseAsReference(targetNode.image);
    setMenu(null);
  };

  const handleRegenerate = () => {
    if (targetNode?.prompt && onRegenerate)
      onRegenerate(targetNode.prompt, targetNode.model);
    setMenu(null);
  };

  const handleGroup = () => {
    groupSelected();
    setMenu(null);
  };

  const handleUngroup = () => {
    ungroupSelected();
    setMenu(null);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        zIndex: 9999,
      }}
    >
      <MenuList
        variant="outlined"
        sx={{
          minWidth: 220,
          borderRadius: '0.75rem',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          backgroundColor: 'background.popup',
          border: '1px solid',
          borderColor: 'divider',
          p: 0.5,
          overflow: 'hidden',
        }}
      >
        {targetNode && (
          <>
            <MenuItem onClick={handleLightbox} sx={{ borderRadius: '0.5rem' }}>
              <ListItemDecorator>{isVideoNode ? <SmartDisplayRoundedIcon fontSize="small" /> : <ZoomInRoundedIcon fontSize="small" />}</ListItemDecorator>
              <Typography level="body-sm">{isVideoNode ? '播放视频' : '放大预览'}</Typography>
            </MenuItem>
            <MenuItem onClick={handleDownload} sx={{ borderRadius: '0.5rem' }}>
              <ListItemDecorator><DownloadRoundedIcon fontSize="small" /></ListItemDecorator>
              <Typography level="body-sm">{isVideoNode ? '下载视频' : '下载图片'}</Typography>
            </MenuItem>
            <MenuItem onClick={handleCopyLink} sx={{ borderRadius: '0.5rem' }}>
              <ListItemDecorator><LinkRoundedIcon fontSize="small" /></ListItemDecorator>
              <Typography level="body-sm">{isVideoNode ? '复制视频链接' : '复制链接'}</Typography>
            </MenuItem>
            {!isVideoNode && (
              <MenuItem onClick={handleUseAsRef} sx={{ borderRadius: '0.5rem' }}>
                <ListItemDecorator><ImageRoundedIcon fontSize="small" /></ListItemDecorator>
                <Typography level="body-sm">用作参考图</Typography>
              </MenuItem>
            )}
            {targetNode.prompt && (
              <MenuItem onClick={handleRegenerate} sx={{ borderRadius: '0.5rem' }}>
                <ListItemDecorator><ReplayRoundedIcon fontSize="small" /></ListItemDecorator>
                <Typography level="body-sm">重生</Typography>
              </MenuItem>
            )}
            <Divider sx={{ my: 0.5 }} />
          </>
        )}

        <MenuItem onClick={handleDuplicate} sx={{ borderRadius: '0.5rem' }}>
          <ListItemDecorator><ContentCopyRoundedIcon fontSize="small" /></ListItemDecorator>
          <Typography level="body-sm">复制节点</Typography>
          <Typography level="body-xs" sx={{ ml: 'auto', color: 'text.tertiary' }}>Ctrl+D</Typography>
        </MenuItem>

        {ids.length >= 2 && !hasGroup && (
          <MenuItem onClick={handleGroup} sx={{ borderRadius: '0.5rem' }}>
            <ListItemDecorator><GroupWorkRoundedIcon fontSize="small" /></ListItemDecorator>
            <Typography level="body-sm">分组</Typography>
            <Typography level="body-xs" sx={{ ml: 'auto', color: 'text.tertiary' }}>Ctrl+G</Typography>
          </MenuItem>
        )}

        {hasGroup && (
          <MenuItem onClick={handleUngroup} sx={{ borderRadius: '0.5rem' }}>
            <ListItemDecorator><GroupWorkRoundedIcon fontSize="small" /></ListItemDecorator>
            <Typography level="body-sm">取消分组</Typography>
          </MenuItem>
        )}

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handleDelete} sx={{ borderRadius: '0.5rem', color: 'danger.500' }}>
          <ListItemDecorator sx={{ color: 'danger.500' }}><DeleteOutlineRoundedIcon fontSize="small" /></ListItemDecorator>
          <Typography level="body-sm" color="danger">删除</Typography>
          <Typography level="body-xs" sx={{ ml: 'auto', color: 'text.tertiary' }}>Del</Typography>
        </MenuItem>
      </MenuList>
    </Box>
  );
}
