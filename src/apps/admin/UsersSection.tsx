import * as React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Modal,
  ModalDialog,
  Option,
  Select,
  Stack,
  Table,
  Textarea,
  Tooltip,
  Typography,
} from '@mui/joy';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyIcon from '@mui/icons-material/Key';
import PaidIcon from '@mui/icons-material/Paid';
import InfoIcon from '@mui/icons-material/Info';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';

interface User {
  id: string;
  shortId?: number;
  username?: string;
  email: string;
  nickname: string;
  avatar?: string;
  coinBalance: number;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  lastLoginAt?: string;
  lastLoginIP?: string;
  adminNotes?: string;
  tags?: string;
  createdAt: string;
}

type LoginFilter = 'RECENT' | 'NEVER' | null;
type BalanceFilter = 'POSITIVE' | 'ZERO' | null;

const PAGE_SIZE = 50;

export function UsersSection() {
  const [searchInput, setSearchInput] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<User['role'] | null>(null);
  const [loginFilter, setLoginFilter] = React.useState<LoginFilter>(null);
  const [balanceFilter, setBalanceFilter] = React.useState<BalanceFilter>(null);
  const [privilegedOnly, setPrivilegedOnly] = React.useState(false);
  const [createdFrom, setCreatedFrom] = React.useState('');
  const [createdTo, setCreatedTo] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [pageInput, setPageInput] = React.useState('1');

  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [balanceModal, setBalanceModal] = React.useState<{ open: boolean; userId: string; nickname: string }>({
    open: false,
    userId: '',
    nickname: '',
  });
  const [balanceAmount, setBalanceAmount] = React.useState(0);
  const [balanceDesc, setBalanceDesc] = React.useState('管理员手动调整');

  const [notesModal, setNotesModal] = React.useState<{ open: boolean; userId: string; notes: string; tags: string }>({
    open: false,
    userId: '',
    notes: '',
    tags: '',
  });

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(0);
  }, [roleFilter, loginFilter, balanceFilter, privilegedOnly, createdFrom, createdTo]);

  const {
    data: usersData,
    isLoading,
    isFetching,
    refetch,
  } = (apiQuery.admin.getAllUsers as any).useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: searchTerm || undefined,
    role: roleFilter || undefined,
    loginState: loginFilter || undefined,
    balanceState: balanceFilter || undefined,
    privilegedOnly: privilegedOnly || undefined,
    createdFrom: createdFrom || undefined,
    createdTo: createdTo || undefined,
  });

  const users: User[] = usersData?.users || [];
  const totalUsers = usersData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));

  React.useEffect(() => {
    setPageInput(String(Math.min(page + 1, totalPages)));
  }, [page, totalPages]);

  const updateStatusMutation = (apiQuery.admin.updateUserStatus as any).useMutation({
    onSuccess: () => refetch(),
  });
  const updateRoleMutation = (apiQuery.admin.updateUserRole as any).useMutation({
    onSuccess: () => refetch(),
  });
  const resetPasswordMutation = (apiQuery.admin.resetUserPassword as any).useMutation({
    onSuccess: () => {
      alert('密码已重置为: 123456');
      refetch();
    },
  });
  const updateBalanceMutation = (apiQuery.admin.updateUserBalance as any).useMutation({
    onSuccess: () => {
      setBalanceModal((prev) => ({ ...prev, open: false }));
      refetch();
    },
  });
  const updateAdminFieldsMutation = (apiQuery.admin.updateUserAdminFields as any).useMutation({
    onSuccess: () => {
      setNotesModal((prev) => ({ ...prev, open: false }));
      refetch();
    },
  });

  const jumpToPage = React.useCallback(() => {
    const numericPage = Number(pageInput);
    if (!Number.isFinite(numericPage))
      return;
    const nextPage = Math.min(Math.max(1, Math.floor(numericPage)), totalPages);
    setPage(nextPage - 1);
  }, [pageInput, totalPages]);

  const clearFilters = React.useCallback(() => {
    setSearchInput('');
    setSearchTerm('');
    setRoleFilter(null);
    setLoginFilter(null);
    setBalanceFilter(null);
    setPrivilegedOnly(false);
    setCreatedFrom('');
    setCreatedTo('');
    setPage(0);
  }, []);

  return (
    <Card variant='outlined'>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Typography level='title-lg'>
            用户精细化管理
            {!isSuperAdmin && <Chip size='sm' color='warning' variant='soft' sx={{ ml: 1 }}>限制模式</Chip>}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Input
              startDecorator={<SearchIcon />}
              placeholder='搜索 ID / 昵称 / 用户名 / 邮箱'
              size='sm'
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              sx={{ width: 320 }}
            />

            <Select
              size='sm'
              placeholder='按角色筛选'
              value={roleFilter}
              onChange={(_, value) => setRoleFilter(value as User['role'] | null)}
              sx={{ width: 150 }}
            >
              <Option value={null}>全部角色</Option>
              <Option value='USER'>普通用户</Option>
              <Option value='ADMIN'>管理员</Option>
              <Option value='SUPER_ADMIN'>超级管理员</Option>
            </Select>

            <Select
              size='sm'
              placeholder='登录状态'
              value={loginFilter}
              onChange={(_, value) => setLoginFilter(value as LoginFilter)}
              sx={{ width: 170 }}
            >
              <Option value={null}>全部登录状态</Option>
              <Option value='RECENT'>最近登录（7天内）</Option>
              <Option value='NEVER'>从未登录</Option>
            </Select>

            <Select
              size='sm'
              placeholder='余额状态'
              value={balanceFilter}
              onChange={(_, value) => setBalanceFilter(value as BalanceFilter)}
              sx={{ width: 150 }}
            >
              <Option value={null}>全部余额</Option>
              <Option value='POSITIVE'>有余额</Option>
              <Option value='ZERO'>无余额</Option>
            </Select>

            <Input
              size='sm'
              type='date'
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              slotProps={{ input: { max: createdTo || undefined } }}
            />

            <Input
              size='sm'
              type='date'
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              slotProps={{ input: { min: createdFrom || undefined } }}
            />

            <Button size='sm' variant='outlined' color='neutral' onClick={clearFilters}>
              清空筛选
            </Button>

            <IconButton variant='outlined' size='sm' onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            variant={balanceFilter === 'POSITIVE' ? 'solid' : 'soft'}
            color={balanceFilter === 'POSITIVE' ? 'success' : 'neutral'}
            onClick={() => setBalanceFilter((current) => current === 'POSITIVE' ? null : 'POSITIVE')}
            sx={{ cursor: 'pointer' }}
          >
            有余额
          </Chip>
          <Chip
            variant={balanceFilter === 'ZERO' ? 'solid' : 'soft'}
            color={balanceFilter === 'ZERO' ? 'warning' : 'neutral'}
            onClick={() => setBalanceFilter((current) => current === 'ZERO' ? null : 'ZERO')}
            sx={{ cursor: 'pointer' }}
          >
            无余额
          </Chip>
          <Chip
            variant={privilegedOnly ? 'solid' : 'soft'}
            color={privilegedOnly ? 'danger' : 'neutral'}
            onClick={() => setPrivilegedOnly((current) => !current)}
            sx={{ cursor: 'pointer' }}
          >
            管理员 / 超级管理员
          </Chip>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Typography level='body-sm' sx={{ opacity: 0.75 }}>
            共 {totalUsers} 个用户，当前第 {Math.min(page + 1, totalPages)} / {totalPages} 页
            {isFetching ? ' · 正在更新...' : ''}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              size='sm'
              variant='outlined'
              disabled={page === 0 || isLoading}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              上一页
            </Button>

            <Input
              size='sm'
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  jumpToPage();
              }}
              sx={{ width: 90 }}
              endDecorator={<Typography level='body-xs'>页</Typography>}
            />

            <Button size='sm' variant='solid' onClick={jumpToPage} disabled={isLoading}>
              跳转
            </Button>

            <Button
              size='sm'
              variant='outlined'
              disabled={page + 1 >= totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
            >
              下一页
            </Button>
          </Box>
        </Box>

        <Box sx={{ overflow: 'auto' }}>
          <Table stickyHeader hoverRow sx={{ '& tr > *': { verticalAlign: 'middle' } }}>
            <thead>
              <tr>
                <th style={{ width: 100 }}>用户 ID</th>
                <th>基本信息</th>
                <th>账户与标签</th>
                <th>角色</th>
                <th>状态 / 审计</th>
                <th style={{ width: 220, textAlign: 'right' }}>快捷操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                    <CircularProgress />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                    未找到匹配的用户
                  </td>
                </tr>
              ) : users.map((u: User) => {
                const isPrivilegedUser = u.role === 'ADMIN' || u.role === 'SUPER_ADMIN';
                return (
                <tr
                  key={u.id}
                  style={isPrivilegedUser ? { backgroundColor: 'rgba(211, 47, 47, 0.06)' } : undefined}
                >
                  <td>
                    <Typography level='body-xs' fontWeight='bold' sx={{ fontFamily: 'monospace', color: 'primary.plainColor' }}>
                      #{u.shortId || '---'}
                    </Typography>
                  </td>
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar size='sm' src={u.avatar}>{u.nickname.charAt(0)}</Avatar>
                      <Box>
                        <Stack direction='row' spacing={0.5} alignItems='center'>
                          <Typography level='body-sm' fontWeight='bold'>{u.nickname}</Typography>
                          {u.username && <Typography level='body-xs' sx={{ opacity: 0.5 }}>@{u.username}</Typography>}
                          {isPrivilegedUser && (
                            <Chip size='sm' color='danger' variant='soft'>风险账号</Chip>
                          )}
                        </Stack>
                        <Typography level='body-xs' sx={{ opacity: 0.7 }}>{u.email}</Typography>
                        <Typography level='body-xs' sx={{ opacity: 0.55 }}>
                          注册时间: {new Date(u.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </td>
                  <td>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography level='body-sm' fontWeight='bold' color='primary'>金币 {u.coinBalance}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {u.tags
                          ? u.tags.split(',').map((tag) => (
                            <Chip key={tag} size='sm' variant='soft' color='neutral'>{tag}</Chip>
                          ))
                          : <Typography level='body-xs' sx={{ fontStyle: 'italic', opacity: 0.5 }}>暂无标签</Typography>}
                      </Box>
                    </Box>
                  </td>
                  <td>
                    <Stack direction='row' spacing={0.5} flexWrap='wrap'>
                      <Chip size='sm' variant='soft' color={u.role === 'SUPER_ADMIN' ? 'danger' : u.role === 'ADMIN' ? 'warning' : 'neutral'}>
                        {u.role}
                      </Chip>
                      {isPrivilegedUser && (
                        <Chip size='sm' variant='solid' color='danger'>
                          高权限
                        </Chip>
                      )}
                    </Stack>
                  </td>
                  <td>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                      <Chip size='sm' variant='solid' color={u.isActive ? 'success' : 'neutral'} sx={{ width: 'fit-content' }}>
                        {u.isActive ? '正常' : '封禁'}
                      </Chip>
                      <Typography level='body-xs' sx={{ mt: 0.5 }}>IP: {u.lastLoginIP || '从未登录'}</Typography>
                      <Typography level='body-xs'>
                        最后活跃: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '暂无'}
                      </Typography>
                    </Box>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title={isSuperAdmin ? '调整金币' : '权限不足'} size='sm'>
                        <span>
                          <IconButton
                            size='sm'
                            color='success'
                            disabled={!isSuperAdmin}
                            onClick={() => {
                              setBalanceModal({ open: true, userId: u.id, nickname: u.nickname });
                              setBalanceAmount(0);
                            }}
                          >
                            <PaidIcon />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title='备注与标签' size='sm'>
                        <IconButton
                          size='sm'
                          color='primary'
                          onClick={() => {
                            setNotesModal({ open: true, userId: u.id, notes: u.adminNotes || '', tags: u.tags || '' });
                          }}
                        >
                          <InfoIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={isSuperAdmin ? '重置密码 (123456)' : '权限不足'} size='sm'>
                        <span>
                          <IconButton
                            size='sm'
                            color='warning'
                            disabled={!isSuperAdmin}
                            onClick={() => {
                              if (confirm(`确定要将用户 ${u.nickname} 的密码重置为 123456 吗？`))
                                resetPasswordMutation.mutate({ userId: u.id });
                            }}
                          >
                            <KeyIcon />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title={!isSuperAdmin ? '权限不足' : (u.isActive ? '禁用用户' : '启用用户')} size='sm'>
                        <span>
                          <IconButton
                            size='sm'
                            color={u.isActive ? 'danger' : 'success'}
                            disabled={!isSuperAdmin || u.id === currentUser?.id}
                            onClick={() => updateStatusMutation.mutate({ userId: u.id, isActive: !u.isActive })}
                            loading={updateStatusMutation.isPending}
                          >
                            {u.isActive ? <BlockIcon /> : <CheckCircleIcon />}
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title={isSuperAdmin ? '切换角色' : '权限不足'} size='sm'>
                        <span>
                          <IconButton
                            size='sm'
                            color='neutral'
                            disabled={!isSuperAdmin || u.id === currentUser?.id}
                            onClick={() => {
                              const roles: User['role'][] = ['USER', 'ADMIN', 'SUPER_ADMIN'];
                              const currentIndex = roles.indexOf(u.role);
                              const nextRole = roles[(currentIndex + 1) % roles.length];
                              if (confirm(`确定要将 ${u.nickname} 切换为 ${nextRole} 吗？`))
                                updateRoleMutation.mutate({ userId: u.id, role: nextRole });
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </td>
                </tr>
              )})}
            </tbody>
          </Table>
        </Box>

        <Modal open={balanceModal.open} onClose={() => setBalanceModal((prev) => ({ ...prev, open: false }))}>
          <ModalDialog sx={{ width: 400 }}>
            <Typography level='title-md'>为用户「{balanceModal.nickname}」调整金币</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>数量（正数为增加，负数为扣减）</FormLabel>
                <Input
                  type='number'
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(parseInt(e.target.value || '0', 10))}
                  endDecorator='金币'
                />
              </FormControl>
              <FormControl>
                <FormLabel>调整原因</FormLabel>
                <Input value={balanceDesc} onChange={(e) => setBalanceDesc(e.target.value)} />
              </FormControl>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
                <Button variant='plain' color='neutral' onClick={() => setBalanceModal((prev) => ({ ...prev, open: false }))}>取消</Button>
                <Button
                  loading={updateBalanceMutation.isPending}
                  onClick={() => updateBalanceMutation.mutate({ userId: balanceModal.userId, amount: balanceAmount, description: balanceDesc })}
                >
                  确认调整
                </Button>
              </Box>
            </Stack>
          </ModalDialog>
        </Modal>

        <Modal open={notesModal.open} onClose={() => setNotesModal((prev) => ({ ...prev, open: false }))}>
          <ModalDialog sx={{ width: 500 }}>
            <Typography level='title-md'>用户备注与运维标签</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>用户标签（以逗号分隔，例如: VIP, 测试用户）</FormLabel>
                <Input value={notesModal.tags} onChange={(e) => setNotesModal((prev) => ({ ...prev, tags: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel>管理员后台备注</FormLabel>
                <Textarea
                  minRows={3}
                  value={notesModal.notes}
                  onChange={(e) => setNotesModal((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder='仅管理员可见...'
                />
              </FormControl>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
                <Button variant='plain' color='neutral' onClick={() => setNotesModal((prev) => ({ ...prev, open: false }))}>取消</Button>
                <Button
                  loading={updateAdminFieldsMutation.isPending}
                  onClick={() => updateAdminFieldsMutation.mutate({ userId: notesModal.userId, adminNotes: notesModal.notes, tags: notesModal.tags })}
                >
                  保存信息
                </Button>
              </Box>
            </Stack>
          </ModalDialog>
        </Modal>
      </CardContent>
    </Card>
  );
}
