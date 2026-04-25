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
  Stack,
  Table,
  Typography,
} from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';

type RedeemCodeForm = {
  code: string;
  coinAmount: number;
  totalUseLimit: number | null;
  coinExpireDays: number | null;
  validFrom: string;
  expiresAt: string;
  onlyExistingUsers: boolean;
  isActive: boolean;
  description: string;
};

const DEFAULT_FORM: RedeemCodeForm = {
  code: '',
  coinAmount: 30,
  totalUseLimit: 1,
  coinExpireDays: null,
  validFrom: '',
  expiresAt: '',
  onlyExistingUsers: false,
  isActive: true,
  description: '',
};

function randomCode(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function toDateTimeInput(date?: Date | null): string {
  if (!date)
    return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${min}`;
}

export function RedeemCodesSection() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [form, setForm] = React.useState<RedeemCodeForm>({
    ...DEFAULT_FORM,
    code: randomCode(),
  });

  const { data, isLoading, refetch } = (apiQuery.admin.getRedeemCodes as any).useQuery(undefined, {
    enabled: isSuperAdmin,
  });

  const upsertMutation = (apiQuery.admin.upsertRedeemCode as any).useMutation({
    onSuccess: () => {
      refetch();
      setForm({ ...DEFAULT_FORM, code: randomCode() });
    },
  });
  const statusMutation = (apiQuery.admin.setRedeemCodeStatus as any).useMutation({
    onSuccess: () => refetch(),
  });
  const deleteMutation = (apiQuery.admin.deleteRedeemCode as any).useMutation({
    onSuccess: () => refetch(),
  });

  const onSave = () => {
    if (!form.code.trim())
      return;
    upsertMutation.mutate({
      code: form.code.trim().toUpperCase(),
      coinAmount: Number(form.coinAmount),
      totalUseLimit: form.totalUseLimit,
      coinExpireDays: form.coinExpireDays,
      validFrom: form.validFrom ? new Date(form.validFrom) : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
      onlyExistingUsers: form.onlyExistingUsers,
      isActive: form.isActive,
      description: form.description.trim() || undefined,
    });
  };

  if (!isSuperAdmin) {
    return (
      <Alert color='warning' variant='soft'>
        仅超级管理员可维护兑换码。
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Card variant='outlined'>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography level='title-lg'>兑换码管理</Typography>
            <IconButton variant='outlined' onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Box>

          <Alert variant='soft' color='neutral' sx={{ mb: 2 }}>
            常规码建议设置总次数为 1。福利码可设置更大总次数，并勾选“仅老用户可用（新用户不可用）”。
          </Alert>

          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <FormControl>
              <FormLabel>兑换码</FormLabel>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
                <Button
                  variant='soft'
                  onClick={() => setForm({ ...form, code: randomCode() })}
                >
                  随机
                </Button>
              </Box>
            </FormControl>

            <FormControl>
              <FormLabel>兑换金币</FormLabel>
              <Input
                type='number'
                value={String(form.coinAmount)}
                onChange={(e) => setForm({ ...form, coinAmount: Number(e.target.value || '0') })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>总可用次数</FormLabel>
              <Input
                type='number'
                value={form.totalUseLimit === null ? '' : String(form.totalUseLimit)}
                placeholder='留空表示不限次数'
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setForm({ ...form, totalUseLimit: value ? Number(value) : null });
                }}
              />
            </FormControl>

            <FormControl>
              <FormLabel>兑换金币有效期(天)</FormLabel>
              <Input
                type='number'
                value={form.coinExpireDays === null ? '' : String(form.coinExpireDays)}
                placeholder='留空表示金币不限时'
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setForm({ ...form, coinExpireDays: value ? Number(value) : null });
                }}
              />
            </FormControl>

            <FormControl>
              <FormLabel>生效时间</FormLabel>
              <Input
                type='datetime-local'
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>过期时间</FormLabel>
              <Input
                type='datetime-local'
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>老用户限制</FormLabel>
              <Button
                variant={form.onlyExistingUsers ? 'solid' : 'outlined'}
                color={form.onlyExistingUsers ? 'warning' : 'neutral'}
                onClick={() => setForm({ ...form, onlyExistingUsers: !form.onlyExistingUsers })}
              >
                {form.onlyExistingUsers ? '仅老用户可用（新用户不可用）' : '所有用户可用'}
              </Button>
            </FormControl>

            <FormControl>
              <FormLabel>状态</FormLabel>
              <Button
                variant={form.isActive ? 'solid' : 'outlined'}
                color={form.isActive ? 'success' : 'neutral'}
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
              >
                {form.isActive ? '启用' : '禁用'}
              </Button>
            </FormControl>

            <FormControl sx={{ gridColumn: { xs: '1', md: '1 / span 2' } }}>
              <FormLabel>备注</FormLabel>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder='如：3月活动福利码'
              />
            </FormControl>
          </Box>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button startDecorator={<AddIcon />} onClick={onSave} loading={upsertMutation.isPending}>
              保存兑换码
            </Button>
            <Button
              variant='outlined'
              color='neutral'
              onClick={() => setForm({ ...DEFAULT_FORM, code: randomCode() })}
            >
              清空
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card variant='outlined'>
        <CardContent>
          <Typography level='title-md' sx={{ mb: 2 }}>兑换码列表</Typography>
          {isLoading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>
          ) : (
            <Box sx={{ overflow: 'auto' }}>
              <Table stickyHeader hoverRow>
                <thead>
                  <tr>
                    <th>兑换码</th>
                    <th>金币</th>
                    <th>使用情况</th>
                    <th>规则</th>
                    <th>有效期</th>
                    <th>状态</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(data || []).map((item: any) => (
                    <tr key={item.id}>
                      <td>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography level='body-sm' fontWeight='lg'>{item.code}</Typography>
                          <IconButton size='sm' variant='plain' onClick={() => navigator.clipboard.writeText(item.code)}>
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                        {item.description && <Typography level='body-xs' sx={{ opacity: 0.7 }}>{item.description}</Typography>}
                      </td>
                      <td>{item.coinAmount}</td>
                      <td>{item.usedCount} / {item.totalUseLimit ?? '不限'}</td>
                      <td>
                        <Typography level='body-xs'>
                          {item.onlyExistingUsers ? '仅老用户可用' : '所有用户可用'}
                        </Typography>
                        <Typography level='body-xs' sx={{ opacity: 0.7 }}>
                          每人限兑 1 次
                        </Typography>
                      </td>
                      <td>
                        <Typography level='body-xs'>起: {item.validFrom ? new Date(item.validFrom).toLocaleString() : '立即'}</Typography>
                        <Typography level='body-xs'>止: {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : '不限'}</Typography>
                      </td>
                      <td>
                        <Chip size='sm' color={item.isActive ? 'success' : 'neutral'}>
                          {item.isActive ? '启用' : '停用'}
                        </Chip>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                          <IconButton
                            size='sm'
                            variant='outlined'
                            onClick={() => setForm({
                              code: item.code,
                              coinAmount: item.coinAmount,
                              totalUseLimit: item.totalUseLimit ?? null,
                              coinExpireDays: item.coinExpireDays ?? null,
                              validFrom: toDateTimeInput(item.validFrom),
                              expiresAt: toDateTimeInput(item.expiresAt),
                              onlyExistingUsers: !!item.onlyExistingUsers,
                              isActive: !!item.isActive,
                              description: item.description || '',
                            })}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size='sm'
                            variant='outlined'
                            color={item.isActive ? 'warning' : 'success'}
                            loading={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: item.id, isActive: !item.isActive })}
                          >
                            {item.isActive ? <PauseCircleOutlineIcon /> : <PlayCircleOutlineIcon />}
                          </IconButton>
                          <IconButton
                            size='sm'
                            variant='outlined'
                            color='danger'
                            loading={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate({ id: item.id })}
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
    </Stack>
  );
}
