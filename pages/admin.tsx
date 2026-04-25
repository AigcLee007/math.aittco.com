import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Sheet,
  Typography,
} from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CampaignIcon from '@mui/icons-material/Campaign';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DiamondIcon from '@mui/icons-material/Diamond';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import RedeemIcon from '@mui/icons-material/Redeem';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SettingsIcon from '@mui/icons-material/Settings';

import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import { DashboardSection } from '~/apps/admin/DashboardSection';
import { UsersSection } from '~/apps/admin/UsersSection';
import { TransactionsSection } from '~/apps/admin/TransactionsSection';
import { PricingSection } from '~/apps/admin/PricingSection';
import { RechargePackagesSection } from '~/apps/admin/RechargePackagesSection';
import { RelayModelsSection } from '~/apps/admin/RelayModelsSection';
import { InvitationsSection } from '~/apps/admin/InvitationsSection';
import { ReferralStatsSection } from '~/apps/admin/ReferralStatsSection';
import { RedeemCodesSection } from '~/apps/admin/RedeemCodesSection';
import { AnnouncementsSection } from '~/apps/admin/AnnouncementsSection';
import { SettingsSection } from '~/apps/admin/SettingsSection';
import { ContactService } from '~/common/components/ContactService';

type AdminSegment =
  | 'dashboard'
  | 'users'
  | 'transactions'
  | 'pricing'
  | 'rechargePackages'
  | 'relayModels'
  | 'invitations'
  | 'referralStats'
  | 'redeemCodes'
  | 'announcements'
  | 'settings';

export default function AdminPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [activeSegment, setActiveSegment] = useState<AdminSegment>('dashboard');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN'))
      router.push('/');
  }, [user, router]);

  useEffect(() => {
    if (!isSuperAdmin && (activeSegment === 'pricing' || activeSegment === 'settings'))
      setActiveSegment('dashboard');
  }, [activeSegment, isSuperAdmin]);

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN'))
    return null;

  const navItems: { id: AdminSegment; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: '数据看板', icon: <DashboardIcon /> },
    { id: 'users', label: '用户管理', icon: <PeopleAltIcon /> },
    { id: 'transactions', label: '交易流水', icon: <ReceiptLongIcon /> },
    { id: 'rechargePackages', label: '充值套餐', icon: <AccountBalanceWalletIcon /> },
    { id: 'relayModels', label: '渠道模型', icon: <DiamondIcon /> },
    { id: 'invitations', label: '邀请码管理', icon: <ConfirmationNumberIcon /> },
    { id: 'referralStats', label: '邀请统计', icon: <PeopleAltIcon /> },
    { id: 'redeemCodes', label: '兑换码管理', icon: <RedeemIcon /> },
    { id: 'announcements', label: '全站公告', icon: <CampaignIcon /> },
  ];
  if (isSuperAdmin) {
    navItems.splice(3, 0, { id: 'pricing', label: '模型定价', icon: <DiamondIcon /> });
    navItems.push({ id: 'settings', label: '系统设置', icon: <SettingsIcon /> });
  }

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.level1', overflow: 'hidden' }}>
      <Sheet
        sx={{
          width: 240,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.surface',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 10,
          overflowY: 'auto',
        }}
      >
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              bgcolor: 'primary.solidBg',
              borderRadius: 'sm',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#fff',
            }}
          >
            <SettingsIcon fontSize='small' />
          </Box>
          <Typography level='title-lg' fontWeight='bold'>管理后台</Typography>
        </Box>

        <List size='sm' sx={{ '--ListItem-radius': '8px', gap: 0.5 }}>
          {navItems.map((item) => (
            <ListItem key={item.id}>
              <ListItemButton
                selected={activeSegment === item.id}
                onClick={() => setActiveSegment(item.id)}
                color={activeSegment === item.id ? 'primary' : 'neutral'}
              >
                <ListItemDecorator>{item.icon}</ListItemDecorator>
                <ListItemContent>{item.label}</ListItemContent>
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 'auto' }}>
          <Divider sx={{ mb: 2 }} />
          <ListItemButton onClick={() => router.push('/')} sx={{ borderRadius: '8px' }}>
            <ListItemDecorator><ArrowBackIcon /></ListItemDecorator>
            <ListItemContent>返回前台</ListItemContent>
          </ListItemButton>
          <ListItemButton onClick={handleLogout} sx={{ borderRadius: '8px', color: 'danger.plainColor' }}>
            <ListItemDecorator><LogoutIcon color='error' /></ListItemDecorator>
            <ListItemContent>退出登录</ListItemContent>
          </ListItemButton>

          <Box sx={{ mt: 1, p: 1, height: 44 }}>
            <ContactService />
          </Box>
        </Box>
      </Sheet>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        <Box
          sx={{
            px: 4,
            py: 2,
            bgcolor: 'background.surface',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 9,
          }}
        >
          <Typography level='title-lg'>
            {navItems.find((n) => n.id === activeSegment)?.label}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography level='body-sm' fontWeight='bold'>{user.nickname || 'Unknown'}</Typography>
              <Typography level='body-xs' sx={{ opacity: 0.6 }}>
                {user.role === 'SUPER_ADMIN' ? '超级管理员' : '系统管理员'}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'primary.softBg',
                borderRadius: '50%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'primary.solidBg',
                fontWeight: 'bold',
              }}
            >
              {(user.nickname || 'U').charAt(0).toUpperCase()}
            </Box>
          </Box>
        </Box>

        <Box sx={{ p: 4, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {activeSegment === 'dashboard' && <DashboardSection />}
          {activeSegment === 'users' && <UsersSection />}
          {activeSegment === 'transactions' && <TransactionsSection />}
          {activeSegment === 'pricing' && <PricingSection />}
          {activeSegment === 'rechargePackages' && <RechargePackagesSection />}
          {activeSegment === 'relayModels' && <RelayModelsSection />}
          {activeSegment === 'invitations' && <InvitationsSection />}
          {activeSegment === 'referralStats' && <ReferralStatsSection />}
          {activeSegment === 'redeemCodes' && <RedeemCodesSection />}
          {activeSegment === 'announcements' && <AnnouncementsSection />}
          {activeSegment === 'settings' && <SettingsSection />}
        </Box>
      </Box>
    </Box>
  );
}
