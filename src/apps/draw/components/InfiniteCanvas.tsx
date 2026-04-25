import * as React from 'react';
import { Box } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

interface InfiniteCanvasProps {
  children?: React.ReactNode;
  sx?: SxProps;
}

export function InfiniteCanvas(props: InfiniteCanvasProps) {
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [lastPos, setLastPos] = React.useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left click or if target is the canvas itself
    if (e.button !== 0) return;
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <Box
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      sx={{
        position: 'absolute', // Cover full DrawCreate
        inset: 0,
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor: 'background.surface',
        // Dotted Grid Background
        backgroundImage: 'radial-gradient(circle, #E1E1E1 1.5px, transparent 1.5px)',
        backgroundSize: '32px 32px',
        backgroundPosition: `${offset.x}px ${offset.y}px`,
        ...props.sx,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
          width: '5000px', // Large enough for absolute positioning of cards
          height: '5000px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          alignContent: 'flex-start',
          p: 20, // Large initial padding
          gap: 4,
          pointerEvents: 'none',
          '& > *': {
            pointerEvents: 'auto',
          }
        }}
      >
        {props.children}
      </Box>
    </Box>
  );
}
