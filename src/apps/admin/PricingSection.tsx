import * as React from 'react';
import { 
  Box, Card, CardContent, Typography, Table, Button, Input, Select, Option, 
  Checkbox, CircularProgress, Modal, ModalDialog, FormControl, FormLabel, 
  Stack, IconButton, Chip 
} from '@mui/joy';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';

export function PricingSection() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: pricing, isLoading, refetch } = (apiQuery.admin.getAllPricing as any).useQuery(undefined, {
    enabled: isSuperAdmin,
  });
  const [editingItem, setEditingItem] = React.useState<any>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<'ALL' | 'CHAT' | 'IMAGE' | 'VIDEO'>('ALL');
  const [bulkLoading, setBulkLoading] = React.useState<'CHAT' | 'IMAGE' | 'VIDEO' | null>(null);

  const chatPresets = React.useMemo(() => ([
    { group: 'Gemini', label: 'Gemini-3.5-Flash', modelId: 'gemini-3.5-flash-preview', coinCost: 1 },
    { group: 'Gemini', label: 'Gemini-3.7-Flash', modelId: 'gemini-3.7-flash', coinCost: 2 },
    { group: 'Gemini', label: 'Gemini-3.1-Pro', modelId: 'gemini-3.1-pro-preview', coinCost: 3 },
    { group: 'OpenAI', label: 'GPT-5.5', modelId: 'gpt-5.5', coinCost: 4 },
    { group: 'OpenAI', label: 'GPT-5.6-Terra', modelId: 'gpt-5.6-terra', coinCost: 3 },
    { group: 'OpenAI', label: 'GPT-5.6-Sol', modelId: 'gpt-5.6-sol', coinCost: 6 },
    { group: 'Claude', label: 'Claude-Opus-4-8', modelId: 'claude-opus-4-8', coinCost: 6 },
    { group: 'Claude', label: 'Claude-Sonnet-5', modelId: 'claude-sonnet-5', coinCost: 5 },
    { group: 'Claude', label: 'Claude-Opus-5', modelId: 'claude-opus-5', coinCost: 7 },
    { group: 'xAI', label: 'Grok-4.6', modelId: 'grok-4.6', coinCost: 3 },
  ]), []);

  const videoPresets = React.useMemo(() => ([
    { label: 'Veo3.1-Fast', modelId: 'veo3.1-fast', coinCost: 12 },
    { label: 'Veo3.1-Components', modelId: 'veo3.1-components', coinCost: 18 },
    { label: 'Veo3.1', modelId: 'veo3.1', coinCost: 18 },
    { label: 'Veo3.1-pro', modelId: 'veo3.1-pro', coinCost: 60 },
    { label: 'Grok-Video-3', modelId: 'grok-video-3', coinCost: 30 },
  ]), []);

  const imagePresets = React.useMemo(() => ([
    { label: 'Nano Banana Pro(线路一)', modelId: 'gemini-3-pro-image-preview', coinCost: 12 },
    { label: 'Nano Banana Pro(线路二)', modelId: 'nano-banana-2', coinCost: 12 },
    { label: 'Nano Banana Pro(VIP)', modelId: 'nano-banana-2-vip', coinCost: 12 },
    { label: 'Nano Banana 2(线路一)', modelId: 'gemini-3.1-flash-image-preview', coinCost: 6 },
    { label: 'Nano Banana 2(VIP)', modelId: 'gemini-3.1-flash-image-preview-vip', coinCost: 6 },
    { label: 'Nano Banana', modelId: 'gemini-2.5-flash-image', coinCost: 3 },
    { label: 'Grok-4.2-Image', modelId: 'grok-4.2-image', coinCost: 8 },
  ]), []);

  const updatePricingMutation = (apiQuery.admin.updatePricing as any).useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingItem(null);
    }
  });

  const handleOpenModal = (item: any = null) => {
    setEditingItem(item || { modelId: '', modelName: '', category: 'CHAT', coinCost: 1, isActive: true });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingItem.modelId || !editingItem.modelName) return;
    updatePricingMutation.mutate(editingItem);
  };

  const handleBulkImport = async (category: 'CHAT' | 'IMAGE' | 'VIDEO') => {
    if (!pricing) return;
    setBulkLoading(category);
    const existingIds = new Set((pricing || []).map((item: any) => String(item.modelId)));
    const presets = category === 'CHAT' ? chatPresets : category === 'IMAGE' ? imagePresets : videoPresets;
    try {
      for (const preset of presets) {
        if (existingIds.has(preset.modelId)) continue;
        await (updatePricingMutation as any).mutateAsync({
          modelId: preset.modelId,
          modelName: preset.label,
          category,
          coinCost: preset.coinCost,
          isActive: true,
        });
      }
    } finally {
      setBulkLoading(null);
      refetch();
    }
  };

  if (!isSuperAdmin) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 1 }}>模型定价</Typography>
          <Typography level="body-sm" color="warning">
            仅超级管理员可修改模型定价配置。
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography level="title-lg">模型定价管理</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button startDecorator={<AddIcon />} onClick={() => handleOpenModal()}>新增模型</Button>
            <IconButton variant="outlined" onClick={() => refetch()}><RefreshIcon /></IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip variant={activeCategory === 'ALL' ? 'solid' : 'soft'} color="neutral" onClick={() => setActiveCategory('ALL')}>全部</Chip>
          <Chip variant={activeCategory === 'CHAT' ? 'solid' : 'soft'} color="primary" onClick={() => setActiveCategory('CHAT')}>文本</Chip>
          <Chip variant={activeCategory === 'IMAGE' ? 'solid' : 'soft'} color="success" onClick={() => setActiveCategory('IMAGE')}>图片</Chip>
          <Chip variant={activeCategory === 'VIDEO' ? 'solid' : 'soft'} color="warning" onClick={() => setActiveCategory('VIDEO')}>视频</Chip>
        </Box>

        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, mb: 2 }}>
          <FormControl>
            <FormLabel>文本模型快捷导入</FormLabel>
            <Select
              placeholder="选择后自动填充"
              onChange={(_, value) => {
                if (!value) return;
                const preset = chatPresets.find((p) => p.modelId === value);
                if (!preset) return;
                setEditingItem({
                  modelId: preset.modelId,
                  modelName: preset.label,
                  category: 'CHAT',
                  coinCost: preset.coinCost,
                  isActive: true,
                });
                setIsModalOpen(true);
              }}
            >
              {chatPresets.map((p) => (
                <Option key={p.modelId} value={p.modelId}>{p.group} · {p.label}</Option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>图片模型快捷导入</FormLabel>
            <Select
              placeholder="选择后自动填充"
              onChange={(_, value) => {
                if (!value) return;
                const preset = imagePresets.find((p) => p.modelId === value);
                if (!preset) return;
                setEditingItem({
                  modelId: preset.modelId,
                  modelName: preset.label,
                  category: 'IMAGE',
                  coinCost: preset.coinCost,
                  isActive: true,
                });
                setIsModalOpen(true);
              }}
            >
              {imagePresets.map((p) => (
                <Option key={p.modelId} value={p.modelId}>{p.label}</Option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>视频模型快捷导入</FormLabel>
            <Select
              placeholder="选择后自动填充"
              onChange={(_, value) => {
                if (!value) return;
                const preset = videoPresets.find((p) => p.modelId === value);
                if (!preset) return;
                setEditingItem({
                  modelId: preset.modelId,
                  modelName: preset.label,
                  category: 'VIDEO',
                  coinCost: preset.coinCost,
                  isActive: true,
                });
                setIsModalOpen(true);
              }}
            >
              {videoPresets.map((p) => (
                <Option key={p.modelId} value={p.modelId}>{p.label}</Option>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Button
            size="sm"
            variant="soft"
            color="primary"
            loading={bulkLoading === 'CHAT'}
            onClick={() => handleBulkImport('CHAT')}
          >
            一键导入文本模型
          </Button>
          <Button
            size="sm"
            variant="soft"
            color="success"
            loading={bulkLoading === 'IMAGE'}
            onClick={() => handleBulkImport('IMAGE')}
          >
            一键导入图片模型
          </Button>
          <Button
            size="sm"
            variant="soft"
            color="warning"
            loading={bulkLoading === 'VIDEO'}
            onClick={() => handleBulkImport('VIDEO')}
          >
            一键导入视频模型
          </Button>
        </Box>

        <Box sx={{ overflow: 'auto' }}>
          <Table stickyHeader hoverRow>
            <thead>
              <tr>
                <th>模型 ID (Identifier)</th>
                <th>显示名称 (Display Name)</th>
                <th>分类</th>
                <th>金币单价 (Coin Cost)</th>
                <th>状态</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}><CircularProgress /></td></tr>
              ) : (pricing || [])
                .filter((p: any) => activeCategory === 'ALL' || p.category === activeCategory)
                .map((p: any) => (
                <tr key={p.id}>
                  <td><Typography level="body-xs" fontWeight="bold">{p.modelId}</Typography></td>
                  <td><Typography level="body-sm">{p.modelName}</Typography></td>
                  <td>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={p.category === 'CHAT' ? 'primary' : p.category === 'VIDEO' ? 'warning' : 'success'}
                    >
                      {p.category}
                    </Chip>
                  </td>
                  <td><Typography level="body-sm" fontWeight="bold" color="primary">🪙 {p.coinCost}</Typography></td>
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.isActive ? 'success.500' : 'neutral.500' }} />
                      <Typography level="body-xs">{p.isActive ? '启用' : '禁用'}</Typography>
                    </Box>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <IconButton size="sm" variant="outlined" onClick={() => handleOpenModal(p)}><EditIcon /></IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>

        <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <ModalDialog sx={{ minWidth: 400 }}>
            <Typography level="h4">{editingItem?.id ? '编辑模型' : '新增模型'}</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <FormControl>
                <FormLabel>模型 ID (必须与前端发送的 ID 一致)</FormLabel>
                <Input 
                  value={editingItem?.modelId} 
                  onChange={(e: any) => setEditingItem({ ...editingItem, modelId: e.target.value })} 
                  disabled={!!editingItem?.id}
                />
              </FormControl>
              <FormControl>
                <FormLabel>显示名称</FormLabel>
                <Input 
                  value={editingItem?.modelName} 
                  onChange={(e: any) => setEditingItem({ ...editingItem, modelName: e.target.value })} 
                />
              </FormControl>
              <FormControl>
                <FormLabel>分类</FormLabel>
                <Select 
                  value={editingItem?.category} 
                  onChange={(_: any, v: any) => setEditingItem({ ...editingItem, category: v })}
                >
                  <Option value="CHAT">对话 (CHAT)</Option>
                  <Option value="IMAGE">绘图 (IMAGE)</Option>
                  <Option value="VIDEO">视频 (VIDEO)</Option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>消耗金币 (单次调用)</FormLabel>
                <Input 
                  type="number"
                  value={editingItem?.coinCost} 
                  onChange={(e: any) => setEditingItem({ ...editingItem, coinCost: parseInt(e.target.value) })} 
                />
              </FormControl>
              <Checkbox 
                label="激活并启用" 
                checked={editingItem?.isActive} 
                onChange={(e: any) => setEditingItem({ ...editingItem, isActive: e.target.checked })} 
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                <Button variant="outlined" onClick={() => setIsModalOpen(false)}>取消</Button>
                <Button onClick={handleSave} loading={updatePricingMutation.isPending}>保存</Button>
              </Box>
            </Stack>
          </ModalDialog>
        </Modal>
      </CardContent>
    </Card>
  );
}
