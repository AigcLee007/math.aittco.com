import * as React from 'react';

import { Box, Button, CircularProgress, Divider, Sheet, Stack, Typography } from '@mui/joy';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import RefreshIcon from '@mui/icons-material/Refresh';

import { checkBananaBalance, BananaBalanceResponse } from './banana.api';


/**
 * 可复用的 API Key 额度查询组件
 * 可嵌入欢迎页 wizard、设置页 API 密钥页面等任意位置
 */
export function ApiKeyBalanceChecker({ apiKey }: { apiKey: string }) {
  const [balance, setBalance] = React.useState<BananaBalanceResponse | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasValidKey = !!apiKey && apiKey.startsWith('sk-');

  const handleCheck = React.useCallback(async () => {
    if (!hasValidKey) return;
    setIsChecking(true);
    setError(null);
    try {
      const data = await checkBananaBalance(apiKey);
      setBalance(data);
    } catch (e: any) {
      setError(e?.message || '查询失败，请检查 API Key 是否有效');
      setBalance(null);
    } finally {
      setIsChecking(false);
    }
  }, [apiKey, hasValidKey]);

  // 当 apiKey 变化时重置
  React.useEffect(() => {
    setBalance(null);
    setError(null);
  }, [apiKey]);

  if (!hasValidKey) return null;

  const remaining = balance
    ? (balance.subscription?.hard_limit_usd || 0) - ((balance.usage?.total_usage || 0) / 100)
    : null;

  return (
    <Box sx={{ mt: 1 }}>
      {!balance ? (
        <Button
          size='sm'
          variant='outlined'
          color='neutral'
          startDecorator={isChecking ? <CircularProgress size='sm' /> : <AccountBalanceWalletIcon />}
          onClick={handleCheck}
          loading={isChecking}
          disabled={isChecking}
          sx={{ fontSize: 'xs' }}
        >
          查询 API 额度
        </Button>
      ) : (
        <Sheet variant='soft' color='success' sx={{ p: 1.5, borderRadius: 'sm' }}>
          <Stack gap={0.75}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography level='body-xs' sx={{ color: 'text.secondary' }}>总额度</Typography>
              <Typography level='body-sm' fontWeight={700}>
                ${balance.subscription?.hard_limit_usd?.toFixed(2) ?? '--'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography level='body-xs' sx={{ color: 'text.secondary' }}>已使用</Typography>
              <Typography level='body-sm' fontWeight={700}>
                ${((balance.usage?.total_usage || 0) / 100).toFixed(2)}
              </Typography>
            </Box>
            <Divider sx={{ opacity: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography level='body-sm' fontWeight={800} sx={{ color: 'success.700' }}>剩余</Typography>
              <Typography level='body-md' fontWeight={900} sx={{ color: remaining !== null && remaining < 1 ? 'danger.500' : 'success.700' }}>
                ${remaining?.toFixed(2) ?? '--'}
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button
              size='sm'
              variant='plain'
              startDecorator={<RefreshIcon sx={{ fontSize: 14 }} />}
              onClick={() => setBalance(null)}
            >
              重新查询
            </Button>
          </Box>
        </Sheet>
      )}
      {error && (
        <Typography level='body-xs' color='danger' sx={{ mt: 0.5 }}>
          ⚠️ {error}
        </Typography>
      )}
    </Box>
  );
}
