'use client';

import { useEffect } from 'react';
import { useCanvasStore } from './useCanvasStore';

/**
 * 生图画布快捷键
 * - V: 选择工具
 * - H / Space: 平移工具
 * - A: 自动整理
 * - F: 定位全部节点
 * - U: 上传参考图
 * - Ctrl+Alt+I: 图片逆推提示词
 * - Ctrl+Alt+P: 提示词优化
 * - Ctrl+Z / Ctrl+Shift+Z: 撤销 / 重做
 * - Delete / Backspace: 删除选中节点
 */
export function useCanvasShortcuts() {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const target = e.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target as HTMLElement | null)?.isContentEditable;
      if (isTyping)
        return;

      const store = useCanvasStore.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }

      if ((ctrl && key === 'y') || (ctrl && e.shiftKey && key === 'z')) {
        e.preventDefault();
        store.redo();
        return;
      }

      if (ctrl && key === 'a') {
        e.preventDefault();
        store.selectAll();
        return;
      }

      if (ctrl && e.altKey && key === 'i') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('banana-open-image-reverse'));
        return;
      }

      if (ctrl && e.altKey && key === 'p') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('banana-open-prompt-optimize'));
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        const ids = Array.from(store.selectedIds);
        if (ids.length > 0)
          store.removeNodes(ids);
        return;
      }

      if (key === 'escape') {
        store.deselectAll();
        return;
      }

      if (key === 'v') {
        e.preventDefault();
        store.setActiveTool('select');
        return;
      }

      if (key === 'h') {
        e.preventDefault();
        store.setActiveTool('pan');
        return;
      }

      if (key === 'a' && !ctrl && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        store.autoGridLayout();
        return;
      }

      if (key === 'f' && !ctrl && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        store.zoomToNodes();
        return;
      }

      if (key === 'u' && !ctrl && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('banana-nav-upload'));
      }
    };

    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
}
