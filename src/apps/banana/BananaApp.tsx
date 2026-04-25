'use client';

import React, { useState, useEffect } from 'react';
import './BananaApp.css';
import { isVideoModelId, pollBananaTaskById, pollGrokTaskPairById, pollVideoTaskById, VIDEO_MODELS } from './banana.api';
import { apiQuery } from '~/common/util/trpc.client';

// Components
import { BananaHeader, type BananaModelOption } from './components/BananaHeader';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { BananaPromptBar } from './components/BananaPromptBar';
import { RecentGallery } from './components/RecentGallery';
import { Box, IconButton, Modal, ModalClose, ModalDialog, Snackbar, Tooltip, Typography } from '@mui/joy';
import { ImageReversePromptModal } from './components/ImageReversePromptModal';

// Icons
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import PanToolRoundedIcon from '@mui/icons-material/PanToolRounded';
import MouseRoundedIcon from '@mui/icons-material/MouseRounded';
import { useRouter } from 'next/router';
import { useIsMobile } from '~/common/components/useMatchMedia';

// Canvas system
import { useCanvasStore } from './components/canvas/useCanvasStore';
import { useCanvasShortcuts } from './components/canvas/useCanvasShortcuts';
import { AlignmentToolbar } from './components/canvas/AlignmentToolbar';
import { CanvasContextMenu } from './components/canvas/CanvasContextMenu';
import { LightboxModal } from './components/canvas/LightboxModal';

import { CanvasToolbar } from './components/canvas/CanvasToolbar';
import { useCanvasExport } from './components/canvas/useCanvasExport';
import {
  getNanoBananaDisplayLabel,
} from './nanoBananaLine1';
import type { CanvasNode } from './components/canvas/canvasTypes';

type StudioCategory = 'IMAGE' | 'VIDEO';
type StudioModelOption = BananaModelOption & {
  category?: StudioCategory;
  familyLabel?: string;
  lineLabel?: string;
};

function normalizeModelId(modelId: string): string {
  return modelId.trim().replace(/^models\//, '').toLowerCase();
}

const IMAGE_MODEL_DEFAULT_ID = 'gemini-3-pro-image-preview';
const PENDING_NODES_STORAGE_KEY = 'banana_studio_pending_nodes';

function isGrokPairModel(modelId?: string): boolean {
  const normalized = normalizeModelId(modelId || '');
  if (!normalized)
    return false;
  const isGrokModel = /^grok(?:[-_].+)?$/.test(normalized) || normalized.includes('grok-');
  return isGrokModel && normalized !== 'grok-4.2-image';
}

function isVideoFirstLastModel(modelId?: string): boolean {
  const normalized = normalizeModelId(modelId || '');
  return normalized === 'veo3.1-fast'
    || normalized === 'veo3.1'
    || normalized === 'veo3.1-pro';
}

function isVideoMultiRefModel(modelId?: string): boolean {
  const normalized = normalizeModelId(modelId || '');
  return normalized === 'veo3.1-components'
    || normalized === 'grok-video-3';
}

function getVideoUploadLimit(modelId?: string): number {
  if (isVideoFirstLastModel(modelId))
    return 2;
  if (isVideoMultiRefModel(modelId))
    return 3;
  return 3;
}

function isLikelyVideoModel(modelId?: string): boolean {
  const normalized = normalizeModelId(modelId || '');
  if (!normalized)
    return false;
  return isVideoModelId(normalized)
    || normalized.includes('video')
    || normalized.includes('i2v')
    || normalized.startsWith('veo')
    || normalized.startsWith('sora-');
}

function splitModelFamilyAndLine(modelName?: string): { familyLabel?: string; lineLabel?: string } {
  const source = String(modelName || '').trim();
  if (!source)
    return {};
  const match = source.match(/^(.*?)\s*[(\uFF08]([^()\uFF08\uFF09]+)[)\uFF09]\s*$/u);
  if (!match)
    return {};
  const familyLabel = match[1]?.trim();
  const lineLabel = match[2]?.trim();
  if (!familyLabel || !lineLabel)
    return {};
  return { familyLabel, lineLabel };
}

function inferModelFamilyAndLine(modelId: string, modelName?: string): { familyLabel?: string; lineLabel?: string } {
  const parsed = splitModelFamilyAndLine(modelName);
  if (parsed.familyLabel && parsed.lineLabel)
    return parsed;

  const normalized = normalizeModelId(modelId);
  if (normalized === 'gemini-3-pro-image-preview')
    return { familyLabel: 'Nano Banana Pro', lineLabel: '\u7EBF\u8DEF\u4E00' };
  if (normalized === 'nano-banana-2')
    return { familyLabel: 'Nano Banana Pro', lineLabel: '\u7EBF\u8DEF\u4E8C' };
  if (normalized === 'gemini-3.1-flash-image-preview')
    return { familyLabel: 'Nano Banana 2', lineLabel: '\u7EBF\u8DEF\u4E00' };

  return {};
}

function toFamilyVirtualId(category: StudioCategory, familyLabel: string): string {
  return `family:${category}:${familyLabel.trim().toLowerCase()}`;
}

function getImageModelDescription(modelId: string): string {
  const id = normalizeModelId(modelId);
  const descriptions: Record<string, string> = {
    'gemini-3-pro-image-preview': '高质量生图旗舰，细节表现与画面一致性更强，适合商业海报与精细创作。',
    'nano-banana-2': '备用线路版本，适合在主线路繁忙时继续完成高质量生图任务。',
    'nano-banana-2-vip': 'VIP 应急高配线路，适合常规模型不可用时快速顶替生产任务。',
    'gemini-3.1-flash-image-preview': '速度与质量均衡，适合多数日常设计与内容配图场景。',
    'gemini-3.1-flash-image-preview-vip': 'VIP 应急备用模型，适合在故障期间承接常规出图需求。',
    'gemini-2.5-flash-image': '轻量快速，适合草图探索、风格尝试与高频出图。',
    'grok-4.2-image': 'xAI 生图模型，风格表达鲜明，适合创意概念图与视觉风格化生成。',
  };
  return descriptions[id] || '通用生图模型，适合多场景图像生成。';
}

function getImageModelIcon(modelId: string): string {
  const id = normalizeModelId(modelId);
  if (id.includes('grok'))
    return '/logo/grok-icon.svg';
  return '/logo/google-gemini-icon.svg';
}

const FALLBACK_IMAGE_MODELS: StudioModelOption[] = [
  {
    id: 'gemini-3-pro-image-preview',
    label: getNanoBananaDisplayLabel('gemini-3-pro-image-preview', 'Nano Banana Pro（线路一）'),
    description: getImageModelDescription('gemini-3-pro-image-preview'),
    coinCost: 12,
    iconSrc: getImageModelIcon('gemini-3-pro-image-preview'),
    category: 'IMAGE',
    familyLabel: 'Nano Banana Pro',
    lineLabel: '线路一',
  },
  {
    id: 'nano-banana-2',
    label: getNanoBananaDisplayLabel('nano-banana-2', 'Nano Banana Pro（线路二）'),
    description: getImageModelDescription('nano-banana-2'),
    coinCost: 12,
    iconSrc: getImageModelIcon('nano-banana-2'),
    category: 'IMAGE',
    familyLabel: 'Nano Banana Pro',
    lineLabel: '线路二',
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: getNanoBananaDisplayLabel('gemini-3.1-flash-image-preview', 'Nano Banana 2（线路一）'),
    description: getImageModelDescription('gemini-3.1-flash-image-preview'),
    coinCost: 6,
    iconSrc: getImageModelIcon('gemini-3.1-flash-image-preview'),
    category: 'IMAGE',
    familyLabel: 'Nano Banana 2',
    lineLabel: '线路一',
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    description: getImageModelDescription('gemini-2.5-flash-image'),
    coinCost: 3,
    iconSrc: getImageModelIcon('gemini-2.5-flash-image'),
    category: 'IMAGE',
  },
  {
    id: 'grok-4.2-image',
    label: 'Grok-4.2-Image',
    description: getImageModelDescription('grok-4.2-image'),
    coinCost: 8,
    iconSrc: getImageModelIcon('grok-4.2-image'),
    category: 'IMAGE',
  },
];

const FALLBACK_VIDEO_MODELS: StudioModelOption[] = VIDEO_MODELS.map((item) => ({
  id: item.id,
  label: item.name,
  description:
    item.id === 'veo3.1-components' || item.id === 'grok-video-3'
      ? '视频生成模型，提交后异步返回视频结果，多图参考（1-3图）。'
      : '视频生成模型，提交后异步返回视频结果，首尾帧（1-2图）。',
  coinCost: item.price,
  iconSrc: item.id === 'grok-video-3' ? '/logo/grok-icon.svg' : '/logo/google-gemini-icon.svg',
  category: 'VIDEO',
}));

export const BananaApp: React.FC = () => {
  // --- States ---
  const router = useRouter();
  const isMobile = useIsMobile();
  const queuePending = useCanvasStore(s => s.nodes.filter(n => n.status === 'generating').length);
  const zoom = useCanvasStore(s => s.viewport.zoom);

  const [settings, setSettings] = useState<any>({
    prompt: '',
    model: IMAGE_MODEL_DEFAULT_ID,
    line: '',
    size: '1:1',
    resolution: '1K',
    duration: 5,
    hd: true,
    batchSize: 1,
    uploadedImages: []
  });

  const globalIsGenerating = useCanvasStore(s => s.globalIsGenerating);
  const queueRunning = useCanvasStore(s => s.queueRunning);
  const canvasNodes = useCanvasStore(s => s.nodes);
  const [history, setHistory] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [isBarCollapsed, setIsBarCollapsed] = useState(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const activeTool = useCanvasStore(s => s.activeTool);
  const setActiveTool = useCanvasStore(s => s.setActiveTool);
  const canvasUploadInputRef = React.useRef<HTMLInputElement>(null);
  const showNotice = React.useCallback((message: string) => {
    setNoticeMessage(message);
  }, []);
  const { data: studioModelData } = (apiQuery.coin.getGenerateModels as any).useQuery(undefined, {
    staleTime: 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const studioModelMap = React.useMemo(() => {
    const map = new Map<string, StudioModelOption>();
    const serverModels: StudioModelOption[] = Array.isArray(studioModelData)
      ? studioModelData.map((item: any) => ({
          id: item.modelId,
          label: getNanoBananaDisplayLabel(item.modelId, item.modelName || item.modelId),
          description: getImageModelDescription(item.modelId),
          coinCost: item.coinCost,
          iconSrc: getImageModelIcon(item.modelId),
          priceByResolution: item.priceByResolution,
          category: item.category === 'VIDEO' ? 'VIDEO' : 'IMAGE',
          ...inferModelFamilyAndLine(item.modelId, item.modelName || item.modelId),
        }))
      : [];
    for (const model of [...serverModels, ...FALLBACK_IMAGE_MODELS, ...FALLBACK_VIDEO_MODELS])
      map.set(normalizeModelId(model.id), model);
    return map;
  }, [studioModelData]);

  const lineFamilies = React.useMemo(() => {
    const map = new Map<string, { familyLabel: string; category: StudioCategory; lines: StudioModelOption[] }>();
    for (const model of studioModelMap.values()) {
      if (!model.familyLabel || !model.lineLabel || !model.category)
        continue;
      const familyId = toFamilyVirtualId(model.category, model.familyLabel);
      const bucket = map.get(familyId) || { familyLabel: model.familyLabel, category: model.category, lines: [] };
      bucket.lines.push(model);
      map.set(familyId, bucket);
    }
    for (const [, bucket] of map) {
      bucket.lines.sort((a, b) => (a.coinCost ?? 9999) - (b.coinCost ?? 9999));
    }
    return map;
  }, [studioModelMap]);

  const imageModels = React.useMemo<BananaModelOption[]>(() => {
    const consumedModelIds = new Set<string>();
    const models: BananaModelOption[] = [];

    for (const [familyId, family] of lineFamilies.entries()) {
      if (family.lines.length < 2)
        continue;
      const first = family.lines[0];
      family.lines.forEach((line) => consumedModelIds.add(normalizeModelId(line.id)));
      models.push({
        id: familyId,
        label: family.familyLabel,
        description: `支持${family.lines.map((line) => line.lineLabel).filter(Boolean).join(' / ')}，可在输入栏切换线路。`,
        coinCost: first.coinCost,
        iconSrc: first.iconSrc || getImageModelIcon(first.id),
        priceByResolution: first.priceByResolution,
        category: family.category,
      });
    }

    for (const model of studioModelMap.values()) {
      const normalizedId = normalizeModelId(model.id);
      if (consumedModelIds.has(normalizedId))
        continue;
      models.push({
        id: model.id,
        label: getNanoBananaDisplayLabel(model.id, model.label),
        description: isVideoModelId(model.id) ? (model.description || '视频生成模型') : getImageModelDescription(model.id),
        coinCost: model.coinCost,
        iconSrc: model.iconSrc || getImageModelIcon(model.id),
        priceByResolution: model.priceByResolution,
        category: model.category,
      });
    }

    return models;
  }, [lineFamilies, studioModelMap]);

  const activeFamily = React.useMemo(() => lineFamilies.get(settings.model), [lineFamilies, settings.model]);

  const resolvedRoutingModelId = React.useMemo(() => {
    if (!activeFamily)
      return settings.model;
    const matchedLine = activeFamily.lines.find((line) => normalizeModelId(line.id) === normalizeModelId(settings.line));
    return (matchedLine || activeFamily.lines[0])?.id || settings.model;
  }, [activeFamily, settings.model, settings.line]);
  const resolvedModelMeta = React.useMemo(
    () => studioModelMap.get(normalizeModelId(resolvedRoutingModelId)),
    [studioModelMap, resolvedRoutingModelId],
  );
  const isResolvedVideoModel = (resolvedModelMeta?.category === 'VIDEO') || isVideoModelId(resolvedRoutingModelId);

  const estimatedCoins = React.useMemo(() => {
    const target = studioModelMap.get(normalizeModelId(resolvedRoutingModelId));
    if (!target)
      return null;
    if (isResolvedVideoModel) {
      const unit = typeof target.coinCost === 'number' ? target.coinCost : null;
      if (typeof unit !== 'number')
        return null;
      return unit;
    }
    const resolutionKey = (settings.resolution || '1K').toUpperCase() as '1K' | '2K' | '4K';
    const unit = target.priceByResolution?.[resolutionKey];
    const unitCost = typeof unit === 'number' ? unit : (target.coinCost ?? null);
    if (typeof unitCost !== 'number')
      return null;
    const batch = Math.max(1, Number(settings.batchSize) || 1);
    return unitCost * batch;
  }, [studioModelMap, resolvedRoutingModelId, settings.resolution, settings.batchSize, isResolvedVideoModel]);

  const isLineFamily = Boolean(activeFamily && activeFamily.lines.length > 1);

  const lineOptions = React.useMemo(() => {
    if (!activeFamily)
      return [];
    return activeFamily.lines.map((lineModel) => ({
      value: lineModel.id,
      label: lineModel.lineLabel || lineModel.label,
      disabled: false,
    }));
  }, [activeFamily]);

  useEffect(() => {
    if (!isLineFamily)
      return;
    if (!lineOptions.some((option) => option.value === settings.line && !option.disabled)) {
      setSettings((prev: any) => ({ ...prev, line: lineOptions[0]?.value || '' }));
    }
  }, [isLineFamily, lineOptions, settings.line]);

  useEffect(() => {
    if (!isResolvedVideoModel)
      return;
    if (settings.size !== '16:9' && settings.size !== '9:16') {
      setSettings((prev: any) => ({
        ...prev,
        size: '16:9',
      }));
    }
  }, [isResolvedVideoModel, resolvedRoutingModelId, settings.size]);

  const videoReferenceMode = React.useMemo<'first-last' | 'multi' | null>(() => {
    if (!isResolvedVideoModel)
      return null;
    if (isVideoFirstLastModel(resolvedRoutingModelId))
      return 'first-last';
    return 'multi';
  }, [isResolvedVideoModel, resolvedRoutingModelId]);

  useEffect(() => {
    if (!isResolvedVideoModel)
      return;
    const limit = getVideoUploadLimit(resolvedRoutingModelId);
    const current = settings.uploadedImages || [];
    if (current.length > limit) {
      setSettings((prev: any) => ({
        ...prev,
        uploadedImages: (prev.uploadedImages || []).slice(0, limit),
      }));
      showNotice(
        videoReferenceMode === 'first-last'
          ? '当前模型仅支持首尾帧 2 张图，已自动保留前 2 张。'
          : `当前模型最多支持 ${limit} 张参考图，已自动保留前 ${limit} 张。`,
      );
    }
  }, [isResolvedVideoModel, resolvedRoutingModelId, settings.uploadedImages, showNotice, videoReferenceMode]);

  // Enable keyboard shortcuts & export
  useCanvasShortcuts();
  useCanvasExport();

  // --- Load Data ---
  useEffect(() => {
    const savedSettings = localStorage.getItem('banana_studio_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings((prev: any) => ({
          ...prev,
          ...parsed,
          size: parsed?.size === 'Auto' ? '1:1' : (parsed?.size || prev.size),
          model: parsed?.model || prev.model,
          line: parsed?.line || '',
          uploadedImages: [],
        }));
      } catch (e) { /* skip */ }
    }

    const savedHistory = localStorage.getItem('banana_studio_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
          // Also load history items as canvas nodes (auto-layout)
          parsed.forEach((item: any, i: number) => {
            if (item.image) {
              useCanvasStore.getState().addNode({
                id: `node-hist-${item.timestamp || i}`,
                x: 10 + (i % 4) * 360,
                y: 80 + Math.floor(i / 4) * 400,
                width: 320,
                height: 320,
                image: item.image,
                prompt: item.prompt,
                model: item.model,
                timestamp: item.timestamp || Date.now(),
              });
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }

    const pendingRaw = localStorage.getItem(PENDING_NODES_STORAGE_KEY);
    if (pendingRaw) {
      try {
        const parsedPending = JSON.parse(pendingRaw);
        if (Array.isArray(parsedPending) && parsedPending.length > 0) {
          const store = useCanvasStore.getState();
          const existingIds = new Set(store.nodes.map((node) => node.id));
          const pendingNodes: CanvasNode[] = parsedPending
            .filter((item: any) => item && typeof item.id === 'string' && typeof item.taskId === 'string')
            .map((item: any) => ({
              id: String(item.id),
              x: Number(item.x) || 0,
              y: Number(item.y) || 0,
              width: Number(item.width) || 360,
              height: Number(item.height) || 360,
              prompt: item.prompt ? String(item.prompt) : '',
              model: item.model ? String(item.model) : '',
              timestamp: Number(item.timestamp) || Date.now(),
              taskId: String(item.taskId),
              aspectRatio: typeof item.aspectRatio === 'number' ? item.aspectRatio : undefined,
              status: 'generating',
              progress: typeof item.progress === 'number' ? Math.max(1, Math.min(99, item.progress)) : 10,
            }));

          for (const pendingNode of pendingNodes) {
            if (!existingIds.has(pendingNode.id))
              store.addNode(pendingNode);
          }

          const groupedByTaskId = new Map<string, CanvasNode[]>();
          for (const pendingNode of pendingNodes) {
            const taskId = pendingNode.taskId || '';
            if (!taskId)
              continue;
            const bucket = groupedByTaskId.get(taskId) || [];
            bucket.push(pendingNode);
            groupedByTaskId.set(taskId, bucket);
          }

          void (async () => {
            for (const [taskId, taskNodes] of groupedByTaskId.entries()) {
              const primaryNode = taskNodes[0];
              if (!primaryNode?.model)
                continue;

              try {
                if (taskNodes.length >= 2 && isGrokPairModel(primaryNode.model)) {
                  const pairResult = await pollGrokTaskPairById(taskId, primaryNode.model, (received, total) => {
                    if (total <= 0)
                      return;
                    const progress = Math.min(99, Math.round((received / total) * 100));
                    taskNodes.forEach((node) => useCanvasStore.getState().updateNode(node.id, { progress }));
                  });

                  const firstUrl = pairResult.urls[0];
                  const secondUrl = pairResult.urls[1];

                  if (firstUrl) {
                    useCanvasStore.getState().updateNode(taskNodes[0].id, {
                      image: firstUrl,
                      status: 'completed',
                      progress: 100,
                    });
                    setHistory((prev: any[]) => [{
                      image: firstUrl,
                      timestamp: Date.now(),
                      prompt: taskNodes[0].prompt || '',
                      model: taskNodes[0].model || '',
                      taskId: pairResult.taskId,
                    }, ...prev]);
                  } else {
                    useCanvasStore.getState().updateNode(taskNodes[0].id, {
                      status: 'error',
                      error: '未返回有效图片',
                    });
                  }

                  if (taskNodes[1]) {
                    if (secondUrl && secondUrl !== firstUrl) {
                      useCanvasStore.getState().updateNode(taskNodes[1].id, {
                        image: secondUrl,
                        status: 'completed',
                        progress: 100,
                      });
                      setHistory((prev: any[]) => [{
                        image: secondUrl,
                        timestamp: Date.now(),
                        prompt: taskNodes[1].prompt || '',
                        model: taskNodes[1].model || '',
                        taskId: pairResult.taskId,
                      }, ...prev]);
                    } else {
                      useCanvasStore.getState().updateNode(taskNodes[1].id, {
                        status: 'error',
                        error: '仅返回1张图',
                      });
                    }
                  }
                } else {
                  const poller = isLikelyVideoModel(primaryNode.model || '') ? pollVideoTaskById : pollBananaTaskById;
                  const result = await poller(taskId, (received: number, total: number) => {
                    if (total <= 0)
                      return;
                    const progress = Math.min(99, Math.round((received / total) * 100));
                    taskNodes.forEach((node) => useCanvasStore.getState().updateNode(node.id, { progress }));
                  });
                  const resolvedVideoResult = typeof result === 'string'
                    ? { videoUrl: result, posterUrl: undefined }
                    : result;
                  const resolvedImageResult = typeof result === 'string' ? result : '';

                  useCanvasStore.getState().updateNode(primaryNode.id, {
                    ...(isLikelyVideoModel(primaryNode.model || '')
                      ? { video: resolvedVideoResult.videoUrl, videoPoster: resolvedVideoResult.posterUrl || undefined }
                      : { image: resolvedImageResult }),
                    status: 'completed',
                    progress: 100,
                  });
                  setHistory((prev: any[]) => [{
                    ...(isLikelyVideoModel(primaryNode.model || '')
                      ? { video: resolvedVideoResult.videoUrl, videoPoster: resolvedVideoResult.posterUrl || undefined }
                      : { image: resolvedImageResult }),
                    timestamp: Date.now(),
                    prompt: primaryNode.prompt || '',
                    model: primaryNode.model || '',
                    taskId,
                  }, ...prev]);
                }
              } catch (error: any) {
                taskNodes.forEach((node) => {
                  useCanvasStore.getState().updateNode(node.id, {
                    status: 'error',
                    error: error?.message || '任务恢复失败',
                  });
                });
              }
            }
          })();
        }
      } catch (e) {
        console.error('Failed to parse pending nodes', e);
        localStorage.removeItem(PENDING_NODES_STORAGE_KEY);
      }
    }

    let storedUserId = localStorage.getItem('banana_userId');
    if (!storedUserId) {
      storedUserId = `u-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('banana_userId', storedUserId);
    }
    setUserId(storedUserId);

    // Sync API Key from global setting - REMOVED: Users use coins now
  }, []);

  useEffect(() => {
    const onShortcutUpload = () => canvasUploadInputRef.current?.click();
    const onOpenReverse = () => setIsReverseModalOpen(true);
    const onOpenHistory = () => setIsHistoryModalOpen(true);
    window.addEventListener('banana-nav-upload', onShortcutUpload as EventListener);
    window.addEventListener('banana-open-image-reverse', onOpenReverse as EventListener);
    window.addEventListener('banana-open-history', onOpenHistory as EventListener);
    return () => {
      window.removeEventListener('banana-nav-upload', onShortcutUpload as EventListener);
      window.removeEventListener('banana-open-image-reverse', onOpenReverse as EventListener);
      window.removeEventListener('banana-open-history', onOpenHistory as EventListener);
    };
  }, []);

  // --- Persistence ---
  useEffect(() => {
    const { uploadedImages, ...persistable } = settings;
    localStorage.setItem('banana_studio_settings', JSON.stringify(persistable));
  }, [settings]);

  useEffect(() => {
    if (!imageModels.length)
      return;
    const defaultModelId = imageModels.find((model) => model.label.includes('Nano Banana Pro'))?.id || imageModels[0].id;
    const exists = imageModels.some((model) => model.id === settings.model);
    if (!exists) {
      setSettings((prev: any) => ({
        ...prev,
        model: defaultModelId,
      }));
    }
  }, [imageModels, settings.model]);

  useEffect(() => {
    try {
      const toSave = history.slice(0, 10);
      localStorage.setItem('banana_studio_history', JSON.stringify(toSave));
    } catch (e: any) {
      console.warn('localStorage 配额不足，自动裁剪历史记录', e);
      try {
        const trimmed = history.slice(0, 3);
        localStorage.setItem('banana_studio_history', JSON.stringify(trimmed));
      } catch {
        localStorage.removeItem('banana_studio_history');
      }
    }
  }, [history]);

  useEffect(() => {
    const pendingNodes = canvasNodes
      .filter((node) => node.status === 'generating' && !!node.taskId)
      .map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        prompt: node.prompt || '',
        model: node.model || '',
        timestamp: node.timestamp,
        taskId: node.taskId,
        aspectRatio: node.aspectRatio,
        progress: typeof node.progress === 'number' ? node.progress : 10,
      }));

    if (!pendingNodes.length) {
      localStorage.removeItem(PENDING_NODES_STORAGE_KEY);
      return;
    }

    localStorage.setItem(PENDING_NODES_STORAGE_KEY, JSON.stringify(pendingNodes));
  }, [canvasNodes]);

  // --- Handlers ---
  const handleGenerate = async () => {
    // 触发全局任务 - REMOVED: API Key check as users use coins now

    if (isResolvedVideoModel) {
      const maxUpload = getVideoUploadLimit(resolvedRoutingModelId);
      const uploadedCount = settings.uploadedImages?.length || 0;
      if (uploadedCount > maxUpload) {
        showNotice(
          isVideoFirstLastModel(resolvedRoutingModelId)
            ? `当前模型最多支持 2 张参考图（首帧/尾帧），你已上传 ${uploadedCount} 张，请先删除后再生成。`
            : `当前模型最多支持 ${maxUpload} 张参考图，你已上传 ${uploadedCount} 张，请先删除后再生成。`,
        );
        return;
      }
    }

    // 触发全局任务
    useCanvasStore.getState().submitGenerateTask(
        {
          prompt: settings.prompt,
          model: settings.model,
          routingModelId: resolvedRoutingModelId,
          isVideoModel: isResolvedVideoModel,
          size: settings.size,
          resolution: settings.resolution,
          duration: settings.duration,
          hd: settings.hd,
          userId: userId,
          batchSize: settings.batchSize || 1,
          uploadedImages: settings.uploadedImages
       },
       // 提供操作本地历史记录的回调钩子，使后台同样能写入最新的历史面板
       (newHistoryItem) => {
          setHistory((prev: any[]) => [newHistoryItem, ...prev]);
       }
    );
  };

  const handleRemoveImage = (imgId: string) => {
    setSettings((prev: any) => ({
      ...prev,
      uploadedImages: prev.uploadedImages.filter((img: any) => img.id !== imgId)
    }));
  };

  const handleFileUpload = (files: File[]) => {
    const maxUpload = isResolvedVideoModel
      ? getVideoUploadLimit(resolvedRoutingModelId)
      : 10;
    const currentCount = settings.uploadedImages?.length || 0;
    const remaining = maxUpload - currentCount;

    if (remaining <= 0) {
      if (isResolvedVideoModel) {
        showNotice(
          isVideoFirstLastModel(resolvedRoutingModelId)
            ? '当前视频模型最多支持 2 张参考图（首帧/尾帧）'
            : '当前视频模型最多支持 3 张参考图',
        );
      } else {
        showNotice('最多支持上传 10 张参考图');
      }
      return;
    }

    if (files.length > remaining) {
      if (isResolvedVideoModel) {
        showNotice(`最多还能上传 ${remaining} 张图片（当前模型上限 ${maxUpload} 张），请减少后重试`);
      } else {
        showNotice(`最多还能上传 ${remaining} 张图片（总数上限 10 张），请减少后重试`);
      }
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        const newImg = {
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          data: data,
          name: file.name
        };
        setSettings((prev: any) => ({
          ...prev,
          uploadedImages: [...(prev.uploadedImages || []), newImg]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImagesReorder = (newImages: any[]) => {
    setSettings((prev: any) => ({
      ...prev,
      uploadedImages: newImages
    }));
  };

  const handleUseAsReference = (imageUrl: string) => {
    const maxUpload = isResolvedVideoModel
      ? getVideoUploadLimit(resolvedRoutingModelId)
      : 10;
    const currentCount = settings.uploadedImages?.length || 0;
    if (currentCount >= maxUpload) {
      showNotice(isResolvedVideoModel
        ? `当前模型最多支持 ${maxUpload} 张参考图，请先删除后再添加`
        : '最多支持上传 10 张参考图');
      return;
    }
    const newImg = {
      id: `img-ref-${Date.now()}`,
      data: imageUrl,
      name: 'reference-image.png'
    };
    setSettings((prev: any) => ({
      ...prev,
      uploadedImages: [...(prev.uploadedImages || []), newImg]
    }));
  };

  const handleRegenerate = React.useCallback((item: { prompt?: string; model?: string }) => {
    if (!item?.prompt)
      return;

    setIsBarCollapsed(false);
    setSettings((prev: any) => ({
      ...prev,
      prompt: item.prompt,
    }));
  }, []);

  return (
    <Box sx={{
      position: 'relative',
      width: '100%',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
    }}>
      <input
        type='file'
        ref={canvasUploadInputRef}
        style={{ display: 'none' }}
        accept='image/*'
        multiple
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (!files.length) {
            e.target.value = '';
            return;
          }

          const { viewport } = useCanvasStore.getState();
          const safeZoom = Math.max(0.1, viewport.zoom || 1);
          const startScreenX = 20;
          const startScreenY = 120;
          const baseWorldX = (startScreenX - viewport.x) / safeZoom;
          const baseWorldY = (startScreenY - viewport.y) / safeZoom;

          files.forEach((file, i) => {
            if (!file.type.startsWith('image/'))
              return;

            const reader = new FileReader();
            reader.onload = (ev) => {
              const data = ev.target?.result as string;
              if (!data)
                return;

              const img = new Image();
              img.onload = () => {
                const ratio = img.width / img.height;
                const w = 320;
                const h = Math.max(160, Math.round(w / Math.max(0.2, ratio)));

                useCanvasStore.getState().addNode({
                  id: `node-upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  x: baseWorldX + i * 36,
                  y: baseWorldY + i * 36,
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

          e.target.value = '';
        }}
      />

      {/* Right docked canvas toolbar (collapsible) */}
      <Box
        data-banana-canvas-toolbar='true'
        sx={{
          display: { xs: 'none', sm: 'block' },
          position: 'absolute',
          right: '10px',
          top: '5.2rem',
          zIndex: 1200,
          pointerEvents: 'none',
        }}
      >
        <Box sx={{ position: 'relative', pointerEvents: 'auto' }}>
          <Box
            data-banana-canvas-toolbar-body='true'
            sx={{
              transition: 'transform 0.22s ease',
              transform: isToolbarCollapsed ? 'translateX(68px)' : 'translateX(0)',
            }}
          >
            <CanvasToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onUpload={() => canvasUploadInputRef.current?.click()}
              onOpenImageReverse={() => setIsReverseModalOpen(true)}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
            />
          </Box>

          <Tooltip title={isToolbarCollapsed ? '展开工具栏' : '收起工具栏'} placement='top'>
            <IconButton
              size='sm'
              variant='soft'
              color='neutral'
              onClick={() => setIsToolbarCollapsed((v) => !v)}
              sx={{
                position: 'absolute',
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 24,
                height: 24,
                minHeight: 24,
                borderRadius: '999px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.surface',
                boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
              }}
            >
              {isToolbarCollapsed ? <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: '1rem' }} /> : <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: '1rem' }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Modal open={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)}>
        <ModalDialog
          aria-labelledby='banana-history-modal-title'
          sx={{
            width: 'min(1120px, calc(100vw - 24px))',
            height: 'min(800px, calc(100vh - 24px))',
            p: 0,
            overflow: 'hidden',
            borderRadius: '18px',
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(16,20,30,0.98) 0%, rgba(12,15,24,0.98) 100%)'
              : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid',
            borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? '0 24px 70px rgba(0,0,0,0.5)'
              : '0 24px 70px rgba(15,23,42,0.16)',
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
            }}
          >
            <Typography
              id='banana-history-modal-title'
              level='title-lg'
              sx={{ color: (theme) => theme.palette.mode === 'dark' ? 'common.white' : 'text.primary', fontWeight: 700 }}
            >
              历史记录
            </Typography>
            <ModalClose sx={{ position: 'static', color: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.78)' : 'text.secondary' }} />
          </Box>
          <Box sx={{ height: 'calc(100% - 72px)', minHeight: 0 }}>
            <RecentGallery
              layout='modal'
              history={history}
              setHistory={setHistory}
              onSelect={(img) => {
                const matchedNode = useCanvasStore.getState().nodes.find(n => n.image === img);
                window.dispatchEvent(new CustomEvent('canvas-lightbox', {
                  detail: { nodeId: matchedNode?.id || '', image: img }
                }));
              }}
              onUseAsReference={handleUseAsReference}
              onRegenerate={handleRegenerate}
            />
          </Box>
        </ModalDialog>
      </Modal>

      {/* Header (Restored to top) */}
      <Box>
        <BananaHeader
          activeModelId={settings.model}
          onModelChange={(modelId) => {
            const selectedFamily = lineFamilies.get(modelId);
            const nextLine = selectedFamily?.lines[0]?.id || '';
            const routingModelId = selectedFamily?.lines[0]?.id || modelId;
            const maxUpload = isVideoModelId(routingModelId) ? getVideoUploadLimit(routingModelId) : 10;
            const currentImages = settings.uploadedImages || [];
            if (currentImages.length > maxUpload) {
              setSettings({
                ...settings,
                model: modelId,
                line: nextLine,
                uploadedImages: currentImages.slice(0, maxUpload),
              });
              showNotice(isVideoModelId(routingModelId)
                ? `已按当前模型限制自动保留前 ${maxUpload} 张参考图`
                : '参考图已按上限自动调整');
              return;
            }
            setSettings({ ...settings, model: modelId, line: nextLine });
          }}
          models={imageModels}
          activeResolution={settings.resolution}
          queueRunning={queueRunning}
          queuePending={queuePending}
          onBackNavigation={() => router.push('/')}
        />
      </Box>

      {/* Canvas metadata: Zoom (Top Right, Mobile Only) */}
      {isMobile && (
        <Box
          sx={{
            position: 'absolute',
            top: '4.8rem',
            right: '0.8rem',
            zIndex: 1001,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 0.5,
          }}
        >
          <Box
            sx={{
              px: 1.2,
              py: 0.4,
              borderRadius: '0.6rem',
              backgroundColor: 'background.popup',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 'sm',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'primary.solidBg',
              opacity: 0.95,
            }}
          >
            {Math.round(zoom * 100)}%
          </Box>
        </Box>
      )}

      {/* Floating Canvas Controls (Bottom Left, Mobile Only) */}
      {isMobile && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '12rem', // Above the prompt bar
            left: '1rem',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {/* Pan Tool Toggle */}
          <IconButton
            variant={activeTool === 'pan' ? 'soft' : 'outlined'}
            color={activeTool === 'pan' ? 'primary' : 'neutral'}
            onClick={() => setActiveTool(activeTool === 'pan' ? 'select' : 'pan')}
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: 'background.surface',
              boxShadow: 'md',
              '&:hover': { backgroundColor: 'background.surface' },
            }}
          >
            {activeTool === 'pan' ? <PanToolRoundedIcon /> : <MouseRoundedIcon />}
          </IconButton>

          {/* Zoom Controls */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'background.surface',
              borderRadius: '22px',
              boxShadow: 'md',
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            <IconButton
              variant="plain"
              color="neutral"
              onClick={() => {
                const { x, y, zoom } = useCanvasStore.getState().viewport;
                useCanvasStore.getState().setViewport({ x, y, zoom: Math.min(3, zoom * 1.2) });
              }}
              sx={{ width: 44, height: 44, borderRadius: 0 }}
            >
              <AddRoundedIcon />
            </IconButton>
            <Box sx={{ height: '1px', bgcolor: 'divider', mx: 1 }} />
            <IconButton
              variant="plain"
              color="neutral"
              onClick={() => {
                const { x, y, zoom } = useCanvasStore.getState().viewport;
                useCanvasStore.getState().setViewport({ x, y, zoom: Math.max(0.1, zoom / 1.2) });
              }}
              sx={{ width: 44, height: 44, borderRadius: 0 }}
            >
              <RemoveRoundedIcon />
            </IconButton>
          </Box>
        </Box>
      )}


      {/* Infinite Canvas */}
      <InfiniteCanvas activeTool={activeTool} />

      {/* Multi-select alignment toolbar (appears when 2+ nodes selected) */}
      <AlignmentToolbar />



      {/* Right-click context menu */}
      <CanvasContextMenu onUseAsReference={handleUseAsReference} onRegenerate={(prompt) => handleRegenerate({ prompt })} />

      {/* Lightbox modal (triggered by double-clicking a node) */}
      <LightboxModal 
        onRegenerate={(prompt) => handleRegenerate({ prompt })}
        onUseAsReference={handleUseAsReference}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
      />

      {/* Floating Prompt Bar */}
      <BananaPromptBar
        prompt={settings.prompt}
        setPrompt={(p) => setSettings({ ...settings, prompt: p })}
        size={settings.size}
        setSize={(s) => setSettings({ ...settings, size: s })}
        resolution={settings.resolution}
        setResolution={(r: string) => setSettings({ ...settings, resolution: r })}
        batchSize={settings.batchSize}
        setBatchSize={(b: number) => setSettings({ ...settings, batchSize: b })}
        duration={settings.duration}
        setDuration={(duration: number) => setSettings({ ...settings, duration })}
        hd={settings.hd}
        setHd={(hd: boolean) => setSettings({ ...settings, hd })}
        isVideoModel={isResolvedVideoModel}
        videoReferenceMode={videoReferenceMode}
        maxVideoUploadCount={isResolvedVideoModel ? getVideoUploadLimit(resolvedRoutingModelId) : undefined}
        line={settings.line}
        setLine={(line: string) => setSettings({ ...settings, line })}
        showLineSelector={isLineFamily}
        lineOptions={lineOptions}
        estimatedCoins={estimatedCoins}
        uploadedImages={settings.uploadedImages || []}
        onFileUpload={handleFileUpload}
        onImageRemove={handleRemoveImage}
        onImagesReorder={handleImagesReorder}
        isCollapsed={isBarCollapsed}
        setIsCollapsed={setIsBarCollapsed}
        models={imageModels}
        model={settings.model}
        onModelChange={(modelId) => {
          const selectedFamily = lineFamilies.get(modelId);
          const nextLine = selectedFamily?.lines[0]?.id || '';
          const routingModelId = selectedFamily?.lines[0]?.id || modelId;
          const maxUpload = isVideoModelId(routingModelId) ? getVideoUploadLimit(routingModelId) : 10;
          const currentImages = settings.uploadedImages || [];
          if (currentImages.length > maxUpload) {
            setSettings({
              ...settings,
              model: modelId,
              line: nextLine,
              uploadedImages: currentImages.slice(0, maxUpload),
            });
            showNotice(isVideoModelId(routingModelId)
              ? `已按当前模型限制自动保留前 ${maxUpload} 张参考图`
              : '参考图已按上限自动调整');
            return;
          }
          setSettings({ ...settings, model: modelId, line: nextLine });
        }}
        isGenerating={globalIsGenerating}
        onGenerate={handleGenerate}
        onNotify={showNotice}
        onBackNavigation={() => {
          // If in standalone mode or just routing, can use window.history.back
          // Assuming an app router back navigation:
          window.history.back();
        }}
        onActionHistory={() => setIsHistoryModalOpen(true)}
      />

      <ImageReversePromptModal
        open={isReverseModalOpen}
        onClose={() => setIsReverseModalOpen(false)}
        onApplyPrompt={(prompt) => {
          setSettings((prev: any) => ({ ...prev, prompt }));
          setIsBarCollapsed(false);
        }}
        onNotify={showNotice}
      />

      <Snackbar
        open={Boolean(noticeMessage)}
        autoHideDuration={2600}
        onClose={() => setNoticeMessage('')}
        color='warning'
        variant='soft'
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          mt: 1,
          borderRadius: '12px',
          border: '1px solid',
          borderColor: 'warning.outlinedBorder',
          boxShadow: '0 10px 26px rgba(0,0,0,0.16)',
          maxWidth: 'min(92vw, 680px)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {noticeMessage}
      </Snackbar>

    </Box>
  );
};
