'use client';

import { useEffect } from 'react';
import { useCanvasStore } from './useCanvasStore';

/**
 * 批量下载画布上所有图片为单个 ZIP（不依赖 JSZip，逐张下载）
 * 监听 'canvas-batch-download' 自定义事件
 */
export function useCanvasExport() {
  useEffect(() => {
    const handler = async () => {
      const { nodes } = useCanvasStore.getState();
      if (nodes.length === 0) return;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node.image)
          continue;
        const a = document.createElement('a');
        a.href = node.image;
        a.download = `banana_${(node.prompt || 'image').slice(0, 20).replace(/\s+/g, '_')}_${i + 1}.png`;
        a.click();
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    window.addEventListener('canvas-batch-download', handler);
    return () => window.removeEventListener('canvas-batch-download', handler);
  }, []);
}
