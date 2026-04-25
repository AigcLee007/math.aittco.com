import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Switch,
  Typography,
} from '@mui/joy';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';

const VIP_IMAGE_MODELS_CONFIG_KEY = 'ENABLE_VIP_IMAGE_MODELS';
const REFERRAL_SIGNUP_REWARD_COINS_KEY = 'REFERRAL_SIGNUP_REWARD_COINS';
const REFERRAL_RECHARGE_REWARD_RATE_KEY = 'REFERRAL_RECHARGE_REWARD_RATE';
const REFERRAL_RECHARGE_REWARD_LIMIT_KEY = 'REFERRAL_RECHARGE_REWARD_LIMIT';

export function SettingsSection() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { data: configs, refetch } = (apiQuery.admin.getConfigs as any).useQuery(undefined, {
    enabled: isSuperAdmin,
  });
  const updateMutation = (apiQuery.admin.updateConfig as any).useMutation({
    onSuccess: () => {
      refetch();
      alert('设置已保存');
    },
  });

  const [siteTitle, setSiteTitle] = React.useState('');
  const [siteLogo, setSiteLogo] = React.useState('');
  const [welcomeText, setWelcomeText] = React.useState('');
  const [vipImageModelsEnabled, setVipImageModelsEnabled] = React.useState(false);
  const [referralSignupRewardCoins, setReferralSignupRewardCoins] = React.useState('20');
  const [referralRechargeRewardRate, setReferralRechargeRewardRate] = React.useState('0.05');
  const [referralRechargeRewardLimit, setReferralRechargeRewardLimit] = React.useState('3');

  React.useEffect(() => {
    if (!configs)
      return;

    const configRows = configs as any[];
    setSiteTitle(configRows.find((c) => c.key === 'SITE_TITLE')?.value || '数模工作台');
    setSiteLogo(configRows.find((c) => c.key === 'SITE_LOGO')?.value || '');
    setWelcomeText(configRows.find((c) => c.key === 'WELCOME_TEXT')?.value || '欢迎使用数模工作台');
    setVipImageModelsEnabled(configRows.find((c) => c.key === VIP_IMAGE_MODELS_CONFIG_KEY)?.value === 'true');
    setReferralSignupRewardCoins(configRows.find((c) => c.key === REFERRAL_SIGNUP_REWARD_COINS_KEY)?.value || '20');
    setReferralRechargeRewardRate(configRows.find((c) => c.key === REFERRAL_RECHARGE_REWARD_RATE_KEY)?.value || '0.05');
    setReferralRechargeRewardLimit(configRows.find((c) => c.key === REFERRAL_RECHARGE_REWARD_LIMIT_KEY)?.value || '3');
  }, [configs]);

  const handleSave = (key: string, value: string, description?: string) => {
    updateMutation.mutate({ key, value, description });
  };

  const handleVipImageModelsToggle = (checked: boolean) => {
    setVipImageModelsEnabled(checked);
    handleSave(
      VIP_IMAGE_MODELS_CONFIG_KEY,
      checked ? 'true' : 'false',
      '控制前台是否显示 VIP 应急生图模型',
    );
  };

  if (!isSuperAdmin) {
    return (
      <Alert color="warning" variant="soft">
        仅超级管理员可操作系统设置。
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Typography level="title-lg" startDecorator={<SettingsSuggestIcon />} sx={{ mb: 1 }}>
            全站基础设置
          </Typography>
          <Typography level="body-sm" sx={{ mb: 3 }}>
            这里可以修改前端展示信息，以及控制一些运营开关。
          </Typography>

          <Divider sx={{ mb: 3 }} />

          <Stack spacing={3}>
            <FormControl>
              <FormLabel>网站标题 (SITE_TITLE)</FormLabel>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input value={siteTitle} onChange={(e: any) => setSiteTitle(e.target.value)} sx={{ flex: 1 }} />
                <Button size="sm" onClick={() => handleSave('SITE_TITLE', siteTitle, '前台网站标题')}>
                  保存
                </Button>
              </Box>
            </FormControl>

            <FormControl>
              <FormLabel>Logo URL (SITE_LOGO)</FormLabel>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input value={siteLogo} onChange={(e: any) => setSiteLogo(e.target.value)} placeholder="https://..." sx={{ flex: 1 }} />
                <Button size="sm" onClick={() => handleSave('SITE_LOGO', siteLogo, '前台 logo 地址')}>
                  保存
                </Button>
              </Box>
            </FormControl>

            <FormControl>
              <FormLabel>欢迎语 (WELCOME_TEXT)</FormLabel>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input value={welcomeText} onChange={(e: any) => setWelcomeText(e.target.value)} sx={{ flex: 1 }} />
                <Button size="sm" onClick={() => handleSave('WELCOME_TEXT', welcomeText, '首页欢迎语')}>
                  保存
                </Button>
              </Box>
            </FormControl>

            <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <FormLabel>VIP 应急生图模型开关</FormLabel>
                <Typography level="body-sm" sx={{ mt: 0.5 }}>
                  开启后，前台生图模型列表会显示 `Nano Banana Pro(vip)` 和 `Nano Banana 2(vip)`；关闭时这两个模型不会显示给普通用户。
                </Typography>
              </Box>
              <Switch
                checked={vipImageModelsEnabled}
                onChange={(event) => handleVipImageModelsToggle(event.target.checked)}
                disabled={updateMutation.isPending}
              />
            </FormControl>

            <Divider />

            <Typography level="title-md">邀请奖励设置</Typography>

            <FormControl>
              <FormLabel>分享链接注册奖励金币 (REFERRAL_SIGNUP_REWARD_COINS)</FormLabel>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input
                  type="number"
                  value={referralSignupRewardCoins}
                  onChange={(e: any) => setReferralSignupRewardCoins(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(
                    REFERRAL_SIGNUP_REWARD_COINS_KEY,
                    String(Math.max(0, Number(referralSignupRewardCoins) || 0)),
                    '分享链接注册奖励金币',
                  )}
                >
                  保存
                </Button>
              </Box>
            </FormControl>

            <FormControl>
              <FormLabel>邀请返佣比例 (REFERRAL_RECHARGE_REWARD_RATE)</FormLabel>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input
                  type="number"
                  slotProps={{ input: { step: '0.01', min: '0' } }}
                  value={referralRechargeRewardRate}
                  onChange={(e: any) => setReferralRechargeRewardRate(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(
                    REFERRAL_RECHARGE_REWARD_RATE_KEY,
                    String(Math.max(0, Number(referralRechargeRewardRate) || 0)),
                    '邀请返佣比例，按充值金币乘以该值计算奖励',
                  )}
                >
                  保存
                </Button>
              </Box>
            </FormControl>

            <FormControl>
              <FormLabel>返佣生效充值次数 (REFERRAL_RECHARGE_REWARD_LIMIT)</FormLabel>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input
                  type="number"
                  value={referralRechargeRewardLimit}
                  onChange={(e: any) => setReferralRechargeRewardLimit(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(
                    REFERRAL_RECHARGE_REWARD_LIMIT_KEY,
                    String(Math.max(1, Number(referralRechargeRewardLimit) || 1)),
                    '邀请返佣可生效的充值次数上限',
                  )}
                >
                  保存
                </Button>
              </Box>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Alert variant="soft" color="neutral">
        提示：设置保存在数据库中，切换开关后前台模型列表会按最新配置重新刷新。
      </Alert>
    </Stack>
  );
}
