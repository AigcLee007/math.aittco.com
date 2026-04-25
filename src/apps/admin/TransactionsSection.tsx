import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Input,
  Option,
  Select,
  Stack,
  Table,
  Typography,
} from '@mui/joy';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiQuery } from '~/common/util/trpc.client';

type TrendRow = {
  date: string;
  recharge: number;
  consume: number;
  gift: number;
  paidYuan: number;
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toShanghaiDate(value: string): Date {
  return new Date(`${value}T00:00:00+08:00`);
}

export function TransactionsSection() {
  const [typeFilter, setTypeFilter] = React.useState<string | null>(null);
  const [userIdFilter, setUserIdFilter] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [offset] = React.useState(0);
  const limit = 50;

  const today = React.useMemo(() => toDateInputValue(new Date()), []);
  const defaultStart = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return toDateInputValue(d);
  }, []);

  const startDateValue = startDate || defaultStart;
  const endDateValue = endDate || today;

  const {
    data: transData,
    isLoading: isListLoading,
    refetch: refetchList,
  } = (apiQuery.admin.getAllTransactions as any).useQuery({
    limit,
    offset,
    type: typeFilter || undefined,
    userId: userIdFilter || undefined,
  });

  const {
    data: statsData,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = (apiQuery.admin.getTransactionStats as any).useQuery({
    startDate: toShanghaiDate(startDateValue),
    endDate: toShanghaiDate(endDateValue),
    type: typeFilter || undefined,
  });

  const transactions = transData?.items || [];

  const trendRows = React.useMemo<TrendRow[]>(() => {
    if (!Array.isArray(statsData))
      return [];

    return statsData
      .map((row: any) => ({
        date: String(row?.date || ''),
        recharge: Number(row?.recharge || 0),
        consume: Number(row?.consume || 0),
        gift: Number(row?.gift || 0),
        paidYuan: Number(row?.paidYuan || 0),
      }))
      .filter((row: TrendRow) => !!row.date)
      .sort((a: TrendRow, b: TrendRow) => a.date.localeCompare(b.date));
  }, [statsData]);

  const summary = React.useMemo(() => {
    return trendRows.reduce((acc, row) => {
      acc.recharge += row.recharge;
      acc.consume += row.consume;
      acc.gift += row.gift;
      acc.paidYuan += row.paidYuan;
      return acc;
    }, { recharge: 0, consume: 0, gift: 0, paidYuan: 0 });
  }, [trendRows]);

  const netGrowth = summary.recharge + summary.gift - summary.consume;
  const hasTrendValues = summary.recharge > 0 || summary.consume > 0 || summary.gift > 0 || summary.paidYuan > 0;

  const handleRefresh = () => {
    refetchList();
    refetchStats();
  };

  return (
    <Stack spacing={3}>
      <Card variant='outlined'>
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography level='title-md'>营收趋势分析（日聚合）</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography level='body-xs'>范围:</Typography>
            <Input size='sm' type='date' value={startDateValue} onChange={(e) => setStartDate(e.target.value)} />
            <Typography level='body-xs'>-</Typography>
            <Input size='sm' type='date' value={endDateValue} onChange={(e) => setEndDate(e.target.value)} />
          </Box>
        </Box>

        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
            <Chip color='success' variant='soft'>充值合计: {summary.recharge}</Chip>
            <Chip color='danger' variant='soft'>消耗合计: {summary.consume}</Chip>
            <Chip color='warning' variant='soft'>赠送合计: {summary.gift}</Chip>
            <Chip color={netGrowth >= 0 ? 'primary' : 'neutral'} variant='solid'>净增长: {netGrowth >= 0 ? `+${netGrowth}` : netGrowth}</Chip>
            <Chip color='primary' variant='outlined'>实收金额: ¥{summary.paidYuan.toFixed(2)}</Chip>
          </Stack>

          <Box sx={{ width: '100%', height: 300, mt: 1 }}>
            {isStatsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress size='sm' />
              </Box>
            ) : !hasTrendValues ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography level='body-sm' color='neutral'>当前时间范围内暂无交易数据</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={trendRows} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray='3 3' vertical={false} />
                  <XAxis
                    dataKey='date'
                    fontSize={11}
                    tickMargin={6}
                    minTickGap={20}
                    tickFormatter={(value) => String(value).slice(5)}
                  />
                  <YAxis fontSize={11} />
                  <YAxis yAxisId='yuan' orientation='right' fontSize={11} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign='top' align='right' wrapperStyle={{ paddingBottom: 16 }} />
                  <Bar dataKey='recharge' name='充值' fill='#2eb85c' radius={[4, 4, 0, 0]} />
                  <Bar dataKey='consume' name='消耗' fill='#e55353' radius={[4, 4, 0, 0]} />
                  <Bar dataKey='gift' name='赠送' fill='#f9b115' radius={[4, 4, 0, 0]} />
                  <Line yAxisId='yuan' type='monotone' dataKey='paidYuan' name='实收金额(元)' stroke='#2563eb' strokeWidth={2} dot={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card variant='outlined'>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography level='title-lg'>全站交易流水审计</Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Input
                placeholder='按用户 ID 搜索...'
                size='sm'
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                sx={{ width: 180 }}
              />
              <Select
                size='sm'
                placeholder='交易类型'
                value={typeFilter}
                onChange={(_, v) => setTypeFilter(v)}
                sx={{ width: 140 }}
              >
                <Option value={null}>全部类型</Option>
                <Option value='RECHARGE'>充值 (RECHARGE)</Option>
                <Option value='CONSUME'>消耗 (CONSUME)</Option>
                <Option value='GIFT'>赠送 (GIFT)</Option>
                <Option value='REFUND'>退款 (REFUND)</Option>
              </Select>
              <IconButton variant='solid' color='primary' size='sm' onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Box>
          </Box>

          <Box
            sx={{
              overflowX: 'auto',
              overflowY: 'auto',
              maxHeight: { xs: 360, md: 520 },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 'sm',
            }}
          >
            <Table
              stickyHeader
              hoverRow
              sx={{
                '& tr > *': { verticalAlign: 'middle' },
                '& thead th': {
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  bgcolor: 'background.surface',
                },
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: 160 }}>流水 ID / 时间</th>
                  <th>用户信息</th>
                  <th>分类</th>
                  <th>变动金额</th>
                  <th>账户余额</th>
                  <th>业务描述</th>
                </tr>
              </thead>
              <tbody>
                {isListLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                      <CircularProgress />
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                      暂无匹配的交易记录
                    </td>
                  </tr>
                ) : (
                  transactions.map((t: any) => (
                    <tr key={t.id}>
                      <td>
                        <Typography level='body-xs' fontWeight='bold' sx={{ fontFamily: 'monospace' }}>
                          #{String(t.id).substring(0, 8)}
                        </Typography>
                        <Typography level='body-xs' sx={{ opacity: 0.6 }}>
                          {new Date(t.createdAt).toLocaleString()}
                        </Typography>
                      </td>
                      <td>
                        <Typography level='body-sm' fontWeight='bold'>
                          {t.user?.nickname || '未知用户'}
                        </Typography>
                        <Typography level='body-xs' sx={{ opacity: 0.6 }}>
                          {t.user?.email}
                        </Typography>
                      </td>
                      <td>
                        <ChipForType type={t.type} />
                      </td>
                      <td>
                        <Typography
                          color={t.amount > 0 ? 'success' : 'danger'}
                          fontWeight='xl'
                          level='body-md'
                        >
                          {t.amount > 0 ? `+${t.amount}` : t.amount}
                        </Typography>
                      </td>
                      <td>
                        <Typography level='body-sm' fontWeight='bold'>
                          🪙 {t.balance}
                        </Typography>
                      </td>
                      <td>
                        <Typography level='body-xs' sx={{ whiteSpace: 'normal', maxWidth: 220 }}>
                          {t.description}
                        </Typography>
                        {t.modelId && (
                          <Chip
                            size='sm'
                            variant='outlined'
                            color='neutral'
                            sx={{ mt: 0.5, borderRadius: 'xs', fontSize: 10 }}
                          >
                            模型: {t.modelId}
                          </Chip>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}

function ChipForType({ type }: { type: string }) {
  const map: Record<string, { color: 'success' | 'danger' | 'warning' | 'neutral'; label: string }> = {
    RECHARGE: { color: 'success', label: '充值' },
    CONSUME: { color: 'danger', label: '消耗' },
    GIFT: { color: 'warning', label: '赠送' },
    REFUND: { color: 'neutral', label: '退款' },
  };

  const config = map[type] || { color: 'neutral', label: type };

  return (
    <Chip size='sm' variant='soft' color={config.color}>
      {config.label}
    </Chip>
  );
}
