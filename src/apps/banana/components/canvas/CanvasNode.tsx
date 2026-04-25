'use client';

import * as React from 'react';
import { Box, Typography } from '@mui/joy';
import { useCanvasStore } from './useCanvasStore';
import type { ResizeHandle } from './canvasTypes';
import { getNanoBananaCanvasModelLabel } from '../../nanoBananaLine1';

interface CanvasNodeProps {
  nodeId: string;
  zoom: number;
  activeTool?: 'select' | 'pan';
}

const HANDLE_SIZE = 10;
const RESIZE_HANDLES: { handle: ResizeHandle; cursor: string; style: React.CSSProperties }[] = [
  { handle: 'nw', cursor: 'nwse-resize', style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
  { handle: 'n', cursor: 'ns-resize', style: { top: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'ne', cursor: 'nesw-resize', style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
  { handle: 'e', cursor: 'ew-resize', style: { top: '50%', right: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' } },
  { handle: 'se', cursor: 'nwse-resize', style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
  { handle: 's', cursor: 'ns-resize', style: { bottom: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'sw', cursor: 'nesw-resize', style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
  { handle: 'w', cursor: 'ew-resize', style: { top: '50%', left: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' } },
];

export const CanvasNodeComponent = React.memo(function CanvasNodeComponent({ nodeId, zoom, activeTool = 'select' }: CanvasNodeProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId));
  const isSelected = useCanvasStore(s => s.selectedIds.has(nodeId));
  const selectNode = useCanvasStore(s => s.selectNode);
  const updateNode = useCanvasStore(s => s.updateNode);
  const moveNodes = useCanvasStore(s => s.moveNodes);
  const pushSnapshot = useCanvasStore(s => s.pushSnapshot);
  const selectedIds = useCanvasStore(s => s.selectedIds);
  const setActiveTool = useCanvasStore(s => s.setActiveTool);

  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const dragRef = React.useRef({ startX: 0, startY: 0 });
  const resizeRef = React.useRef({ handle: '' as ResizeHandle, startX: 0, startY: 0, origX: 0, origY: 0, origW: 0, origH: 0 });

  if (!node) return null;
  const displayModel = getNanoBananaCanvasModelLabel(node.model);

  // --- Drag Move ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (activeTool === 'pan') {
      setActiveTool('select');
      selectNode(nodeId, e.shiftKey || e.ctrlKey || e.metaKey);
      return;
    }

    // Select
    selectNode(nodeId, e.shiftKey || e.ctrlKey || e.metaKey);

    // Start drag
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    pushSnapshot();

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - dragRef.current.startX) / zoom;
      const dy = (ev.clientY - dragRef.current.startY) / zoom;
      dragRef.current = { startX: ev.clientX, startY: ev.clientY };

      // Move all selected nodes
      const ids = selectedIds.has(nodeId) ? Array.from(selectedIds) : [nodeId];
      moveNodes(ids, dx, dy);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // --- Resize ---
  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    pushSnapshot();
    resizeRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: node.x,
      origY: node.y,
      origW: node.width,
      origH: node.height,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      const ref = resizeRef.current;
      const dx = (ev.clientX - ref.startX) / zoom;
      const dy = (ev.clientY - ref.startY) / zoom;
      const aspect = Math.max(0.1, node.aspectRatio || (ref.origW / Math.max(1, ref.origH)));
      const minW = Math.max(80, 60 * aspect);
      const minH = minW / aspect;
      const isHorizontalOnly = ref.handle === 'e' || ref.handle === 'w';
      const isVerticalOnly = ref.handle === 'n' || ref.handle === 's';

      const widthFromHorizontal = ref.handle.includes('w') ? (ref.origW - dx) : (ref.origW + dx);
      const heightFromVertical = ref.handle.includes('n') ? (ref.origH - dy) : (ref.origH + dy);
      const widthFromVertical = heightFromVertical * aspect;
      let targetW = ref.origW;

      if (isHorizontalOnly) {
        targetW = widthFromHorizontal;
      } else if (isVerticalOnly) {
        targetW = widthFromVertical;
      } else {
        const horizontalDelta = Math.abs(widthFromHorizontal - ref.origW);
        const verticalDelta = Math.abs(widthFromVertical - ref.origW);
        targetW = horizontalDelta >= verticalDelta ? widthFromHorizontal : widthFromVertical;
      }

      const newW = Math.max(minW, targetW);
      const newH = Math.max(minH, newW / aspect);
      let newX = ref.origX;
      let newY = ref.origY;

      if (ref.handle.includes('w'))
        newX = ref.origX + (ref.origW - newW);
      else if (isVerticalOnly)
        newX = ref.origX + (ref.origW - newW) / 2;

      if (ref.handle.includes('n'))
        newY = ref.origY + (ref.origH - newH);
      else if (isHorizontalOnly)
        newY = ref.origY + (ref.origH - newH) / 2;

      updateNode(nodeId, { x: newX, y: newY, width: newW, height: newH, aspectRatio: aspect });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // --- Double Click for Lightbox ---
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Dispatch custom event for lightbox
    window.dispatchEvent(new CustomEvent('canvas-lightbox', { detail: { nodeId, image: node.image } }));
  };

  return (
    <Box
      data-banana-canvas-node='true'
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        selectNode(nodeId, false);
        window.dispatchEvent(new CustomEvent('canvas-context-menu', {
          detail: { x: e.clientX, y: e.clientY, nodeId },
        }));
      }}
      sx={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        cursor: activeTool === 'pan' ? 'inherit' : (isDragging ? 'grabbing' : 'grab'),
        borderRadius: '12px',
        overflow: 'visible',
        userSelect: 'none',
        pointerEvents: 'auto',
        outline: isSelected ? '2.5px solid' : '1px solid',
        outlineColor: isSelected ? 'primary.500' : 'transparent',
        outlineOffset: isSelected ? '3px' : '0px',
        boxShadow: isSelected
          ? '0 0 0 1px rgba(59,130,246,0.3), 0 8px 32px rgba(0,0,0,0.15)'
          : '0 4px 16px rgba(0,0,0,0.1)',
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s, outline 0.15s',
        '&:hover': {
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          outlineColor: isSelected ? 'primary.500' : 'neutral.outlinedBorder',
        },
        zIndex: isDragging ? 1000 : isSelected ? 100 : 1,
      }}
    >
      {/* === Content based on status === */}
      {node.status === 'generating' ? (
        /* --- Generating: placeholder with progress --- */
        <Box sx={{
          width: '100%', height: '100%', borderRadius: '12px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1.5, p: 2, boxSizing: 'border-box',
        }}>
          {/* Spinning icon */}
          <Box sx={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.15)',
            borderTopColor: '#7c3aed',
            animation: 'spin 1s linear infinite',
            '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
          }} />

          {/* Model name */}
          <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 600 }}>
            {displayModel || '生成中...'}
          </Typography>

          {/* Progress bar */}
          <Box sx={{ width: '80%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <Box sx={{
              height: '100%', borderRadius: 3,
              background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
              width: `${node.progress || 0}%`,
              transition: 'width 0.5s ease-out',
            }} />
          </Box>

          {/* Progress text */}
          <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
            {node.progress ? `${node.progress}%` : '准备中...'}
          </Typography>

          {/* Prompt preview */}
          {node.prompt && (
            <Typography level="body-xs" sx={{
              color: 'rgba(255,255,255,0.35)', fontSize: '10px', maxWidth: '90%',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
            }}>
              {node.prompt}
            </Typography>
          )}
        </Box>
      ) : node.status === 'error' ? (
        /* --- Error: red panel with message --- */
        <Box sx={{
          width: '100%', height: '100%', borderRadius: '12px',
          background: 'linear-gradient(135deg, #2d1b1b 0%, #3d1f1f 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1.5, p: 2, boxSizing: 'border-box',
        }}>
          {/* Error icon */}
          <Typography sx={{ fontSize: '32px' }}>⚠️</Typography>

          <Typography level="body-xs" sx={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>
            生成失败
          </Typography>

          {/* Error detail */}
          <Typography level="body-xs" sx={{
            color: 'rgba(255,255,255,0.5)', fontSize: '10px', maxWidth: '90%',
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            textAlign: 'center', wordBreak: 'break-all',
          }}>
            {node.error || '未知错误'}
          </Typography>
        </Box>
      ) : (
        /* --- Completed / default: image --- */
        <>
          {node.video ? (
            <Box
              component="video"
              src={node.video}
              poster={node.videoPoster}
              controls
              preload='metadata'
              playsInline
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '12px',
                pointerEvents: 'auto',
                backgroundColor: '#000',
              }}
            />
          ) : (
            <Box
              component="img"
              src={node.image}
              alt={node.prompt || 'canvas image'}
              draggable={false}
              sx={{
                width: '100%', height: '100%', objectFit: 'cover',
                borderRadius: '12px', pointerEvents: 'none',
              }}
            />
          )}

          {/* Enhanced Info Overlay on Hover */}
          <Box className="node-hover-info" sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, p: 1.5,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
            borderRadius: '0 0 12px 12px', opacity: 0, transition: 'all 0.3s ease',
            display: 'flex', flexDirection: 'column', gap: 0.5,
            transform: 'translateY(10px)',
            '.MuiBox-root:hover > &': { opacity: 1, transform: 'translateY(0)' },
          }}>
            {/* Meta Row: Time & Model */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 600 }}>
                {new Date(node.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', bgcolor: 'rgba(255,255,255,0.1)', px: 0.8, py: 0.2, borderRadius: '4px' }}>
                {displayModel || 'Unknown'}
              </Typography>
            </Box>

            {/* Prompt Detail */}
            {node.prompt && (
              <Typography level="body-xs" sx={{
                color: '#fff', fontSize: '11px', fontWeight: 500,
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', lineHeight: 1.4, mt: 0.5
              }}>
                {node.prompt}
              </Typography>
            )}
          </Box>
        </>
      )}

      {/* Resize handles (only when selected) */}
      {isSelected && RESIZE_HANDLES.map(({ handle, cursor, style }) => (
        <Box
          key={handle}
          onMouseDown={(e) => handleResizeStart(e, handle)}
          sx={{
            position: 'absolute',
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            backgroundColor: '#fff',
            border: '2px solid',
            borderColor: 'primary.500',
            borderRadius: '50%',
            cursor,
            zIndex: 10,
            ...style,
          }}
        />
      ))}
    </Box>
  );
});
