import { create } from 'zustand';
import type { CanvasNode, CanvasGroup, CanvasSnapshot, CanvasViewport } from './canvasTypes';

const MAX_UNDO = 50;
const CANVAS_HEADER_HEIGHT = 64;
const CANVAS_HEADER_GAP = 10;
const CANVAS_TOP_PADDING = CANVAS_HEADER_HEIGHT + CANVAS_HEADER_GAP;
const CANVAS_MIN_LEFT_PADDING = 10;
const CANVAS_MIN_RIGHT_PADDING = 10;
const CANVAS_NODE_TO_LEFT_SIDEBAR_GAP = 10;
const CANVAS_NODE_TO_TOOLBAR_GAP = 10;
const CANVAS_TOOLBAR_HITBOX_BUFFER = 8;
const CANVAS_BOTTOM_PADDING = 48;
const GRID_GAP = 32;

function getCanvasLeftPadding(): number {
  if (typeof window === 'undefined')
    return CANVAS_MIN_LEFT_PADDING;

  const navEl = window.document.querySelector<HTMLElement>('#desktop-nav');
  const drawerEl = window.document.querySelector<HTMLElement>('[data-optima-piw="drawer"]');
  const rightEdges: number[] = [];
  if (navEl)
    rightEdges.push(navEl.getBoundingClientRect().right);
  if (drawerEl) {
    const rect = drawerEl.getBoundingClientRect();
    if (rect.width > 0)
      rightEdges.push(rect.right);
  }

  if (!rightEdges.length)
    return CANVAS_MIN_LEFT_PADDING;

  return Math.max(CANVAS_MIN_LEFT_PADDING, Math.round(Math.max(...rightEdges) + CANVAS_NODE_TO_LEFT_SIDEBAR_GAP));
}

function getCanvasRightPadding(): number {
  if (typeof window === 'undefined')
    return CANVAS_MIN_RIGHT_PADDING;

  // Prefer the real visible toolbar body (after transforms), then fallback to container.
  const toolbar = window.document.querySelector<HTMLElement>('[data-banana-canvas-toolbar-body="true"]')
    || window.document.querySelector<HTMLElement>('[data-banana-canvas-toolbar="true"]');
  if (!toolbar)
    return CANVAS_MIN_RIGHT_PADDING;

  const rect = toolbar.getBoundingClientRect();
  const dynamicPadding = window.innerWidth - rect.left + CANVAS_NODE_TO_TOOLBAR_GAP + CANVAS_TOOLBAR_HITBOX_BUFFER;
  return Math.max(CANVAS_MIN_RIGHT_PADDING, Math.round(dynamicPadding));
}

function getToolbarLeftPx(): number | null {
  if (typeof window === 'undefined')
    return null;
  const toolbar = window.document.querySelector<HTMLElement>('[data-banana-canvas-toolbar-body="true"]')
    || window.document.querySelector<HTMLElement>('[data-banana-canvas-toolbar="true"]');
  if (!toolbar)
    return null;
  return toolbar.getBoundingClientRect().left;
}

function normalizeModelId(modelId?: string): string {
  return (modelId || '').trim().replace(/^models\//i, '').toLowerCase();
}

const MAX_CANVAS_TASK_CONCURRENCY = 5;
let _runningCanvasTasks = 0;
const _queuedCanvasTasks: Array<() => Promise<void>> = [];

function syncCanvasQueueState() {
  if (typeof useCanvasStore === 'undefined')
    return;
  useCanvasStore.setState({
    queueRunning: _runningCanvasTasks,
    queuePending: _queuedCanvasTasks.length,
    globalIsGenerating: _runningCanvasTasks > 0 || _queuedCanvasTasks.length > 0,
  });
}

function _drainCanvasTaskQueue() {
  while (_runningCanvasTasks < MAX_CANVAS_TASK_CONCURRENCY && _queuedCanvasTasks.length) {
    const job = _queuedCanvasTasks.shift();
    if (!job)
      break;
    syncCanvasQueueState();
    void job();
  }
}

function enqueueCanvasTask<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = async () => {
      _runningCanvasTasks += 1;
      syncCanvasQueueState();
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        _runningCanvasTasks = Math.max(0, _runningCanvasTasks - 1);
        syncCanvasQueueState();
        _drainCanvasTaskQueue();
      }
    };
    _queuedCanvasTasks.push(run);
    syncCanvasQueueState();
    _drainCanvasTaskQueue();
  });
}

function hasPendingCanvasTasks(): boolean {
  return _runningCanvasTasks > 0 || _queuedCanvasTasks.length > 0;
}

interface CanvasStore {
  // State
  nodes: CanvasNode[];
  selectedIds: Set<string>;
  viewport: CanvasViewport;
  groups: CanvasGroup[];
  activeTool: 'select' | 'pan';

  // Undo/Redo
  undoStack: CanvasSnapshot[];
  redoStack: CanvasSnapshot[];

  // Actions - Snapshot
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Actions - Nodes
  addNode: (node: CanvasNode) => void;
  removeNodes: (ids: string[]) => void;
  updateNode: (id: string, patch: Partial<CanvasNode>) => void;
  moveNodes: (ids: string[], dx: number, dy: number) => void;
  duplicateNodes: (ids: string[]) => void;
  clearAll: () => void;

  // Actions - Selection
  selectNode: (id: string, additive?: boolean) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setSelectedIds: (ids: Set<string>) => void;

  // Actions - Viewport
  setViewport: (vp: Partial<CanvasViewport>) => void;
  resetViewport: () => void;
  setActiveTool: (tool: 'select' | 'pan') => void;

  // Actions - Groups
  groupSelected: () => void;
  ungroupSelected: () => void;

  // Actions - Layout
  autoGridLayout: (columns?: number) => void;
  zoomToNodes: () => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // Alignment
  alignNodes: (direction: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => void;
  distributeNodes: (axis: 'horizontal' | 'vertical') => void;

  // Global Task Dispatcher
  globalIsGenerating: boolean;
  globalGenerateProgress: number;
  queueRunning: number;
  queuePending: number;
  submitGenerateTask: (
      params: { prompt: string, model: string, routingModelId?: string, isVideoModel?: boolean, size?: string, resolution?: string, duration?: number, hd?: boolean, userId?: string, batchSize?: number, uploadedImages?: any[] },
      pushHistoryItem: (item: any) => void
  ) => void;
}

const createSnapshot = (nodes: CanvasNode[], groups: CanvasGroup[]): CanvasSnapshot => ({
  nodes: nodes.map(n => ({ ...n })),
  groups: groups.map(g => ({ ...g, nodeIds: [...g.nodeIds] })),
});

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  selectedIds: new Set<string>(),
  viewport: { x: 0, y: 0, zoom: 1 },
  groups: [],
  activeTool: 'select',
  undoStack: [],
  redoStack: [],
  globalIsGenerating: false,
  globalGenerateProgress: 0,
  queueRunning: 0,
  queuePending: 0,

  // --- Snapshot ---
  pushSnapshot: () => {
    const { nodes, groups, undoStack } = get();
    const snap = createSnapshot(nodes, groups);
    set({
      undoStack: [...undoStack.slice(-MAX_UNDO), snap],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, nodes, groups } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const currentSnap = createSnapshot(nodes, groups);
    set({
      nodes: prev.nodes,
      groups: prev.groups,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, currentSnap],
      selectedIds: new Set(),
    });
  },

  redo: () => {
    const { redoStack, nodes, groups } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const currentSnap = createSnapshot(nodes, groups);
    set({
      nodes: next.nodes,
      groups: next.groups,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, currentSnap],
      selectedIds: new Set(),
    });
  },

  // --- Nodes ---
  addNode: (node) => {
    get().pushSnapshot();
    set({ nodes: [...get().nodes, node] });
  },

  removeNodes: (ids) => {
    get().pushSnapshot();
    const idSet = new Set(ids);
    set({
      nodes: get().nodes.filter(n => !idSet.has(n.id)),
      selectedIds: new Set(),
    });
  },

  updateNode: (id, patch) => {
    set({
      nodes: get().nodes.map(n => n.id === id ? { ...n, ...patch } : n),
    });
  },

  moveNodes: (ids, dx, dy) => {
    const idSet = new Set(ids);
    set({
      nodes: get().nodes.map(n =>
        idSet.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
      ),
    });
  },

  duplicateNodes: (ids) => {
    get().pushSnapshot();
    const { nodes } = get();
    const toDup = nodes.filter(n => ids.includes(n.id));
    const newNodes = toDup.map(n => ({
      ...n,
      id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      x: n.x + 40,
      y: n.y + 40,
      groupId: undefined,
    }));
    const newIds = new Set(newNodes.map(n => n.id));
    set({
      nodes: [...nodes, ...newNodes],
      selectedIds: newIds,
    });
  },

  clearAll: () => {
    get().pushSnapshot();
    set({ nodes: [], selectedIds: new Set(), groups: [] });
  },

  // --- Selection ---
  selectNode: (id, additive = false) => {
    const { selectedIds, nodes, groups } = get();
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    // If node is in a group, select entire group
    if (node.groupId) {
      const group = groups.find(g => g.id === node.groupId);
      if (group) {
        if (additive) {
          const next = new Set(selectedIds);
          group.nodeIds.forEach(nid => next.add(nid));
          set({ selectedIds: next });
        } else {
          set({ selectedIds: new Set(group.nodeIds) });
        }
        return;
      }
    }

    if (additive) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      set({ selectedIds: next });
    } else {
      set({ selectedIds: new Set([id]) });
    }
  },

  selectAll: () => {
    set({ selectedIds: new Set(get().nodes.map(n => n.id)) });
  },

  deselectAll: () => {
    set({ selectedIds: new Set() });
  },

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  // --- Viewport ---
  setViewport: (vp) => set({ viewport: { ...get().viewport, ...vp } }),
  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),
  setActiveTool: (tool) => set({ activeTool: tool }),

  // --- Groups ---
  groupSelected: () => {
    const { selectedIds, groups, nodes } = get();
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    get().pushSnapshot();
    const groupId = `group-${Date.now()}`;
    const newGroup: CanvasGroup = { id: groupId, nodeIds: ids };
    set({
      groups: [...groups, newGroup],
      nodes: nodes.map(n => ids.includes(n.id) ? { ...n, groupId } : n),
    });
  },

  ungroupSelected: () => {
    const { selectedIds, groups, nodes } = get();
    const ids = Array.from(selectedIds);
    get().pushSnapshot();
    // Find groups that contain any selected node
    const groupsToRemove = new Set<string>();
    groups.forEach(g => {
      if (g.nodeIds.some(nid => ids.includes(nid))) {
        groupsToRemove.add(g.id);
      }
    });
    set({
      groups: groups.filter(g => !groupsToRemove.has(g.id)),
      nodes: nodes.map(n => groupsToRemove.has(n.groupId || '') ? { ...n, groupId: undefined } : n),
    });
  },

  // --- Layout ---
  autoGridLayout: (columns) => {
    get().pushSnapshot();
    const { nodes } = get();
    if (nodes.length === 0)
      return;

    const sorted = [...nodes].sort((a, b) => a.timestamp - b.timestamp);
    const { viewport } = get();
    const keepZoom = Math.max(0.2, viewport.zoom || 1);
    const leftPadding = getCanvasLeftPadding();
    const rightPadding = getCanvasRightPadding();
    const availableWidth = Math.max(320, (window.innerWidth - leftPadding - rightPadding) / keepZoom);
    const avgNodeWidth = sorted.reduce((sum, n) => sum + Math.max(120, n.width || 360), 0) / sorted.length;
    const autoColumns = Math.max(1, Math.floor((availableWidth + GRID_GAP) / (avgNodeWidth + GRID_GAP)));
    let targetColumns = Math.max(1, Math.min(sorted.length, typeof columns === 'number' && columns > 0 ? columns : autoColumns));
    // Avoid a trailing single item row (e.g. 4 items in 3+1), prefer a more balanced layout.
    if (targetColumns > 2 && sorted.length % targetColumns === 1) {
      targetColumns -= 1;
    }
    const minGap = 16;

    const canFitColumns = (cols: number): boolean => {
      for (let i = 0; i < sorted.length; i += cols) {
        const rowNodes = sorted.slice(i, i + cols);
        const rowTotalWidth = rowNodes.reduce((sum, n) => sum + Math.max(120, n.width || 360), 0);
        const rowNeedWidth = rowTotalWidth + Math.max(0, rowNodes.length - 1) * minGap;
        if (rowNeedWidth > availableWidth)
          return false;
      }
      return true;
    };

    while (targetColumns > 1 && !canFitColumns(targetColumns)) {
      targetColumns -= 1;
    }

    const rows: CanvasNode[][] = [];
    for (let i = 0; i < sorted.length; i += targetColumns) {
      rows.push(sorted.slice(i, i + targetColumns));
    }

    let currentY = 0;
    const updated: CanvasNode[] = [];

    for (const rowNodes of rows) {
      if (!rowNodes.length)
        continue;

      const rowTotalWidth = rowNodes.reduce((sum, n) => sum + Math.max(120, n.width || 360), 0);
      const gapCount = Math.max(0, rowNodes.length - 1);
      const distributedGap = gapCount > 0
        ? Math.max(minGap, (availableWidth - rowTotalWidth) / gapCount)
        : 0;

      let currentX = 0;
      let rowHeight = 0;
      rowNodes.forEach((n) => {
        const safeWidth = Math.max(120, n.width || 360);
        const safeHeight = Math.max(120, n.height || 360);

        updated.push({ ...n, x: currentX, y: currentY });
        currentX += safeWidth + distributedGap;
        rowHeight = Math.max(rowHeight, safeHeight);
      });

      currentY += rowHeight + GRID_GAP;
    }

    const normalized = updated;
    const minX = Math.min(...normalized.map(n => n.x));
    const minY = Math.min(...normalized.map(n => n.y));
    const y = CANVAS_TOP_PADDING - minY * keepZoom;
    let x = leftPadding - minX * keepZoom;

    // Final pixel-space hard guard: ensure right-most rendered image is always >=10px away from toolbar.
    const toolbarLeft = getToolbarLeftPx();
    if (toolbarLeft != null) {
      const maxScreenRight = Math.max(...normalized.map((n) => ((n.x + Math.max(120, n.width || 360)) * keepZoom) + x));
      const safeScreenRight = toolbarLeft - CANVAS_NODE_TO_TOOLBAR_GAP;
      if (maxScreenRight > safeScreenRight) {
        const overflow = maxScreenRight - safeScreenRight;
        x -= overflow;
      }
    }

    set({
      nodes: normalized,
      viewport: { ...viewport, x, y, zoom: keepZoom },
    });

    // Post-render hard guard (DOM measured): enforce BOTH left and right safe boundaries.
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const toolbar = window.document.querySelector<HTMLElement>('[data-banana-canvas-toolbar-body="true"]')
            || window.document.querySelector<HTMLElement>('[data-banana-canvas-toolbar="true"]');
          const nodeEls = Array.from(window.document.querySelectorAll<HTMLElement>('[data-banana-canvas-node="true"]'));
          if (!nodeEls.length)
            return;

          const maxNodeRight = Math.max(...nodeEls.map((el) => el.getBoundingClientRect().right));
          const minNodeLeft = Math.min(...nodeEls.map((el) => el.getBoundingClientRect().left));
          const toolbarLeft = toolbar?.getBoundingClientRect().left ?? window.innerWidth;
          const safeRight = toolbarLeft - CANVAS_NODE_TO_TOOLBAR_GAP;
          const safeLeft = getCanvasLeftPadding();

          // Shift interval for viewport.x in screen-space:
          // minNodeLeft + delta >= safeLeft  => delta >= safeLeft - minNodeLeft
          // maxNodeRight + delta <= safeRight => delta <= safeRight - maxNodeRight
          const minDelta = safeLeft - minNodeLeft;
          const maxDelta = safeRight - maxNodeRight;

          let delta = 0;
          if (minDelta <= maxDelta) {
            // Choose the smallest move that satisfies both.
            if (0 < minDelta) delta = minDelta;
            else if (0 > maxDelta) delta = maxDelta;
          } else {
            // Content wider than safe span; prefer preserving right safety, then left.
            delta = maxDelta;
            if (delta < minDelta) delta = minDelta;
          }

          if (Math.abs(delta) > 0.5) {
            const currentViewport = get().viewport;
            get().setViewport({ x: currentViewport.x + delta });
          }
        });
      });
    }
  },

  zoomToNodes: () => {
    const { nodes } = get();
    if (nodes.length === 0) return;

    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + n.width));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + n.height));
    
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const leftPadding = getCanvasLeftPadding();
    const rightPadding = getCanvasRightPadding();
    const availableWidth = Math.max(320, window.innerWidth - leftPadding - rightPadding);
    const availableHeight = Math.max(240, window.innerHeight - CANVAS_TOP_PADDING - CANVAS_BOTTOM_PADDING);

    const zoom = Math.min(1, availableWidth / contentW, availableHeight / contentH);
    const x = leftPadding + (availableWidth - contentW * zoom) / 2 - minX * zoom;
    const y = CANVAS_TOP_PADDING - minY * zoom;

    set({ 
      viewport: { x, y, zoom: Math.max(0.2, zoom) }
    });

    // Keep the same boundary behavior as autoGridLayout: enforce both left/right safe gaps after render.
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const toolbar = window.document.querySelector<HTMLElement>('[data-banana-canvas-toolbar-body="true"]')
            || window.document.querySelector<HTMLElement>('[data-banana-canvas-toolbar="true"]');
          const nodeEls = Array.from(window.document.querySelectorAll<HTMLElement>('[data-banana-canvas-node="true"]'));
          if (!nodeEls.length)
            return;

          const maxNodeRight = Math.max(...nodeEls.map((el) => el.getBoundingClientRect().right));
          const minNodeLeft = Math.min(...nodeEls.map((el) => el.getBoundingClientRect().left));
          const toolbarLeft = toolbar?.getBoundingClientRect().left ?? window.innerWidth;
          const safeRight = toolbarLeft - CANVAS_NODE_TO_TOOLBAR_GAP;
          const safeLeft = getCanvasLeftPadding();

          const minDelta = safeLeft - minNodeLeft;
          const maxDelta = safeRight - maxNodeRight;

          let delta = 0;
          if (minDelta <= maxDelta) {
            if (0 < minDelta) delta = minDelta;
            else if (0 > maxDelta) delta = maxDelta;
          } else {
            delta = maxDelta;
            if (delta < minDelta) delta = minDelta;
          }

          if (Math.abs(delta) > 0.5) {
            const currentViewport = get().viewport;
            get().setViewport({ x: currentViewport.x + delta });
          }
        });
      });
    }
  },

  zoomIn: () => {
    const { viewport } = get();
    const newZoom = Math.min(3, viewport.zoom + 0.2);
    set({ viewport: { ...viewport, zoom: newZoom } });
  },

  zoomOut: () => {
    const { viewport } = get();
    const newZoom = Math.max(0.1, viewport.zoom - 0.2);
    set({ viewport: { ...viewport, zoom: newZoom } });
  },

  // --- Alignment ---
  alignNodes: (direction) => {
    const { selectedIds, nodes } = get();
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    get().pushSnapshot();
    const selected = nodes.filter(n => ids.includes(n.id));

    let updated: CanvasNode[];
    switch (direction) {
      case 'left': {
        const minX = Math.min(...selected.map(n => n.x));
        updated = nodes.map(n => ids.includes(n.id) ? { ...n, x: minX } : n);
        break;
      }
      case 'right': {
        const maxRight = Math.max(...selected.map(n => n.x + n.width));
        updated = nodes.map(n => ids.includes(n.id) ? { ...n, x: maxRight - n.width } : n);
        break;
      }
      case 'center-h': {
        const minX = Math.min(...selected.map(n => n.x));
        const maxRight = Math.max(...selected.map(n => n.x + n.width));
        const centerX = (minX + maxRight) / 2;
        updated = nodes.map(n => ids.includes(n.id) ? { ...n, x: centerX - n.width / 2 } : n);
        break;
      }
      case 'top': {
        const minY = Math.min(...selected.map(n => n.y));
        updated = nodes.map(n => ids.includes(n.id) ? { ...n, y: minY } : n);
        break;
      }
      case 'bottom': {
        const maxBottom = Math.max(...selected.map(n => n.y + n.height));
        updated = nodes.map(n => ids.includes(n.id) ? { ...n, y: maxBottom - n.height } : n);
        break;
      }
      case 'center-v': {
        const minY = Math.min(...selected.map(n => n.y));
        const maxBottom = Math.max(...selected.map(n => n.y + n.height));
        const centerY = (minY + maxBottom) / 2;
        updated = nodes.map(n => ids.includes(n.id) ? { ...n, y: centerY - n.height / 2 } : n);
        break;
      }
      default:
        return;
    }
    set({ nodes: updated });
  },

  distributeNodes: (axis) => {
    const { selectedIds, nodes } = get();
    const ids = Array.from(selectedIds);
    if (ids.length < 3) return;
    get().pushSnapshot();
    const selected = nodes.filter(n => ids.includes(n.id));

    if (axis === 'horizontal') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = (last.x + last.width) - first.x;
      const totalNodeWidth = sorted.reduce((sum, n) => sum + n.width, 0);
      const gap = (totalSpan - totalNodeWidth) / (sorted.length - 1);
      let currentX = first.x;
      const posMap = new Map<string, number>();
      sorted.forEach(n => {
        posMap.set(n.id, currentX);
        currentX += n.width + gap;
      });
      set({ nodes: nodes.map(n => posMap.has(n.id) ? { ...n, x: posMap.get(n.id)! } : n) });
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = (last.y + last.height) - first.y;
      const totalNodeHeight = sorted.reduce((sum, n) => sum + n.height, 0);
      const gap = (totalSpan - totalNodeHeight) / (sorted.length - 1);
      let currentY = first.y;
      const posMap = new Map<string, number>();
      sorted.forEach(n => {
        posMap.set(n.id, currentY);
        currentY += n.height + gap;
      });
      set({ nodes: nodes.map(n => posMap.has(n.id) ? { ...n, y: posMap.get(n.id)! } : n) });
    }
  },

  // --- Global Generator Dispatcher ---
  submitGenerateTask: async (params, pushHistoryItem) => {
    syncCanvasQueueState();

    const batchSize = params.batchSize || 1;
    const { viewport, addNode, updateNode } = get();
    const routingModel = params.routingModelId || params.model;
    const modelId = normalizeModelId(routingModel);
    const isVideoModelById = modelId.includes('video')
      || modelId.includes('i2v')
      || modelId.startsWith('sora-')
      || modelId.startsWith('veo');
    const isVideoModel = Boolean(params.isVideoModel) || isVideoModelById;
    const isGrokModel = /^grok(?:[-_].+)?$/.test(modelId) || modelId.includes('grok-');
    const isGrokPairModel = isGrokModel && modelId !== 'grok-4.2-image';

    const { generateBananaImageStream, generateGrokImagePair, generateBananaVideoStream, isVideoModelId } = await import('../../banana.api');

    const viewW = window.innerWidth;
    const safeZoom = Math.max(0.1, viewport.zoom || 1);
    const GRID_START_X = 0;
    const GRID_START_Y = 0;
    const leftPadding = getCanvasLeftPadding();
    const GRID_FOCUS_PADDING_X = leftPadding;
    const GRID_FOCUS_PADDING_TOP = CANVAS_TOP_PADDING;
    const rightPadding = getCanvasRightPadding();

    const worldLayoutWidth = Math.max(720, (viewW - leftPadding - rightPadding) / safeZoom);
    const maxRowRight = GRID_START_X + worldLayoutWidth;

    let cursorX = GRID_START_X;
    let cursorY = GRID_START_Y;
    let currentRowHeight = 0;

    const placeNextNode = (width: number, height: number): { x: number; y: number } => {
      const safeWidth = Math.max(120, Math.round(width || 360));
      const safeHeight = Math.max(120, Math.round(height || 360));

      if (cursorX > GRID_START_X && cursorX + safeWidth > maxRowRight) {
        cursorX = GRID_START_X;
        cursorY += currentRowHeight + GRID_GAP;
        currentRowHeight = 0;
      }

      const position = { x: cursorX, y: cursorY };
      cursorX += safeWidth + GRID_GAP;
      currentRowHeight = Math.max(currentRowHeight, safeHeight);
      return position;
    };

    const existingNodes = [...get().nodes].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    existingNodes.forEach((node) => {
      placeNextNode(node.width || 360, node.height || 360);
    });

    const focusNodeTopLeft = (nodeX: number, nodeY: number) => {
      const newVpX = GRID_FOCUS_PADDING_X - nodeX * safeZoom;
      const newVpY = GRID_FOCUS_PADDING_TOP - nodeY * safeZoom;
      get().setViewport({ x: newVpX, y: newVpY });
    };

    const aspectParts = (params.size || '1:1').split(':');
    const arW = parseInt(aspectParts[0]) || 1;
    const arH = parseInt(aspectParts[1]) || 1;
    const nodeWidth = 360;
    const nodeHeight = Math.round(nodeWidth * (arH / arW));

    const finalizeGlobalBusy = () => {
      window.setTimeout(() => {
        if (!hasPendingCanvasTasks())
          set({ globalGenerateProgress: 0 });
        syncCanvasQueueState();
      }, 0);
    };

    if (!isVideoModel && isGrokPairModel) {
      const sharedTaskId = `pending-${Date.now()}`;
      const nodeIds = [0, 1].map(() => `node-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
      const nodePlacements = [placeNextNode(nodeWidth, nodeHeight), placeNextNode(nodeWidth, nodeHeight)];

      nodeIds.forEach((nodeId, i) => {
        const nodeX = nodePlacements[i]?.x ?? GRID_START_X;
        const nodeY = nodePlacements[i]?.y ?? GRID_START_Y;
        addNode({
          id: nodeId,
          x: nodeX,
          y: nodeY,
          width: nodeWidth,
          height: nodeHeight,
          prompt: params.prompt,
          model: routingModel,
          timestamp: Date.now(),
          taskId: sharedTaskId,
          aspectRatio: arW / arH,
          status: 'generating',
          progress: 5,
        });
        if (i === 0)
          focusNodeTopLeft(nodeX, nodeY);
      });

      void enqueueCanvasTask(async () => {
        try {
          const pairResult = await generateGrokImagePair({
            prompt: params.prompt,
            model: routingModel,
            routingModelId: routingModel,
            size: params.size || '1:1',
            resolution: params.resolution || '1K',
            userId: params.userId as string,
            images: params.uploadedImages?.map((img: any) => img.data) || [],
          }, (received, total) => {
            if (total <= 0)
              return;
            const progress = Math.min(99, Math.round((received / total) * 100));
            nodeIds.forEach((id) => updateNode(id, { progress }));
            set({ globalGenerateProgress: progress });
          }, (taskId) => {
            nodeIds.forEach((id) => updateNode(id, { taskId }));
          });

          nodeIds.forEach((id) => updateNode(id, { taskId: pairResult.taskId }));

          const firstUrl = pairResult.urls[0];
          const secondUrl = pairResult.urls[1];

          if (firstUrl) {
            updateNode(nodeIds[0], { image: firstUrl, status: 'completed', progress: 100 });
            pushHistoryItem({ image: firstUrl, timestamp: Date.now(), prompt: params.prompt, model: routingModel, taskId: pairResult.taskId });
          } else {
            updateNode(nodeIds[0], { status: 'error', error: '未返回有效图片' });
          }

          if (secondUrl && secondUrl !== firstUrl) {
            updateNode(nodeIds[1], { image: secondUrl, status: 'completed', progress: 100 });
            pushHistoryItem({ image: secondUrl, timestamp: Date.now(), prompt: params.prompt, model: routingModel, taskId: pairResult.taskId });
          } else {
            updateNode(nodeIds[1], { status: 'error', error: '仅返回1张图' });
          }
          set({ globalGenerateProgress: 100 });
        } catch (error: any) {
          console.error('Background Generation Error for grok pair nodes:', nodeIds, error);
          nodeIds.forEach((id) => updateNode(id, { status: 'error', error: error.message || '生成失败' }));
        } finally {
          finalizeGlobalBusy();
        }
      });
      return;
    }

    for (let i = 0; i < batchSize; i++) {
      const nodeId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const nextPosition = placeNextNode(nodeWidth, nodeHeight);
      const nodeX = nextPosition.x;
      const nodeY = nextPosition.y;

      addNode({
        id: nodeId,
        x: nodeX,
        y: nodeY,
        width: nodeWidth,
        height: nodeHeight,
        prompt: params.prompt,
        model: routingModel,
        timestamp: Date.now(),
        aspectRatio: arW / arH,
        status: 'generating',
        progress: 5,
      });

      if (i === 0)
        focusNodeTopLeft(nodeX, nodeY);

      void enqueueCanvasTask(async () => {
        try {
          if (isVideoModel || isVideoModelId(routingModel)) {
            const resultVideo = await generateBananaVideoStream({
              prompt: params.prompt,
              model: routingModel,
              size: params.size || '16:9',
              duration: Number((params as any).duration || 5),
              hd: Boolean((params as any).hd ?? true),
              images: params.uploadedImages?.map((img: any) => img.data) || [],
            }, (received: number, total: number) => {
              if (total > 0) {
                const progress = Math.min(99, Math.round((received / total) * 100));
                updateNode(nodeId, { progress });
                set({ globalGenerateProgress: progress });
              }
            }, (taskId: string) => {
              updateNode(nodeId, { taskId });
            });

            updateNode(nodeId, { video: resultVideo.videoUrl, videoPoster: resultVideo.posterUrl || undefined, status: 'completed', progress: 100 });
            pushHistoryItem({ video: resultVideo.videoUrl, videoPoster: resultVideo.posterUrl || undefined, timestamp: Date.now(), prompt: params.prompt, model: routingModel });
          } else {
            const resultImg = await generateBananaImageStream({
              prompt: params.prompt,
              model: routingModel,
              routingModelId: routingModel,
              size: params.size || '1:1',
              resolution: params.resolution || '1K',
              userId: params.userId as string,
              images: params.uploadedImages?.map((img: any) => img.data) || [],
            }, (received, total) => {
              if (total > 0) {
                const progress = Math.min(99, Math.round((received / total) * 100));
                updateNode(nodeId, { progress });
                set({ globalGenerateProgress: progress });
              }
            }, (taskId) => {
              updateNode(nodeId, { taskId });
            });

            updateNode(nodeId, { image: resultImg, status: 'completed', progress: 100 });
            pushHistoryItem({ image: resultImg, timestamp: Date.now(), prompt: params.prompt, model: routingModel });
          }
        } catch (error: any) {
          console.error('Background Generation Error for node:', nodeId, error);
          updateNode(nodeId, { status: 'error', error: error.message || '生成失败' });
        } finally {
          finalizeGlobalBusy();
        }
      });
    }
  }
}));
