import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Option,
  Select,
  Stack,
  Table,
  Typography,
} from '@mui/joy';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';

type RelayRouteId = string;
type RelayTransport = 'gemini-generate-content' | 'openai-images' | 'anthropic' | 'visionary-images';
type LogScope = 'all' | 'video';

type GenerateLogItem = {
  id: string;
  endpoint: string;
  phase: string;
  model: string | null;
  taskId: string | null;
  statusCode: number | null;
  result: string | null;
  errorText: string | null;
  requestPayload: any;
  responsePayload: any;
  createdAt: string;
};

type FormState = {
  modelId: string;
  modelName: string;
  baseModelName: string;
  lineName: string;
  category: 'IMAGE' | 'VIDEO' | 'CHAT';
  coinCost: number;
  isActive: boolean;
  routeId: RelayRouteId;
  transport: RelayTransport;
  resolutionModelPolicy: 'same' | 'suffix';
  upstreamModel: string;
  endpointPath: string;
  baseUrl: string;
  apiKey: string;
};

const DEFAULT_FORM: FormState = {
  modelId: '',
  modelName: '',
  baseModelName: '',
  lineName: '',
  category: 'IMAGE',
  coinCost: 4,
  isActive: true,
  routeId: 'bltcy',
  transport: 'openai-images',
  resolutionModelPolicy: 'same',
  upstreamModel: '',
  endpointPath: '/v1/images/generations',
  baseUrl: 'https://api.bltcy.ai',
  apiKey: '',
};

function normalizeModelId(modelId: string) {
  return modelId.trim().replace(/^models\//, '').toLowerCase();
}

function parseModelDisplayName(modelName: string): { baseModelName: string; lineName: string } {
  const trimmed = modelName.trim();
  if (!trimmed)
    return { baseModelName: '', lineName: '' };
  const match = trimmed.match(/^(.*?)[(\uFF08]\s*([^()\uFF08\uFF09]+?)\s*[)\uFF09]\s*$/);
  if (!match)
    return { baseModelName: trimmed, lineName: '' };
  return {
    baseModelName: match[1]?.trim() || '',
    lineName: match[2]?.trim() || '',
  };
}

function buildModelDisplayName(form: FormState): string {
  const base = form.baseModelName.trim();
  const line = form.lineName.trim();
  if ((form.category === 'IMAGE' || form.category === 'VIDEO') && base && line)
    return `${base}\uFF08${line}\uFF09`;
  return form.modelName.trim() || base;
}

export function RelayModelsSection() {
  const { user, accessToken } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [activeCategory, setActiveCategory] = React.useState<'ALL' | 'IMAGE' | 'VIDEO' | 'CHAT'>('ALL');
  const [logScope, setLogScope] = React.useState<LogScope>('video');
  const [generateLogs, setGenerateLogs] = React.useState<GenerateLogItem[]>([]);
  const [logLoading, setLogLoading] = React.useState(false);
  const [logError, setLogError] = React.useState('');
  const lastSavedRef = React.useRef<FormState | null>(null);

  const chatPresets = React.useMemo(() => ([
    { group: 'Gemini', label: 'Gemini-3-Flash', modelId: 'gemini-3-flash-preview', cost: 1, transport: 'gemini-generate-content' },
    { group: 'Gemini', label: 'Gemini-3.1-Pro', modelId: 'gemini-3.1-pro-preview', cost: 4, transport: 'gemini-generate-content' },
    { group: 'Anthropic', label: 'Claude-Opus-4-6', modelId: 'claude-opus-4-6', cost: 8, transport: 'anthropic' },
    { group: 'Anthropic', label: 'Claude-Opus-4-5', modelId: 'claude-opus-4-5', cost: 5, transport: 'anthropic' },
    { group: 'Anthropic', label: 'Claude-Sonnet-4-6', modelId: 'claude-sonnet-4-6', cost: 4, transport: 'anthropic' },
    { group: 'Anthropic', label: 'Claude-Sonnet-4-5', modelId: 'claude-sonnet-4-5', cost: 3, transport: 'anthropic' },
    { group: 'OpenAI', label: 'Gpt-5.4', modelId: 'gpt-5.4', cost: 5, transport: 'openai-images' },
    { group: 'OpenAI', label: 'Gpt-5.3-Codex', modelId: 'gpt-5.3-codex', cost: 3, transport: 'openai-images' },
    { group: 'xAI', label: 'Grok-4.1', modelId: 'grok-4.1', cost: 3, transport: 'openai-images' },
  ]), []);

  const { data, isLoading, refetch } = (apiQuery.admin.getRelayModelConfig as any).useQuery(undefined, {
    enabled: isSuperAdmin,
  });

  const upsertMutation = (apiQuery.admin.upsertRelayModelConfig as any).useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  const deleteMutation = (apiQuery.admin.deleteRelayModelConfig as any).useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const applyTemplate = React.useCallback((preset: {
    category: FormState['category'];
    transport: FormState['transport'];
    endpointPath: string;
    routeId: RelayRouteId;
  }) => {
    const channel = data?.channels?.[preset.routeId] || {};
    setForm((prev) => ({
      ...prev,
      category: preset.category,
      transport: preset.transport,
      resolutionModelPolicy: 'same',
      endpointPath: preset.endpointPath,
      routeId: preset.routeId,
      baseUrl: channel.baseUrl || prev.baseUrl,
      apiKey: channel.apiKey || prev.apiKey,
    }));
  }, [data]);

  React.useEffect(() => {
    if (!data)
      return;
    const channelConfig = data.channels?.[form.routeId];
    if (channelConfig) {
      setForm((prev) => ({
        ...prev,
        baseUrl: channelConfig.baseUrl || prev.baseUrl,
        apiKey: channelConfig.apiKey || prev.apiKey,
      }));
    }
    // only initialize when data first arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const rows = React.useMemo(() => {
    if (!data)
      return [];
    const routeOverrides = data.routeOverrides || {};
    const mergedRouteTable = data.mergedRouteTable || {};
    const imagePricing = data.imagePricing || [];
    const videoPricing = data.videoPricing || [];
    const chatPricing = data.chatPricing || [];
    const mergedPricing = [...imagePricing, ...videoPricing, ...chatPricing];

    return mergedPricing.map((pricing: any) => {
      const normalizedId = normalizeModelId(pricing.modelId);
      const route = routeOverrides[normalizedId] || mergedRouteTable[normalizedId] || null;
      const routeId = route?.routeId === 'aittco' || route?.routeId === 'bltcy'
        ? route.routeId
        : undefined;
      const channel = routeId ? data.channels?.[routeId] : null;
      return {
        modelId: pricing.modelId,
        modelName: pricing.modelName,
        category: pricing.category || 'IMAGE',
        coinCost: pricing.coinCost,
        isActive: pricing.isActive,
        routeId: routeId || '-',
        transport: route?.protocol || '-',
        resolutionModelPolicy: route?.resolutionModelPolicy === 'suffix' ? 'suffix' : 'same',
        upstreamModel: route?.upstreamModel || pricing.modelId,
        endpointPath: route?.endpointPath
          || (pricing.category === 'VIDEO' ? '/v2/videos/generations' : (route?.protocol === 'openai-images' ? '/v1/images/generations' : '-')),
        baseUrl: route?.baseUrl || channel?.baseUrl || '',
        apiKey: route?.apiKey || channel?.apiKey || '',
      };
    });
  }, [data]);

  const onRouteChange = (routeId: RelayRouteId) => {
    const normalizedRouteId = routeId.trim().toLowerCase();
    const channelConfig = data?.channels?.[normalizedRouteId];
    setForm((prev) => ({
      ...prev,
      routeId: normalizedRouteId,
      baseUrl: channelConfig?.baseUrl || prev.baseUrl,
      apiKey: channelConfig?.apiKey || prev.apiKey,
    }));
  };

  const onSave = () => {
    const displayName = buildModelDisplayName(form);
    if (!form.modelId.trim() || !displayName || !form.baseUrl.trim() || !form.apiKey.trim())
      return;
    lastSavedRef.current = {
      ...form,
      modelId: form.modelId.trim(),
      modelName: displayName,
      upstreamModel: form.upstreamModel.trim() || form.modelId.trim(),
      endpointPath: form.endpointPath.trim(),
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
    };
    upsertMutation.mutate({
      modelId: form.modelId.trim(),
      modelName: displayName,
      category: form.category,
      coinCost: Number(form.coinCost),
      isActive: form.isActive,
      routeId: form.routeId,
      transport: form.transport,
      resolutionModelPolicy: form.resolutionModelPolicy,
      upstreamModel: form.upstreamModel.trim() || form.modelId.trim(),
      endpointPath: form.endpointPath.trim(),
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
    });
  };

  const onCopyPrevious = () => {
    if (!lastSavedRef.current)
      return;
    const prev = lastSavedRef.current;
    setForm({
      ...prev,
      modelId: '',
      modelName: '',
      baseModelName: prev.baseModelName,
      lineName: prev.lineName,
      upstreamModel: '',
    });
  };

  const autoDisplayName = buildModelDisplayName(form);
  const useExplicitNameFields = form.category === 'IMAGE' || form.category === 'VIDEO';
  const availableRouteIds = React.useMemo(
    () => Object.keys(data?.channels || {}).sort((a, b) => a.localeCompare(b)),
    [data],
  );

  const loadGenerateLogs = React.useCallback(async (scope: LogScope) => {
    if (!accessToken) {
      setLogError('未登录或令牌无效，无法加载日志');
      setGenerateLogs([]);
      return;
    }

    setLogLoading(true);
    setLogError('');
    try {
      const query = scope === 'video' ? 'limit=20&scope=video' : 'limit=20';
      const res = await fetch(`/api/generate-logs?${query}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || data?.message || `请求失败(${res.status})`);
      setGenerateLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (error: any) {
      setGenerateLogs([]);
      setLogError(error?.message || '加载日志失败');
    } finally {
      setLogLoading(false);
    }
  }, [accessToken]);

  React.useEffect(() => {
    if (!isSuperAdmin)
      return;
    void loadGenerateLogs(logScope);
  }, [isSuperAdmin, logScope, loadGenerateLogs]);

  if (!isSuperAdmin) {
    return (
      <Alert color="warning" variant="soft">
        仅超级管理员可管理渠道、密钥和模型路由。</Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography level="title-lg">渠道与模型路由</Typography>
            <IconButton variant="outlined" onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Box>

          <Alert color="neutral" variant="soft" sx={{ mb: 2 }}>
            在这里可以一次性配置渠道地址、API Key、模型路由和金币单价。</Alert>

          <Stack spacing={2}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip
                variant={activeCategory === 'ALL' ? 'solid' : 'soft'}
                color="neutral"
                onClick={() => setActiveCategory('ALL')}
              >
                全部模型
              </Chip>
              <Chip
                variant={activeCategory === 'IMAGE' ? 'solid' : 'soft'}
                color="success"
                onClick={() => setActiveCategory('IMAGE')}
              >
                图片模型
              </Chip>
              <Chip
                variant={activeCategory === 'VIDEO' ? 'solid' : 'soft'}
                color="warning"
                onClick={() => setActiveCategory('VIDEO')}
              >
                视频模型
              </Chip>
              <Chip
                variant={activeCategory === 'CHAT' ? 'solid' : 'soft'}
                color="primary"
                onClick={() => setActiveCategory('CHAT')}
              >
                文本模型
              </Chip>
            </Box>
            <FormControl>
              <FormLabel>文本模型快捷选择</FormLabel>
              <Select
                placeholder="选择后自动填充（固定列表）"
                onChange={(_, value) => {
                  if (!value)
                    return;
                  const preset = chatPresets.find((item) => item.modelId === value);
                  if (!preset)
                    return;
                  const channel = data?.channels?.aittco || {};
                  const endpointPath = preset.transport === 'anthropic'
                    ? '/v1/messages'
                    : preset.transport === 'gemini-generate-content'
                      ? ''
                      : '/v1/chat/completions';
                  setForm((prev) => ({
                    ...prev,
                    modelId: preset.modelId,
                    modelName: preset.label,
                    baseModelName: '',
                    lineName: '',
                    category: 'CHAT',
                    coinCost: preset.cost,
                    routeId: 'aittco',
                    transport: preset.transport as FormState['transport'],
                    upstreamModel: preset.modelId,
                    endpointPath,
                    baseUrl: channel.baseUrl || prev.baseUrl,
                    apiKey: channel.apiKey || prev.apiKey,
                  }));
                }}
              >
                {chatPresets.map((preset) => (
                  <Option key={preset.modelId} value={preset.modelId}>
                    {preset.group} 路 {preset.label}
                  </Option>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <FormControl>
                <FormLabel>模型 ID</FormLabel>
                <Input
                  value={form.modelId}
                  placeholder="grok-4.2-image"
                  onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>显示名称</FormLabel>
                <Input
                  value={useExplicitNameFields ? autoDisplayName : form.modelName}
                  placeholder={useExplicitNameFields ? '自动生成：主模型名（线路名）' : 'Grok-4.2-image'}
                  disabled={useExplicitNameFields}
                  onChange={(e) => setForm({ ...form, modelName: e.target.value, baseModelName: '', lineName: '' })}
                />
              </FormControl>
              {useExplicitNameFields && (
                <>
                  <FormControl>
                    <FormLabel>主模型名（显式）</FormLabel>
                    <Input
                      value={form.baseModelName}
                      placeholder="Nano Banana Pro"
                      onChange={(e) => setForm({ ...form, baseModelName: e.target.value })}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>线路名（显式）</FormLabel>
                    <Input
                      value={form.lineName}
                      placeholder="线路一 / 今日特价 / VIP"
                      onChange={(e) => setForm({ ...form, lineName: e.target.value })}
                    />
                  </FormControl>
                </>
              )}
              <FormControl>
                <FormLabel>模型类型</FormLabel>
                <Select
                  value={form.category}
                  onChange={(_, value) => {
                    if (!value)
                      return;
                    const nextCategory = value as FormState['category'];
                    if (nextCategory === 'VIDEO') {
                      applyTemplate({
                        category: 'VIDEO',
                        transport: 'openai-images',
                        endpointPath: '/v2/videos/generations',
                        routeId: 'bltcy',
                      });
                      return;
                    }
                    if (nextCategory === 'CHAT') {
                      applyTemplate({
                        category: 'CHAT',
                        transport: 'gemini-generate-content',
                        endpointPath: '',
                        routeId: 'aittco',
                      });
                      return;
                    }
                    applyTemplate({
                      category: 'IMAGE',
                      transport: 'openai-images',
                      endpointPath: '/v1/images/generations',
                      routeId: 'bltcy',
                    });
                  }}
                >
                  <Option value="IMAGE">图片 (IMAGE)</Option>
                  <Option value="VIDEO">视频 (VIDEO)</Option>
                  <Option value="CHAT">文本 (CHAT)</Option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>线路模板</FormLabel>
                <Select
                  placeholder="一键填充协议与接口"
                  onChange={(_, value) => {
                    if (!value)
                      return;
                    if (value === 'image-openai') {
                      applyTemplate({
                        category: 'IMAGE',
                        transport: 'openai-images',
                        endpointPath: '/v1/images/generations',
                        routeId: 'bltcy',
                      });
                    } else if (value === 'image-gemini') {
                      applyTemplate({
                        category: 'IMAGE',
                        transport: 'gemini-generate-content',
                        endpointPath: '',
                        routeId: 'aittco',
                      });
                    } else if (value === 'image-visionary') {
                      applyTemplate({
                        category: 'IMAGE',
                        transport: 'visionary-images',
                        endpointPath: '/openapi/v1/images/generations',
                        routeId: 'visionary',
                      });
                    } else if (value === 'video-bt') {
                      applyTemplate({
                        category: 'VIDEO',
                        transport: 'openai-images',
                        endpointPath: '/v2/videos/generations',
                        routeId: 'bltcy',
                      });
                    } else if (value === 'chat-gemini') {
                      applyTemplate({
                        category: 'CHAT',
                        transport: 'gemini-generate-content',
                        endpointPath: '',
                        routeId: 'aittco',
                      });
                    } else if (value === 'chat-anthropic') {
                      applyTemplate({
                        category: 'CHAT',
                        transport: 'anthropic',
                        endpointPath: '/v1/messages',
                        routeId: 'aittco',
                      });
                    } else if (value === 'chat-openai') {
                      applyTemplate({
                        category: 'CHAT',
                        transport: 'openai-images',
                        endpointPath: '/v1/chat/completions',
                        routeId: 'aittco',
                      });
                    }
                  }}
                >
                  <Option value="image-openai">图片 路 OpenAI Images</Option>
                  <Option value="image-gemini">图片 路 Gemini Content</Option>
                  <Option value="image-visionary">图片 路 Visionary</Option>
                  <Option value="video-bt">视频 路 BLTCY</Option>
                  <Option value="chat-gemini">文本 路 Gemini</Option>
                  <Option value="chat-anthropic">文本 路 Anthropic</Option>
                  <Option value="chat-openai">文本 路 OpenAI</Option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>渠道ID（可新增）</FormLabel>
                <Input
                  value={form.routeId}
                  placeholder="aittco / bltcy / 02studio"
                  onChange={(e) => onRouteChange(e.target.value)}
                />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                  {availableRouteIds.map((routeId) => (
                    <Chip
                      key={routeId}
                      size="sm"
                      variant={form.routeId === routeId ? 'solid' : 'soft'}
                      onClick={() => onRouteChange(routeId)}
                    >
                      {data?.channels?.[routeId]?.label || routeId.toUpperCase()}
                    </Chip>
                  ))}
                </Box>
              </FormControl>
              <FormControl>
                <FormLabel>传输协议</FormLabel>
                <Select value={form.transport} onChange={(_, value) => value && setForm({ ...form, transport: value as RelayTransport })}>
                  <Option value="openai-images">openai-images</Option>
                  <Option value="gemini-generate-content">gemini-generate-content</Option>
                  <Option value="visionary-images">visionary-images</Option>
                  <Option value="anthropic">anthropic</Option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>2K/4K 模型切换策略</FormLabel>
                <Select
                  value={form.resolutionModelPolicy}
                  onChange={(_, value) => {
                    if (!value)
                      return;
                    setForm({ ...form, resolutionModelPolicy: value as 'same' | 'suffix' });
                  }}
                >
                  <Option value="same">保持主模型（默认）</Option>
                  <Option value="suffix">切换到 -2k/-4k</Option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>接口路径</FormLabel>
                <Input
                  value={form.endpointPath}
                  placeholder={form.category === 'VIDEO' ? '/v2/videos/generations' : '/v1/images/generations'}
                  onChange={(e) => setForm({ ...form, endpointPath: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>上游模型 ID</FormLabel>
                <Input
                  value={form.upstreamModel}
                  placeholder="grok-4.2-image"
                  onChange={(e) => setForm({ ...form, upstreamModel: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>中转站 Base URL</FormLabel>
                <Input
                  value={form.baseUrl}
                  placeholder="https://api.bltcy.ai"
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>API Key</FormLabel>
                <Input
                  value={form.apiKey}
                  type="password"
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>金币单价（每次）</FormLabel>
                <Input
                  type="number"
                  value={String(form.coinCost)}
                  onChange={(e) => setForm({ ...form, coinCost: Number(e.target.value || '0') })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>状态</FormLabel>
                <Select value={form.isActive ? 'active' : 'inactive'} onChange={(_, value) => setForm({ ...form, isActive: value !== 'inactive' })}>
                  <Option value="active">启用</Option>
                  <Option value="inactive">禁用</Option>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={onSave} loading={upsertMutation.isPending}>保存渠道与模型</Button>
              <Button
                variant="soft"
                color="primary"
                disabled={!lastSavedRef.current}
                onClick={onCopyPrevious}
              >
                复制上一条配置</Button>
              <Button
                variant="outlined"
                color="neutral"
                onClick={() => setForm(DEFAULT_FORM)}
              >
                重置表单
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography level="title-md" sx={{ mb: 2 }}>已配置模型</Typography>
          {isLoading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ overflow: 'auto' }}>
              <Table stickyHeader hoverRow>
                <thead>
                  <tr>
                    <th>模型ID</th>
                    <th>显示名称</th>
                    <th>类型</th>
                    <th>渠道</th>
                    <th>协议</th>
                    <th>接口</th>
                    <th>上游模型</th>
                    <th>金币</th>
                    <th>状态</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((row: any) => activeCategory === 'ALL' || row.category === activeCategory)
                    .map((row: any) => (
                    <tr key={row.modelId}>
                      <td><Typography level="body-xs" fontWeight="md">{row.modelId}</Typography></td>
                      <td>{row.modelName}</td>
                      <td>
                        <Chip size="sm" variant="soft" color={row.category === 'VIDEO' ? 'warning' : 'success'}>
                          {row.category}
                        </Chip>
                      </td>
                      <td>{row.routeId}</td>
                      <td>{row.transport}</td>
                      <td>{row.endpointPath}</td>
                      <td>{row.upstreamModel}</td>
                      <td>{row.coinCost}</td>
                      <td><Chip size="sm" color={row.isActive ? 'success' : 'neutral'}>{row.isActive ? '启用' : '禁用'}</Chip></td>
                      <td style={{ textAlign: 'right' }}>
                        <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                          <IconButton
                            size="sm"
                            variant="outlined"
                            onClick={() => {
                              const channel = data?.channels?.[row.routeId] || {};
                              const parsedDisplayName = parseModelDisplayName(row.modelName || '');
                              setForm({
                                modelId: row.modelId,
                                modelName: row.modelName,
                                baseModelName: parsedDisplayName.baseModelName,
                                lineName: parsedDisplayName.lineName,
                                category: row.category || 'IMAGE',
                                coinCost: row.coinCost,
                                isActive: row.isActive,
                                routeId: String(row.routeId || 'bltcy').toLowerCase(),
                                transport: row.transport === 'gemini-generate-content'
                                  || row.transport === 'anthropic'
                                  || row.transport === 'visionary-images'
                                  ? row.transport
                                  : 'openai-images',
                                resolutionModelPolicy: row.resolutionModelPolicy === 'suffix' ? 'suffix' : 'same',
                                upstreamModel: row.upstreamModel,
                                endpointPath: row.endpointPath === '-'
                                  ? (row.category === 'VIDEO'
                                      ? '/v2/videos/generations'
                                      : row.transport === 'visionary-images'
                                        ? '/openapi/v1/images/generations'
                                        : '/v1/images/generations')
                                  : row.endpointPath,
                                baseUrl: row.baseUrl || channel.baseUrl || form.baseUrl,
                                apiKey: row.apiKey || channel.apiKey || form.apiKey,
                              });
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="outlined"
                            color="danger"
                            loading={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate({ modelId: row.modelId, category: row.category })}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
            <Typography level="title-md">最近请求日志</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="sm"
                variant={logScope === 'video' ? 'solid' : 'soft'}
                color="warning"
                onClick={() => setLogScope('video')}
              >
                最近视频日志
              </Button>
              <Button
                size="sm"
                variant={logScope === 'all' ? 'solid' : 'soft'}
                color="neutral"
                onClick={() => setLogScope('all')}
              >
                最近全部日志
              </Button>
              <IconButton
                size="sm"
                variant="outlined"
                onClick={() => loadGenerateLogs(logScope)}
                loading={logLoading}
              >
                <RefreshIcon />
              </IconButton>
            </Box>
          </Box>

          {logError && (
            <Alert color="danger" variant="soft" sx={{ mb: 1.5 }}>
              {logError}
            </Alert>
          )}

          {logLoading ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ overflow: 'auto' }}>
              <Table stickyHeader hoverRow>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>接口</th>
                    <th>阶段</th>
                    <th>模型</th>
                    <th>结果</th>
                    <th>状态码</th>
                    <th>错误</th>
                    <th>TaskId</th>
                    <th>请求/返回</th>
                  </tr>
                </thead>
                <tbody>
                  {generateLogs.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                      <td><Typography level="body-xs">{row.endpoint}</Typography></td>
                      <td>{row.phase}</td>
                      <td><Typography level="body-xs">{row.model || '-'}</Typography></td>
                      <td>{row.result || '-'}</td>
                      <td>{row.statusCode ?? '-'}</td>
                      <td><Typography level="body-xs" color="danger">{row.errorText || '-'}</Typography></td>
                      <td><Typography level="body-xs">{row.taskId || '-'}</Typography></td>
                      <td style={{ minWidth: 300 }}>
                        <details>
                          <summary style={{ cursor: 'pointer' }}>查看</summary>
                          <Typography level="body-xs" sx={{ mt: 0.5 }}>request</Typography>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 120, overflow: 'auto' }}>
                            {JSON.stringify(row.requestPayload ?? {}, null, 2)}
                          </pre>
                          <Typography level="body-xs" sx={{ mt: 0.75 }}>response</Typography>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 160, overflow: 'auto' }}>
                            {JSON.stringify(row.responsePayload ?? {}, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                  {!generateLogs.length && (
                    <tr>
                      <td colSpan={9}>
                        <Typography level="body-sm" sx={{ py: 1, color: 'text.tertiary' }}>
                          暂无日志记录
                        </Typography>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}



