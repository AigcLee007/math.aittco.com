import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Modal,
  ModalDialog,
  Stack,
  Table,
  Typography,
} from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';

import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';

type InvitationForm = {
  code: string;
  maxUses: number;
  rewardCoins: number;
  expiresAt: string;
};

const DEFAULT_FORM: InvitationForm = {
  code: '',
  maxUses: 1,
  rewardCoins: 0,
  expiresAt: '',
};

const ADMIN_INVITATION_REWARD_LIMIT = 20;

function formatDateTime(date?: Date | string | null): string {
  if (!date)
    return '永久有效';

  const value = new Date(date);
  if (Number.isNaN(value.getTime()))
    return '永久有效';

  return value.toLocaleString('zh-CN', { hour12: false });
}

export function InvitationsSection() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const rewardLimit = isSuperAdmin ? Number.POSITIVE_INFINITY : ADMIN_INVITATION_REWARD_LIMIT;

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<InvitationForm>(DEFAULT_FORM);
  const [feedback, setFeedback] = React.useState<{ color: 'success' | 'danger'; message: string } | null>(null);

  const { data: codes, isLoading, refetch } = (apiQuery.admin.getInvitationCodes as any).useQuery();

  const createMutation = (apiQuery.admin.createInvitationCode as any).useMutation({
    onSuccess: () => {
      setFeedback({ color: 'success', message: '邀请码已创建。' });
      setIsModalOpen(false);
      setForm(DEFAULT_FORM);
      refetch();
    },
    onError: (error: any) => {
      setFeedback({ color: 'danger', message: error?.message || '邀请码创建失败，请稍后重试。' });
    },
  });

  const deleteMutation = (apiQuery.admin.deleteInvitationCode as any).useMutation({
    onSuccess: () => {
      setFeedback({ color: 'success', message: '邀请码已删除。' });
      refetch();
    },
    onError: (error: any) => {
      setFeedback({ color: 'danger', message: error?.message || '邀请码删除失败，请稍后重试。' });
    },
  });

  const generateRandomCode = React.useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++)
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    setForm((prev) => ({ ...prev, code: result }));
  }, []);

  const resetFormAndOpen = () => {
    setFeedback(null);
    setForm(DEFAULT_FORM);
    setIsModalOpen(true);
    generateRandomCode();
  };

  const handleCreate = () => {
    const code = form.code.trim().toUpperCase();
    const maxUses = Math.max(1, Number(form.maxUses) || 1);
    const rewardCoins = Math.max(0, Number(form.rewardCoins) || 0);

    if (!code) {
      setFeedback({ color: 'danger', message: '请输入邀请码。' });
      return;
    }

    if (maxUses < 1) {
      setFeedback({ color: 'danger', message: '可用次数至少为 1。' });
      return;
    }

    if (rewardCoins < 0) {
      setFeedback({ color: 'danger', message: '奖励金币不能为负数。' });
      return;
    }

    if (rewardCoins > rewardLimit) {
      setFeedback({ color: 'danger', message: `管理员创建邀请码时，最多只能赠送 ${ADMIN_INVITATION_REWARD_LIMIT} 金币。` });
      return;
    }

    createMutation.mutate({
      code,
      maxUses,
      rewardCoins: Math.min(rewardCoins, rewardLimit),
      expiresAt: form.expiresAt ? new Date(form.expiresAt) : undefined,
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ color: 'success', message: `邀请码 ${text} 已复制。` });
    } catch {
      setFeedback({ color: 'danger', message: '复制失败，请手动复制。' });
    }
  };

  return (
    <Card variant='outlined'>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box>
            <Typography level='title-lg'>邀请码管理</Typography>
            <Typography level='body-sm' sx={{ opacity: 0.72, mt: 0.5 }}>
              可控制邀请码使用次数、过期时间，以及用户注册成功后获得的额外金币。
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button startDecorator={<AddIcon />} onClick={resetFormAndOpen}>
              新建邀请码
            </Button>
            <IconButton variant='outlined' onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {feedback && (
          <Alert color={feedback.color} sx={{ mb: 2 }}>
            {feedback.message}
          </Alert>
        )}

        {!isSuperAdmin && (
          <Alert color='warning' variant='soft' sx={{ mb: 2 }}>
            当前账号为管理员，创建邀请码时最多只能赠送 {ADMIN_INVITATION_REWARD_LIMIT} 金币。
          </Alert>
        )}

        <Box sx={{ overflow: 'auto' }}>
          <Table stickyHeader hoverRow>
            <thead>
              <tr>
                <th>邀请码</th>
                <th>使用情况</th>
                <th>奖励金币</th>
                <th>有效期</th>
                <th>创建时间</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                    <CircularProgress />
                  </td>
                </tr>
              ) : (codes || []).length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                    暂无邀请码记录
                  </td>
                </tr>
              ) : (
                (codes || []).map((item: any) => {
                  const isExpired = item.expiresAt ? new Date(item.expiresAt).getTime() < Date.now() : false;
                  const isExhausted = item.usedCount >= item.maxUses;
                  return (
                    <tr key={item.id}>
                      <td>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography level='body-md' fontWeight='lg' sx={{ letterSpacing: '0.08em' }}>
                            {item.code}
                          </Typography>
                          <IconButton size='sm' variant='plain' onClick={() => copyToClipboard(item.code)}>
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </td>
                      <td>
                        <Typography level='body-sm'>
                          {item.usedCount} / {item.maxUses}
                        </Typography>
                        <Typography
                          level='body-xs'
                          sx={{ mt: 0.5, color: isExpired ? 'danger.600' : isExhausted ? 'warning.600' : 'success.700' }}
                        >
                          {isExpired ? '已过期' : isExhausted ? '次数已用完' : '可正常使用'}
                        </Typography>
                      </td>
                      <td>{item.rewardCoins ?? 0}</td>
                      <td>{formatDateTime(item.expiresAt)}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <IconButton
                          size='sm'
                          color='danger'
                          variant='plain'
                          loading={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`确定删除邀请码 ${item.code} 吗？`))
                              deleteMutation.mutate({ id: item.id });
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </Box>

        <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <ModalDialog sx={{ width: 460, maxWidth: 'calc(100vw - 32px)' }}>
            <Typography level='title-md'>新建邀请码</Typography>
            <Typography level='body-sm' sx={{ opacity: 0.7, mt: 0.5 }}>
              可为新注册用户发放额外金币。过期时间留空时，邀请码将长期有效。
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={2}>
              <FormControl>
                <FormLabel>邀请码内容</FormLabel>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    sx={{ flex: 1 }}
                  />
                  <Button variant='soft' onClick={generateRandomCode}>
                    随机生成
                  </Button>
                </Box>
              </FormControl>

              <FormControl>
                <FormLabel>可用次数</FormLabel>
                <Input
                  type='number'
                  value={form.maxUses}
                  onChange={(e) => setForm((prev) => ({ ...prev, maxUses: parseInt(e.target.value || '1', 10) || 1 }))}
                />
              </FormControl>

              <FormControl>
                <FormLabel>奖励金币</FormLabel>
                <Input
                  type='number'
                  value={form.rewardCoins}
                  slotProps={!isSuperAdmin ? { input: { min: '0', max: String(ADMIN_INVITATION_REWARD_LIMIT) } } : undefined}
                  onChange={(e) => {
                    const nextValue = parseInt(e.target.value || '0', 10) || 0;
                    setForm((prev) => ({
                      ...prev,
                      rewardCoins: isSuperAdmin ? nextValue : Math.min(ADMIN_INVITATION_REWARD_LIMIT, Math.max(0, nextValue)),
                    }));
                  }}
                />
                {!isSuperAdmin && (
                  <Typography level='body-xs' sx={{ mt: 0.5, opacity: 0.7 }}>
                    管理员上限：{ADMIN_INVITATION_REWARD_LIMIT} 金币
                  </Typography>
                )}
              </FormControl>

              <FormControl>
                <FormLabel>过期时间</FormLabel>
                <Input
                  type='datetime-local'
                  value={form.expiresAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                />
                <Typography level='body-xs' sx={{ mt: 0.5, opacity: 0.65 }}>
                  留空表示永久有效。
                </Typography>
              </FormControl>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button variant='plain' color='neutral' onClick={() => setIsModalOpen(false)}>
                  取消
                </Button>
                <Button loading={createMutation.isPending} onClick={handleCreate}>
                  保存邀请码
                </Button>
              </Box>
            </Stack>
          </ModalDialog>
        </Modal>
      </CardContent>
    </Card>
  );
}
