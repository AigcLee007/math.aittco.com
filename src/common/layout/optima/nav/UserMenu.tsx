import * as React from 'react';
import { useRouter } from 'next/router';
import { Avatar, Box, Dropdown, IconButton, Menu, MenuButton, MenuItem, Typography, ListDivider, ListItemDecorator, Tooltip } from '@mui/joy';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import SavingsIcon from '@mui/icons-material/Savings';
import HistoryIcon from '@mui/icons-material/History';
import LoginIcon from '@mui/icons-material/Login';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import { apiQuery } from '~/common/util/trpc.client';
import { optimaOpenPreferences } from '../useOptima';

const COIN_ICON = '\u{1FA99}';

/**
 * UserMenu Component
 * Displays user avatar, nickname, and coin balance.
 * Provides actions for Profile, Recharge, and Logout.
 */
export function UserMenu(props: { isMobile?: boolean }) {
  const { user, accessToken, logout } = useAuthStore();
  const router = useRouter();

  // 1. 获取金币余额
  const { data: coinData, refetch: refetchBalance } = apiQuery.coin.getBalance.useQuery(undefined, {
    enabled: !!accessToken,
    refetchOnWindowFocus: true,
  });

  // 监听路由变化，及时更新余额
  React.useEffect(() => {
    if (accessToken) {
      refetchBalance();
    }
  }, [router.pathname, accessToken, refetchBalance]);

  if (!accessToken || !user) {
    return (
      <Tooltip title="登录/注册" variant="soft">
        <IconButton
          variant="soft"
          color="primary"
          onClick={() => router.push('/auth')}
          sx={{ 
            borderRadius: '50%',
            width: props.isMobile ? 40 : 44,
            height: props.isMobile ? 40 : 44,
          }}
        >
          <LoginIcon />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Dropdown>
      <Tooltip title={`余额: ${coinData?.balance ?? 0} ${COIN_ICON}`} variant="soft" placement={props.isMobile ? 'top' : 'right'}>
        <MenuButton
          slots={{ root: IconButton }}
          slotProps={{
            root: {
              variant: 'plain',
              color: 'neutral',
              sx: { 
                p: 0, 
                borderRadius: '50%',
                border: '2px solid',
                borderColor: 'primary.softBg',
                '&:hover': { borderColor: 'primary.solidBg' }
              },
            },
          }}
        >
          <Avatar 
            variant="soft" 
            color="primary"
            src={user.avatar || undefined}
            sx={{ width: props.isMobile ? 36 : 40, height: props.isMobile ? 36 : 40 }}
          >
            {user.nickname.substring(0, 1).toUpperCase()}
          </Avatar>
        </MenuButton>
      </Tooltip>

      <Menu
        variant="outlined"
        size="md"
        placement={props.isMobile ? 'bottom-end' : 'right-end'}
        sx={{ minWidth: 200, zIndex: 10000, borderRadius: 'md' }}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography level="title-md" fontWeight="bold">{user.nickname}</Typography>
          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>{user.email}</Typography>
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SavingsIcon sx={{ color: 'warning.solidBg', fontSize: '1.2rem' }} />
            <Typography level="title-sm" sx={{ fontWeight: 'bold' }}>
              {coinData?.balance ?? 0} <span aria-label='coin'>{COIN_ICON}</span>
            </Typography>
          </Box>
        </Box>
        
        <ListDivider />

        <MenuItem onClick={() => optimaOpenPreferences()} sx={{ py: 1 }}>
          <ListItemDecorator><SettingsIcon /></ListItemDecorator>
          设置
        </MenuItem>
        
        <MenuItem onClick={() => router.push('/tokens')} sx={{ py: 1 }}>
          <ListItemDecorator><AddCircleIcon color="success" /></ListItemDecorator>
          去充值
        </MenuItem>
        
        <MenuItem onClick={() => router.push('/billing')} sx={{ py: 1 }}>
          <ListItemDecorator><HistoryIcon /></ListItemDecorator>
          消费记录
        </MenuItem>

        {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
          <MenuItem onClick={() => router.push('/admin')} sx={{ py: 1 }}>
            <ListItemDecorator><AccountCircleIcon color="primary" /></ListItemDecorator>
            管理后台
          </MenuItem>
        )}

        <ListDivider />

        <MenuItem onClick={() => { logout(); router.push('/auth'); }} sx={{ color: 'danger.plainColor', py: 1 }}>
          <ListItemDecorator><LogoutIcon color="error" /></ListItemDecorator>
          退出登录
        </MenuItem>
      </Menu>
    </Dropdown>
  );
}
