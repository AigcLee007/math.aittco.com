// Canvas Node & State Types for Banana Studio

export interface CanvasNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  image?: string;          // base64 data URI or URL (optional during generation)
  video?: string;          // video URL
  videoPoster?: string;    // video poster/thumbnail URL
  prompt?: string;
  model?: string;
  timestamp: number;
  taskId?: string;
  groupId?: string;
  locked?: boolean;
  aspectRatio?: number;   // original aspect ratio
  status?: 'generating' | 'completed' | 'error';  // node lifecycle status
  progress?: number;      // generation progress 0-100
  error?: string;         // error message if generation failed
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasGroup {
  id: string;
  nodeIds: string[];
  label?: string;
}

// History snapshot for undo/redo
export interface CanvasSnapshot {
  nodes: CanvasNode[];
  groups: CanvasGroup[];
}

// Selection box for marquee selection
export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// Context menu state
export interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
}

// Resize handle directions
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
