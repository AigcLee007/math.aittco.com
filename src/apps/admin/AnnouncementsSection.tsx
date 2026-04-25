import * as React from 'react';
import { Box, Card, CardContent, Typography, Button, Input, Select, Option, Stack, FormControl, FormLabel, Textarea, Checkbox, CircularProgress, IconButton, Grid, Chip, AspectRatio } from '@mui/joy';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import { ContactService } from '~/common/components/ContactService';

// 简单的文件上传辅助函数
async function uploadAnnouncementImage(file: File, token: string | null): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/admin/announcement/upload', {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || '上传图片失败');
  }

  const data = await response.json();
  return data.url; // 返回相对路径，如 /uploads/announcements/xxx.png
}

export function AnnouncementsSection() {
  const { accessToken } = useAuthStore.getState();
  const { data: announcements, isLoading, refetch } = (apiQuery.admin.getAnnouncements as any).useQuery();
  
  const [newAnn, setNewAnn] = React.useState({ title: '', content: '', type: 'info', imageUrl: '', isActive: true });
  const [isUploading, setIsUploading] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const createMutation = (apiQuery.admin.createAnnouncement as any).useMutation({
    onSuccess: () => {
      refetch();
      setNewAnn({ title: '', content: '', type: 'info', imageUrl: '', isActive: true });
      setErrorText(null);
    },
    onError: (err: any) => {
      console.error('Failed to create announcement:', err);
      setErrorText(err.message || '发布失败，请检查数据库连接或输入。');
    }
  });

  const deleteMutation = (apiQuery.admin.deleteAnnouncement as any).useMutation({
    onSuccess: () => refetch(),
    onError: (err: any) => {
      alert('删除失败: ' + err.message);
    }
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorText(null);
    try {
      const imageUrl = await uploadAnnouncementImage(file, accessToken);
      setNewAnn(prev => ({ ...prev, imageUrl }));
    } catch (err: any) {
      setErrorText(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreate = () => {
    if (!newAnn.title || !newAnn.content) return;
    setErrorText(null);
    createMutation.mutate(newAnn);
  };

  return (
    <Grid container spacing={2}>
      <Grid xs={12} md={4}>
        <Card variant="outlined">
          <CardContent>
            <Typography level="title-md" sx={{ mb: 2 }}>发布新公告</Typography>
            <Stack spacing={2}>
              <FormControl error={!!errorText && !newAnn.title}>
                <FormLabel>标题</FormLabel>
                <Input 
                  value={newAnn.title} 
                  onChange={(e: any) => setNewAnn({ ...newAnn, title: e.target.value })} 
                  placeholder="公告标题"
                />
              </FormControl>
              <FormControl error={!!errorText && !newAnn.content}>
                <FormLabel>内容 (支持简单的文本)</FormLabel>
                <Textarea 
                  minRows={3} 
                  value={newAnn.content} 
                  onChange={(e: any) => setNewAnn({ ...newAnn, content: e.target.value })} 
                  placeholder="公告详细内容..."
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>公告配图 (上传图片)</FormLabel>
                <Button
                  component="label"
                  role={undefined}
                  tabIndex={-1}
                  variant="outlined"
                  color="neutral"
                  startDecorator={isUploading ? <CircularProgress size="sm" /> : <CloudUploadIcon />}
                  loading={isUploading}
                >
                  {newAnn.imageUrl ? '更换图片' : '上传图片'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </Button>
                {newAnn.imageUrl && (
                  <Box sx={{ mt: 1, position: 'relative' }}>
                    <AspectRatio ratio="16/9" sx={{ borderRadius: 'sm', overflow: 'hidden' }}>
                      <img src={newAnn.imageUrl} alt="preview" width={400} height={225} />
                    </AspectRatio>
                    <IconButton
                      size="sm"
                      variant="solid"
                      color="danger"
                      sx={{ position: 'absolute', top: 4, right: 4, borderRadius: '50%' }}
                      onClick={() => setNewAnn(prev => ({ ...prev, imageUrl: '' }))}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                )}
              </FormControl>

              <FormControl>
                <FormLabel>颜色类型</FormLabel>
                <Select value={newAnn.type} onChange={(_: any, v: any) => setNewAnn({ ...newAnn, type: (v as string) || 'info' })}>
                  <Option value="info">常规 (Blue)</Option>
                  <Option value="success">成功 (Green)</Option>
                  <Option value="warning">提醒 (Yellow)</Option>
                  <Option value="danger">紧急 (Red)</Option>
                </Select>
              </FormControl>
              <Checkbox 
                label="立即发布并显示" 
                checked={newAnn.isActive} 
                onChange={(e: any) => setNewAnn({ ...newAnn, isActive: e.target.checked })} 
              />
              
              {errorText && (
                <Typography level="body-xs" color="danger" sx={{ fontWeight: 600 }}>
                  错误: {errorText}
                </Typography>
              )}

              <Button 
                startDecorator={<CloudUploadIcon />} 
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!newAnn.title || !newAnn.content || isUploading}
              >
                全部发布
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid xs={12} md={8}>
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography level="title-md">现有公告列表</Typography>
              <IconButton size="sm" onClick={() => refetch()}><RefreshIcon /></IconButton>
            </Box>
            <Stack spacing={2}>
              {isLoading ? (
                <CircularProgress sx={{ mx: 'auto', my: 2 }} />
              ) : (announcements || []).map((a: any) => (
                <Card key={a.id} variant="soft" color={a.type as any} sx={{ position: 'relative' }}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    {a.imageUrl && (
                      <Box sx={{ width: 100, flexShrink: 0 }}>
                        <AspectRatio ratio="1" sx={{ borderRadius: 'sm', overflow: 'hidden' }}>
                          <img src={a.imageUrl} alt={a.title} loading="lazy" width={100} height={100} />
                        </AspectRatio>
                      </Box>
                    )}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography level="title-sm" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {a.title}
                        {!a.isActive && <Chip size="sm" variant="outlined">已隐藏</Chip>}
                      </Typography>
                      <Typography level="body-xs" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{a.content}</Typography>
                      <Typography level="body-xs" sx={{ mt: 1, opacity: 0.6 }}>发布时间: {new Date(a.createdAt).toLocaleString()}</Typography>
                    </Box>
                    <IconButton 
                      size="sm" 
                      color="danger" 
                      variant="plain"
                      onClick={() => {
                        if (confirm('确定要删除这条公告吗？')) {
                          deleteMutation.mutate({ id: a.id });
                        }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Card>
              ))}
              {!isLoading && announcements?.length === 0 && <Typography sx={{ textAlign: 'center', opacity: 0.5, my: 4 }}>暂无公告</Typography>}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
