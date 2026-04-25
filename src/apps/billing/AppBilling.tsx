import * as React from 'react';
import { Box, Typography, Card, Sheet, List, ListItem, ListItemContent, ListItemDecorator, Divider, Button, CircularProgress } from '@mui/joy';
import { AppSmallContainer } from '../AppSmallContainer';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/router';

/**
 * AppBilling: Detailed consumption and recharge history page.
 */
export function AppBilling() {
  const { accessToken } = useAuthStore();
  const router = useRouter();
  const [limit, setLimit] = React.useState(20);

  // 1. 获取流水明细 (默认取 20 条)
  const { data: historyData, isLoading, refetch } = apiQuery.coin.getTransactions.useQuery(
    { limit }, 
    { enabled: !!accessToken }
  );

  const handleLoadMore = () => {
    setLimit(prev => prev + 20);
  };

  return (
    <AppSmallContainer
      title='消费记录'
      description='查看您的所有金币消费与充值流水明细。'
    >
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button 
          variant="plain" 
          color="neutral" 
          startDecorator={<ArrowBackIcon />}
          onClick={() => router.push('/tokens')}
          sx={{ ml: -1 }}
        >
          返回充值
        </Button>
      </Box>

      <Typography level="title-lg" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon color="primary" /> 交易流水记录
      </Typography>

      <Sheet variant="outlined" sx={{ borderRadius: 'md', overflow: 'hidden', boxShadow: 'sm' }}>
        <List sx={{ '--ListItemDecorator-size': '44px' }}>
          {isLoading && (
            <ListItem sx={{ py: 4, justifyContent: 'center' }}>
              <CircularProgress size="sm" />
            </ListItem>
          )}

          {(!historyData || historyData.items.length === 0) && !isLoading ? (
            <ListItem sx={{ py: 4, justifyContent: 'center' }}>
              <Typography level="body-sm" color="neutral">暂无流水记录</Typography>
            </ListItem>
          ) : (
            <>
              {historyData?.items.map((tx: any, idx: number) => (
                <React.Fragment key={tx.id}>
                  <ListItem sx={{ py: 1.5 }}>
                    <ListItemDecorator>
                      {tx.amount > 0 ? (
                        <CheckCircleOutlineIcon color="success" />
                      ) : (
                        <AccountBalanceWalletIcon color="warning" />
                      )}
                    </ListItemDecorator>
                    <ListItemContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography level="title-sm">{tx.description}</Typography>
                          <Typography level="body-xs" sx={{ mt: 0.5 }}>
                            {new Date(tx.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                        <Typography 
                          level="title-md" 
                          color={tx.amount > 0 ? 'success' : 'neutral'} 
                          sx={{ fontWeight: 'bold' }}
                        >
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </Typography>
                      </Box>
                      {tx.modelId && (
                        <Typography level="body-xs" sx={{ mt: 0.5, fontStyle: 'italic', opacity: 0.7 }}>
                          关联模型: {tx.modelId}
                        </Typography>
                      )}
                    </ListItemContent>
                  </ListItem>
                  {idx < historyData.items.length - 1 && <Divider inset="none" />}
                </React.Fragment>
              ))}
            </>
          )}
        </List>
      </Sheet>

      {historyData && historyData.items.length >= limit && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button 
            variant="soft" 
            color="neutral" 
            size="sm"
            onClick={handleLoadMore}
            loading={isLoading}
          >
            加载更多记录
          </Button>
        </Box>
      )}

      <Box sx={{ mt: 4, p: 2, bgcolor: 'neutral.softBg', borderRadius: 'md' }}>
        <Typography level="body-xs" color="neutral" textAlign="center">
          仅保留最近 100 条流水记录，如有疑问请咨询管理员。
        </Typography>
      </Box>

    </AppSmallContainer>
  );
}
