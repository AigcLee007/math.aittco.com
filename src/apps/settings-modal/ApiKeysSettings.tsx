import * as React from 'react';

import { Alert, Box, Button, Card, Chip, Divider, Stack, Typography } from '@mui/joy';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SavingsIcon from '@mui/icons-material/Savings';
import HistoryIcon from '@mui/icons-material/History';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useRouter } from 'next/router';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import { apiQuery } from '~/common/util/trpc.client';

const COIN_ICON = '\u{1FA99}';

/**
 * 账户状态与余额组件
 * 展示系统已授权的状态，引导用户关注金币余额
 */
export function ApiKeysSettings() {
  const { user, accessToken } = useAuthStore();
  const router = useRouter();

  // 获取金币余额
  const { data: coinData } = apiQuery.coin.getBalance.useQuery(undefined, {
    enabled: !!accessToken,
    refetchOnWindowFocus: true,
  });

  return (
    <Stack gap={2}>
      
      {/* 顶部说明 */}
      <Box sx={{ mt: 1 }}>
        <Typography level="title-md" sx={{ mb: 0.5, fontWeight: 700 }}>
          🚀 账户余额与资产
        </Typography>
        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
          所有模型调用将直接从您的个人账户金币余额中扣除。
        </Typography>
      </Box>

      {/* 余额卡片 */}
      <Card variant="soft" color="warning" sx={{ p: 2.5, textAlign: 'center', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 165, 0, 0.08)' : 'warning.softBg' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <SavingsIcon sx={{ color: 'warning.solidBg', fontSize: '2.4rem' }} />
          <Typography level="title-sm" sx={{ color: 'text.secondary', fontWeight: 600 }}>您的当前余额</Typography>
          <Typography level="h2" sx={{ fontWeight: 800, color: 'warning.solidBg' }}>
            {coinData?.balance ?? 0} <span aria-label='coin'>{COIN_ICON}</span>
          </Typography>
          
          <Box sx={{ mt: 1, display: 'flex', gap: 1.5, width: '100%', justifyContent: 'center' }}>
            <Button
              variant="solid"
              color="success"
              size="sm"
              startDecorator={<AddCircleIcon />}
              onClick={() => router.push('/tokens')}
              sx={{ px: 3, borderRadius: 'md' }}
            >
              去充值
            </Button>
            <Button
              variant="outlined"
              color="neutral"
              size="sm"
              startDecorator={<HistoryIcon />}
              onClick={() => router.push('/billing')}
              sx={{ px: 2, borderRadius: 'md' }}
            >
              消费记录
            </Button>
          </Box>
        </Box>
      </Card>

      <Divider />

      {/* 已授权服务状态 */}
      <Box>
        <Typography level="title-sm" sx={{ mb: 1, fontWeight: 700, color: 'text.secondary' }}>支持的服务状态</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {['OpenAI', 'Anthropic', 'Gemini', 'xAI', 'Banana'].map((service) => (
            <Chip key={service} variant="soft" color="success" size="sm" startDecorator={<CheckCircleIcon sx={{ fontSize: 'md' }} />}>
              已授权 {service}
            </Chip>
          ))}
        </Box>
      </Box>

      <Divider />

      <Alert color="primary" variant="soft" sx={{ p: 1.5, borderRadius: 'md' }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <RocketLaunchIcon sx={{ color: 'primary.solidBg' }} />
          <Box>
            <Typography level="title-sm" sx={{ fontWeight: 700 }}>免密使用模式</Typography>
            <Typography level="body-xs">无需配置 API Key，系统将自动路由请求。</Typography>
          </Box>
        </Box>
      </Alert>

    </Stack>
  );
}
