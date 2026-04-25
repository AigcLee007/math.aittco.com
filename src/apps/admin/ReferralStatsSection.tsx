import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Table,
  Typography,
} from '@mui/joy';
import ShareIcon from '@mui/icons-material/Share';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiQuery } from '~/common/util/trpc.client';

function formatDateTime(date?: string | Date | null): string {
  if (!date)
    return '-';

  const value = new Date(date);
  if (Number.isNaN(value.getTime()))
    return '-';

  return value.toLocaleString('zh-CN', { hour12: false });
}

function formatRate(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value))
    return '0%';
  return `${(value * 100).toFixed(0)}%`;
}

export function ReferralStatsSection() {
  const { data, isLoading, refetch, isFetching } = (apiQuery.admin.getReferralAdminStats as any).useQuery();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const overview = data?.overview || {
    invitedUsers: 0,
    totalRewardCoins: 0,
    signupRewardCoins: 0,
    rechargeRewardCoins: 0,
    signupRewardCount: 0,
    rechargeRewardCount: 0,
  };

  return (
    <Stack spacing={3}>
      <Card variant='outlined'>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography level='title-lg' startDecorator={<ShareIcon />}>
                邀请统计
              </Typography>
              <Typography level='body-sm' sx={{ opacity: 0.72, mt: 0.5 }}>
                这里可以直接看到邀请注册、注册奖励和充值返佣的整体情况。
              </Typography>
            </Box>
            <Chip
              variant='soft'
              color={isFetching ? 'warning' : 'primary'}
              startDecorator={<RefreshIcon />}
              onClick={() => refetch()}
              sx={{ cursor: 'pointer' }}
            >
              {isFetching ? '刷新中' : '刷新数据'}
            </Chip>
          </Box>

          <Grid container spacing={2}>
            <Grid xs={12} sm={6} md={4}>
              <Card variant='soft' color='primary'>
                <CardContent>
                  <Typography level='body-sm'>累计邀请用户</Typography>
                  <Typography level='h2'>{overview.invitedUsers}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} sm={6} md={4}>
              <Card variant='soft' color='success'>
                <CardContent>
                  <Typography level='body-sm'>累计返奖励金币</Typography>
                  <Typography level='h2'>{overview.totalRewardCoins}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} sm={6} md={4}>
              <Card variant='soft' color='warning'>
                <CardContent>
                  <Typography level='body-sm'>注册奖励次数 / 金币</Typography>
                  <Typography level='h3'>{overview.signupRewardCount} / {overview.signupRewardCoins}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} sm={6} md={4}>
              <Card variant='soft' color='neutral'>
                <CardContent>
                  <Typography level='body-sm'>充值返佣次数 / 金币</Typography>
                  <Typography level='h3'>{overview.rechargeRewardCount} / {overview.rechargeRewardCoins}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} sm={6} md={4}>
              <Card variant='soft' color='success'>
                <CardContent>
                  <Typography level='body-sm'>当前分享注册奖励</Typography>
                  <Typography level='h3'>{data?.config?.signupRewardCoins ?? 0} 金币</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} sm={6} md={4}>
              <Card variant='soft' color='warning'>
                <CardContent>
                  <Typography level='body-sm'>当前返佣规则</Typography>
                  <Typography level='h3'>
                    {formatRate(data?.config?.rechargeRewardRate)} / 前 {data?.config?.rechargeRewardLimit ?? 0} 次
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant='outlined'>
        <CardContent>
          <Typography level='title-md' sx={{ mb: 2 }}>最近邀请注册</Typography>
          <Box sx={{ overflow: 'auto' }}>
            <Table stickyHeader hoverRow>
              <thead>
                <tr>
                  <th>被邀请用户</th>
                  <th>邀请人</th>
                  <th>注册时间</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentInvitations || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: 32 }}>暂无邀请注册记录</td>
                  </tr>
                ) : (
                  (data?.recentInvitations || []).map((row: any) => (
                    <tr key={`${row.referredUserId}-${row.createdAt}`}>
                      <td>
                        <Typography level='body-sm'>{row.referredNickname}</Typography>
                        <Typography level='body-xs' sx={{ opacity: 0.65 }}>
                          #{row.referredShortId || '-'} · {row.referredEmail}
                        </Typography>
                      </td>
                      <td>
                        <Typography level='body-sm'>{row.inviterNickname}</Typography>
                        <Typography level='body-xs' sx={{ opacity: 0.65 }}>
                          #{row.inviterShortId || '-'}
                        </Typography>
                      </td>
                      <td>{formatDateTime(row.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid xs={12} md={6}>
          <Card variant='outlined'>
            <CardContent>
              <Typography level='title-md' sx={{ mb: 2 }}>返佣排行榜</Typography>
              <Box sx={{ overflow: 'auto' }}>
                <Table stickyHeader hoverRow>
                  <thead>
                    <tr>
                      <th>邀请人</th>
                      <th>邀请人数</th>
                      <th>累计奖励</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topReferrers || []).length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: 32 }}>暂无返佣数据</td>
                      </tr>
                    ) : (
                      (data?.topReferrers || []).map((row: any) => (
                        <tr key={row.referrerUserId}>
                          <td>
                            <Typography level='body-sm'>{row.referrerNickname}</Typography>
                            <Typography level='body-xs' sx={{ opacity: 0.65 }}>
                              #{row.referrerShortId || '-'}
                            </Typography>
                          </td>
                          <td>{row.invitedUsers}</td>
                          <td>
                            <Typography level='body-sm'>{row.totalRewardCoins}</Typography>
                            <Typography level='body-xs' sx={{ opacity: 0.65 }}>
                              注册 {row.signupRewardCoins} / 充值 {row.rechargeRewardCoins}
                            </Typography>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={6}>
          <Card variant='outlined'>
            <CardContent>
              <Typography level='title-md' sx={{ mb: 2 }}>最近奖励流水</Typography>
              <Box sx={{ overflow: 'auto' }}>
                <Table stickyHeader hoverRow>
                  <thead>
                    <tr>
                      <th>类型</th>
                      <th>被邀请用户</th>
                      <th>奖励</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recentRewards || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 32 }}>暂无奖励流水</td>
                      </tr>
                    ) : (
                      (data?.recentRewards || []).map((row: any, index: number) => (
                        <tr key={`${row.referredUserId}-${row.createdAt}-${index}`}>
                          <td>
                            <Chip size='sm' color={row.type === 'SIGNUP' ? 'success' : 'warning'}>
                              {row.type === 'SIGNUP' ? '注册奖励' : `充值返佣${row.rechargeSequence ? `#${row.rechargeSequence}` : ''}`}
                            </Chip>
                          </td>
                          <td>{row.referredNickname}</td>
                          <td>{row.rewardCoins}</td>
                          <td>{formatDateTime(row.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
