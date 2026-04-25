import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';

type PackageForm = {
  packageId: string;
  label: string;
  amountYuan: number;
  coinAmount: number;
  expiresInDays: number | null;
  isActive: boolean;
  popular: boolean;
  sortOrder: number;
};

const DEFAULT_FORM: PackageForm = {
  packageId: '',
  label: '',
  amountYuan: 30,
  coinAmount: 900,
  expiresInDays: null,
  isActive: true,
  popular: false,
  sortOrder: 0,
};

export function RechargePackagesSection() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [form, setForm] = React.useState<PackageForm>(DEFAULT_FORM);
  const [validationError, setValidationError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');

  const { data, isLoading, refetch } = (apiQuery.admin.getRechargePackageConfigs as any).useQuery(undefined, {
    enabled: isSuperAdmin,
  });

  const upsertMutation = (apiQuery.admin.upsertRechargePackageConfig as any).useMutation({
    onSuccess: () => {
      refetch();
      setForm(DEFAULT_FORM);
      setValidationError('');
      setSuccessMessage('套餐已保存。');
    },
  });

  const deleteMutation = (apiQuery.admin.deleteRechargePackageConfig as any).useMutation({
    onSuccess: () => {
      refetch();
      setSuccessMessage('套餐已删除。');
    },
  });

  const currentError = validationError || upsertMutation.error?.message || deleteMutation.error?.message || '';

  const onSave = () => {
    if (!form.packageId.trim() || !form.label.trim()) {
      setValidationError('套餐 ID 和套餐名称不能为空。');
      setSuccessMessage('');
      return;
    }
    if (!Number.isFinite(Number(form.amountYuan)) || Number(form.amountYuan) <= 0) {
      setValidationError('价格必须大于 0。');
      setSuccessMessage('');
      return;
    }
    if (!Number.isFinite(Number(form.coinAmount)) || Number(form.coinAmount) <= 0) {
      setValidationError('金币数必须大于 0。');
      setSuccessMessage('');
      return;
    }
    if (form.expiresInDays !== null && (!Number.isFinite(Number(form.expiresInDays)) || Number(form.expiresInDays) <= 0)) {
      setValidationError('有效期要么留空，要么填写大于 0 的整数。');
      setSuccessMessage('');
      return;
    }

    setValidationError('');
    setSuccessMessage('');

    upsertMutation.mutate({
      packageId: form.packageId.trim(),
      label: form.label.trim(),
      amountYuan: Number(form.amountYuan),
      coinAmount: Number(form.coinAmount),
      expiresInDays: form.expiresInDays,
      isActive: form.isActive,
      popular: form.popular,
      sortOrder: Number(form.sortOrder),
    });
  };

  if (!isSuperAdmin) {
    return (
      <Alert color="warning" variant="soft">
        仅超级管理员可维护充值套餐。
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography level="title-lg">充值套餐配置</Typography>
            <IconButton variant="outlined" onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Box>

          <Alert variant="soft" color="neutral" sx={{ mb: 2 }}>
            支持配置不限时套餐和限时套餐。有效期留空表示不限时，例如填写 30 表示 30 天有效。
          </Alert>

          {currentError && (
            <Alert color="danger" variant="soft" sx={{ mb: 2 }}>
              {currentError}
            </Alert>
          )}

          {!currentError && successMessage && (
            <Alert color="success" variant="soft" sx={{ mb: 2 }}>
              {successMessage}
            </Alert>
          )}

          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <FormControl>
              <FormLabel>套餐 ID</FormLabel>
              <Input
                placeholder="month_30_900"
                value={form.packageId}
                onChange={(e) => setForm({ ...form, packageId: e.target.value })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>套餐名称</FormLabel>
              <Input
                placeholder="月包 900 金币"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>价格（元）</FormLabel>
              <Input
                type="number"
                value={String(form.amountYuan)}
                onChange={(e) => setForm({ ...form, amountYuan: Number(e.target.value || '0') })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>金币数</FormLabel>
              <Input
                type="number"
                value={String(form.coinAmount)}
                onChange={(e) => setForm({ ...form, coinAmount: Number(e.target.value || '0') })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>有效期（天）</FormLabel>
              <Input
                type="number"
                value={form.expiresInDays === null ? '' : String(form.expiresInDays)}
                placeholder="留空代表不限时"
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setForm({
                    ...form,
                    expiresInDays: value ? Number(value) : null,
                  });
                }}
              />
            </FormControl>

            <FormControl>
              <FormLabel>排序</FormLabel>
              <Input
                type="number"
                value={String(form.sortOrder)}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value || '0') })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>状态</FormLabel>
              <Select
                value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(_, value) => setForm({ ...form, isActive: value === 'ACTIVE' })}
              >
                <Option value="ACTIVE">启用</Option>
                <Option value="INACTIVE">禁用</Option>
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>推荐位</FormLabel>
              <Select
                value={form.popular ? 'YES' : 'NO'}
                onChange={(_, value) => setForm({ ...form, popular: value === 'YES' })}
              >
                <Option value="YES">推荐</Option>
                <Option value="NO">普通</Option>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button startDecorator={<AddIcon />} onClick={onSave} loading={upsertMutation.isPending}>
              保存套餐
            </Button>
            <Button
              variant="outlined"
              color="neutral"
              onClick={() => {
                setForm(DEFAULT_FORM);
                setValidationError('');
                setSuccessMessage('');
              }}
            >
              清空
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography level="title-md" sx={{ mb: 2 }}>
            已配置套餐
          </Typography>

          {isLoading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ overflow: 'auto' }}>
              <Table stickyHeader hoverRow>
                <thead>
                  <tr>
                    <th>套餐 ID</th>
                    <th>名称</th>
                    <th>价格</th>
                    <th>金币</th>
                    <th>有效期</th>
                    <th>状态</th>
                    <th>推荐</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(data || []).map((item: any) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.label}</td>
                      <td>￥{item.amountYuan}</td>
                      <td>{item.coinAmount}</td>
                      <td>{item.expiresInDays ? `${item.expiresInDays} 天` : '不限时'}</td>
                      <td>{item.isActive ? '启用' : '禁用'}</td>
                      <td>{item.popular ? '是' : '否'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
                          <IconButton
                            size="sm"
                            variant="outlined"
                            onClick={() => {
                              setValidationError('');
                              setSuccessMessage('');
                              setForm({
                                packageId: item.id,
                                label: item.label,
                                amountYuan: item.amountYuan,
                                coinAmount: item.coinAmount,
                                expiresInDays: item.expiresInDays ?? null,
                                isActive: item.isActive,
                                popular: !!item.popular,
                                sortOrder: item.sortOrder ?? 0,
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
                            onClick={() => {
                              setValidationError('');
                              setSuccessMessage('');
                              deleteMutation.mutate({ packageId: item.id });
                            }}
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
