'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import { useCanvasStore } from './canvas/useCanvasStore';
import { CanvasNodeComponent } from './canvas/CanvasNode';
import type { SelectionBox } from './canvas/canvasTypes';

type CanvasTool = 'select' | 'pan';

interface InfiniteCanvasProps {
  children?: React.ReactNode;
  activeTool?: CanvasTool;
}

export function InfiniteCanvas({ activeTool }: InfiniteCanvasProps) {
  const globalActiveTool = useCanvasStore(s => s.activeTool);
  const effectiveTool = activeTool ?? globalActiveTool;
  const viewport = useCanvasStore(s => s.viewport);
  const setViewport = useCanvasStore(s => s.setViewport);
  const nodes = useCanvasStore(s => s.nodes);
  const deselectAll = useCanvasStore(s => s.deselectAll);
  const setSelectedIds = useCanvasStore(s => s.setSelectedIds);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = React.useState(false);
  const [spaceDown, setSpaceDown] = React.useState(false);
  const panRef = React.useRef({ startX: 0, startY: 0 });

  // Marquee selection
  const [marquee, setMarquee] = React.useState<SelectionBox | null>(null);
  const marqueeRef = React.useRef<SelectionBox | null>(null);

  // --- Space key tracking ---
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // --- Wheel zoom ---
  const handleWheel = React.useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const { x, y, zoom } = useCanvasStore.getState().viewport;
      const newZoom = Math.min(3, Math.max(0.1, zoom * zoomFactor));
      // Zoom towards cursor
      const newX = mouseX - (mouseX - x) * (newZoom / zoom);
      const newY = mouseY - (mouseY - y) * (newZoom / zoom);
      setViewport({ x: newX, y: newY, zoom: newZoom });
    } else {
      // Pan
      const { x, y } = useCanvasStore.getState().viewport;
      setViewport({ x: x - e.deltaX, y: y - e.deltaY });
    }
  }, [setViewport]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (el) el.addEventListener('wheel', handleWheel, { passive: false });
    return () => { if (el) el.removeEventListener('wheel', handleWheel); };
  }, [handleWheel]);

  // --- Mouse down on canvas background ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    if (spaceDown || effectiveTool === 'pan') {
      // Pan mode
      setIsPanning(true);
      panRef.current = { startX: e.clientX, startY: e.clientY };
      return;
    }

    // Start marquee selection
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const canvasY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    if (!e.shiftKey && !e.ctrlKey) deselectAll();

    const box: SelectionBox = { startX: canvasX, startY: canvasY, endX: canvasX, endY: canvasY };
    setMarquee(box);
    marqueeRef.current = box;

    const handleMouseMove = (ev: MouseEvent) => {
      const cx = (ev.clientX - rect.left - viewport.x) / viewport.zoom;
      const cy = (ev.clientY - rect.top - viewport.y) / viewport.zoom;
      const updated = { ...marqueeRef.current!, endX: cx, endY: cy };
      marqueeRef.current = updated;
      setMarquee({ ...updated });

      // Compute selected nodes
      const minX = Math.min(updated.startX, updated.endX);
      const maxX = Math.max(updated.startX, updated.endX);
      const minY = Math.min(updated.startY, updated.endY);
      const maxY = Math.max(updated.startY, updated.endY);

      const { nodes: allNodes } = useCanvasStore.getState();
      const hits = new Set<string>();
      allNodes.forEach(n => {
        const nodeRight = n.x + n.width;
        const nodeBottom = n.y + n.height;
        if (n.x < maxX && nodeRight > minX && n.y < maxY && nodeBottom > minY) {
          hits.add(n.id);
        }
      });
      setSelectedIds(hits);
    };

    const handleMouseUp = () => {
      setMarquee(null);
      marqueeRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // --- Pan mousemove ---
  React.useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      panRef.current = { startX: e.clientX, startY: e.clientY };
      const { x, y } = useCanvasStore.getState().viewport;
      setViewport({ x: x + dx, y: y + dy });
    };

    const handleMouseUp = () => setIsPanning(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, setViewport]);

  // --- File drop ---
  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dropX = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const dropY = (e.clientY - rect.top - viewport.y) / viewport.zoom;

    Array.from(files).forEach((file, i) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          const w = 320;
          const h = w / ratio;
          useCanvasStore.getState().addNode({
            id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            x: dropX + i * 40,
            y: dropY + i * 40,
            width: w,
            height: h,
            image: data,
            timestamp: Date.now(),
            aspectRatio: ratio,
          });
        };
        img.src = data;
      };
      reader.readAsDataURL(file);
    });
  }, [viewport]);

  // Marquee rectangle in screen coordinates
  const marqueeStyle = React.useMemo(() => {
    if (!marquee) return null;
    const minX = Math.min(marquee.startX, marquee.endX);
    const maxX = Math.max(marquee.startX, marquee.endX);
    const minY = Math.min(marquee.startY, marquee.endY);
    const maxY = Math.max(marquee.startY, marquee.endY);
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }, [marquee]);

  return (
    <Box
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="infinite-canvas-container"
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: (spaceDown || effectiveTool === 'pan') ? (isPanning ? 'grabbing' : 'grab') : 'default',
        backgroundColor: 'background.surface',
        backgroundImage: (theme) =>
          `radial-gradient(circle, ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#E1E1E1'} 1.5px, transparent 1.5px)`,
        backgroundSize: `${32 * viewport.zoom}px ${32 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        userSelect: 'none',
      }}
    >
      {/* Canvas world layer */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
          width: 0,
          height: 0,
        }}
      >
        {/* Render all nodes */}
        {nodes.map(node => (
          <CanvasNodeComponent key={node.id} nodeId={node.id} zoom={viewport.zoom} activeTool={effectiveTool} />
        ))}

        {/* Marquee selection box */}
        {marqueeStyle && (
          <Box
            sx={{
              position: 'absolute',
              left: marqueeStyle.left,
              top: marqueeStyle.top,
              width: marqueeStyle.width,
              height: marqueeStyle.height,
              border: '1.5px dashed',
              borderColor: 'primary.400',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              borderRadius: '4px',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>

    </Box>
  );
}
