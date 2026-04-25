import * as React from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Grid } from '@mui/joy';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { apiQuery } from '~/common/util/trpc.client';

export function DashboardSection() {
  const { data: stats, isLoading } = (apiQuery.admin.getDashboardStats as any).useQuery();

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;

  // 处理后端返回的按天聚合数据
  const trendData = (stats as any)?.dailyNewUsers?.map((d: any) => ({
    name: d.date,
    users: d.count
  })) || [];

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid xs={12} sm={6} md={3}>
          <StatCard title="总用户数" value={(stats as any)?.totalUsers || 0} color="primary" />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard title="管理层" value={(stats as any)?.adminCount || 0} color="warning" />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard title="系统总金币" value={(stats as any)?.totalCoins || 0} color="success" />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard title="今日新增" value={(stats as any)?.newUsersToday || 0} color="danger" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2 }}>用户增长趋势 (最近一周)</Typography>
              <Box sx={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="users" stroke="#0b6bcb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2 }}>分布情况</Typography>
              <Box sx={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="users" fill="#13a452" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function StatCard({ title, value, color }: { title: string, value: number | string, color: any }) {
  return (
    <Card variant="soft" color={color}>
      <CardContent>
        <Typography level="body-sm">{title}</Typography>
        <Typography level="h2" fontWeight="bold">{value}</Typography>
      </CardContent>
    </Card>
  );
}
