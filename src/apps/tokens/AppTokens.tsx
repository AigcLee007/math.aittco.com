import * as React from 'react';
import { Box, Button, Card, Chip, Divider, Grid, Input, Stack, Typography } from '@mui/joy';
import SavingsIcon from '@mui/icons-material/Savings';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import RedeemIcon from '@mui/icons-material/Redeem';
import { useRouter } from 'next/router';

import { AppSmallContainer } from '../AppSmallContainer';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import { copyToClipboard } from '~/common/util/clipboardUtils';

type PayChannel = 'ALIPAY' | 'WECHAT';

type RechargeOption = {
  id: string;
  amountYuan: number;
  coinAmount: number;
  label: string;
  expiresInDays?: number | null;
  isActive?: boolean;
  sortOrder?: number;
  popular?: boolean;
};

type ChatModelPricing = {
  modelId: string;
  modelName: string;
  coinCost: number;
};

type GenerateModelPricing = {
  modelId: string;
  modelName: string;
  coinCost: number;
  category: 'IMAGE' | 'VIDEO';
};

type RecentReward = {
  referredUserId: string;
  referredNickname: string;
  type: 'SIGNUP' | 'RECHARGE';
  rewardCoins: number;
  rechargeSequence?: number | null;
  createdAt: string;
};

type ReferralSummary = {
  shareCode: string;
  signupRewardPerUser: number;
  rechargeRewardRate: number;
  rechargeRewardLimit: number;
  invitedUsers: number;
  totalRewardCoins: number;
  rechargeRewardCount: number;
  recentRewards: RecentReward[];
};

const COIN_ICON = '\u{1FA99}';
const LAST_PENDING_ORDER_KEY = 'last_pending_order_no';
const LAST_PAYMENT_INTENT_AT_KEY = 'last_payment_intent_at';
const LAST_SETTLED_ORDER_KEY = 'last_settled_order_no';
const PAYMENT_WATCH_WINDOW_MS = 15 * 60 * 1000;

const FALLBACK_RECHARGE_OPTIONS: RechargeOption[] = [
  { id: 'starter_1', amountYuan: 1, coinAmount: 30, label: '体验包', expiresInDays: null },
  { id: 'basic_10', amountYuan: 10, coinAmount: 300, label: '基础包', popular: true, expiresInDays: null },
  { id: 'hot_30', amountYuan: 30, coinAmount: 900, label: '热门包', expiresInDays: null },
  { id: 'plus_50', amountYuan: 50, coinAmount: 1600, label: '进阶包', expiresInDays: null },
  { id: 'pro_100', amountYuan: 100, coinAmount: 3500, label: '专业包', expiresInDays: null },
  { id: 'ultra_200', amountYuan: 200, coinAmount: 7500, label: '旗舰包', expiresInDays: null },
];

function pickFirstQueryValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function calcUsableTimes(coins: number, cost?: number | null) {
  if (!cost || cost <= 0)
    return '--';
  return String(Math.floor(coins / cost));
}

function normalizeModelId(modelId?: string) {
  return (modelId || '').trim().replace(/^models\//i, '').toLowerCase();
}

function matchesImageFamily(model: GenerateModelPricing, family: 'nano-banana-pro' | 'nano-banana-2') {
  const modelId = normalizeModelId(model.modelId);
  const modelName = (model.modelName || '').trim().toLowerCase();

  if (family === 'nano-banana-pro') {
    return modelId === 'gemini-3-pro-image-preview'
      || modelId === 'nano-banana-2'
      || modelName.includes('nano banana pro');
  }

  return modelId === 'gemini-3.1-flash-image-preview'
    || modelName.includes('nano banana 2');
}

function normalizeRechargePackageLabel(label?: string, packageId?: string) {
  const normalizedLabel = (label || '').trim().toLowerCase();
  const normalizedPackageId = (packageId || '').trim().toLowerCase();

  const lookupTable: Array<[string, string]> = [
    ['starter pack', '体验包'],
    ['basic pack', '基础包'],
    ['hot pack', '热门包'],
    ['plus pack', '进阶包'],
    ['pro pack', '专业包'],
    ['ultra pack', '旗舰包'],
    ['starter_1', '体验包'],
    ['basic_10', '基础包'],
    ['hot_30', '热门包'],
    ['plus_50', '进阶包'],
    ['pro_100', '专业包'],
    ['ultra_200', '旗舰包'],
  ];

  for (const [key, displayName] of lookupTable) {
    if (normalizedLabel === key || normalizedPackageId === key)
      return displayName;
  }

  return label || packageId || '充值套餐';
}

export function AppTokens() {
  const { user, accessToken } = useAuthStore();
  const router = useRouter();
  const utils = apiQuery.useUtils();

  const [selectedChannel, setSelectedChannel] = React.useState<PayChannel>('WECHAT');
  const [pendingOrderNo, setPendingOrderNo] = React.useState<string | null>(null);
  const [payHint, setPayHint] = React.useState<string | null>(null);
  const [redeemCodeInput, setRedeemCodeInput] = React.useState('');
  const [redeemHint, setRedeemHint] = React.useState<string | null>(null);
  const [watchRecentPayment, setWatchRecentPayment] = React.useState(false);
  const handledPaidOrderRef = React.useRef<string | null>(null);

  const { data: coinData, refetch: refetchBalance } = apiQuery.coin.getBalance.useQuery(undefined, {
    enabled: !!accessToken,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: packageData, error: packageError } = apiQuery.payment.getRechargePackages.useQuery(undefined, {
    enabled: !!accessToken,
  });

  const referralSummaryQuery = apiQuery.coin.getReferralSummary.useQuery(undefined, {
    enabled: !!accessToken,
  });

  const { data: chatModelPricing } = (apiQuery.coin.getChatModels as any).useQuery(undefined, {
    enabled: !!accessToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10_000,
  });

  const { data: generateModelPricing } = (apiQuery.coin.getGenerateModels as any).useQuery(undefined, {
    enabled: !!accessToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10_000,
  });

  React.useEffect(() => {
    if (!router.isReady || pendingOrderNo) return;

    const fromQuery = pickFirstQueryValue(router.query.orderNo)
      || pickFirstQueryValue(router.query.out_trade_no)
      || pickFirstQueryValue(router.query.trade_order_id);

    if (fromQuery) {
      if (typeof window !== 'undefined') {
        const settledOrderNo = localStorage.getItem(LAST_SETTLED_ORDER_KEY);
        if (settledOrderNo === fromQuery) {
          localStorage.removeItem(LAST_PENDING_ORDER_KEY);
          localStorage.removeItem(LAST_PAYMENT_INTENT_AT_KEY);
          if (router.asPath.includes('?'))
            void router.replace('/tokens', undefined, { shallow: true });
          return;
        }
      }
      setPendingOrderNo(fromQuery);
      setWatchRecentPayment(true);
      setPayHint('检测到回跳订单，正在确认支付状态...');
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_PENDING_ORDER_KEY, fromQuery);
        if (router.asPath.includes('?'))
          void router.replace('/tokens', undefined, { shallow: true });
      }
      return;
    }

    if (typeof window !== 'undefined') {
      const lastPending = localStorage.getItem(LAST_PENDING_ORDER_KEY);
      if (lastPending) {
        setPendingOrderNo(lastPending);
        setWatchRecentPayment(true);
        setPayHint('正在确认最近订单支付状态...');
      }

      const intentAtRaw = localStorage.getItem(LAST_PAYMENT_INTENT_AT_KEY);
      const intentAt = intentAtRaw ? Number(intentAtRaw) : 0;
      if (intentAt > 0 && (Date.now() - intentAt) <= PAYMENT_WATCH_WINDOW_MS)
        setWatchRecentPayment(true);
    }
  }, [router.isReady, router.query.orderNo, router.query.out_trade_no, router.query.trade_order_id, pendingOrderNo, router]);

  const orderStatusQuery = apiQuery.payment.getOrderStatus.useQuery(
    { orderNo: pendingOrderNo || '' },
    {
      enabled: !!accessToken && !!pendingOrderNo,
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (!status || status === 'PENDING') return 2000;
        return false;
      },
    },
  );

  const latestOrderQuery = apiQuery.payment.getLatestOrder.useQuery(undefined, {
    enabled: !!accessToken && watchRecentPayment,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (query) => {
      if (!watchRecentPayment) return false;
      const status = query.state.data?.status;
      if (!status || status === 'PENDING') return 2000;
      return false;
    },
  });

  const finalizePaidOrder = React.useCallback((orderNo: string, currentBalance?: number | null) => {
    if (!orderNo || handledPaidOrderRef.current === orderNo)
      return;

    handledPaidOrderRef.current = orderNo;
    if (typeof currentBalance === 'number')
      utils.coin.getBalance.setData(undefined, { balance: currentBalance });
    setPendingOrderNo(null);
    setWatchRecentPayment(false);
    setPayHint('支付已确认，金币已到账。');
    void refetchBalance();

    if (typeof window !== 'undefined') {
      localStorage.removeItem(LAST_PENDING_ORDER_KEY);
      localStorage.removeItem(LAST_PAYMENT_INTENT_AT_KEY);
      localStorage.setItem(LAST_SETTLED_ORDER_KEY, orderNo);
    }

    if (router.isReady && (router.query.orderNo || router.query.out_trade_no || router.query.trade_order_id))
      void router.replace('/tokens', undefined, { shallow: true });
  }, [refetchBalance, router, utils.coin.getBalance]);

  React.useEffect(() => {
    if (!accessToken) return;
    const refreshAll = () => {
      void refetchBalance();
      if (pendingOrderNo)
        void orderStatusQuery.refetch();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible')
        refreshAll();
    };
    const onPageShow = () => {
      refreshAll();
    };
    window.addEventListener('focus', refreshAll);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refreshAll);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [accessToken, pendingOrderNo, refetchBalance, orderStatusQuery]);

  React.useEffect(() => {
    if (!accessToken || !watchRecentPayment) return;
    const timer = setInterval(() => {
      void refetchBalance();
    }, 2000);
    return () => clearInterval(timer);
  }, [accessToken, watchRecentPayment, refetchBalance]);

  React.useEffect(() => {
    if (!accessToken) return;
    const timer = setInterval(() => {
      void refetchBalance();
    }, 4000);
    return () => clearInterval(timer);
  }, [accessToken, refetchBalance]);

  React.useEffect(() => {
    if (!watchRecentPayment || !latestOrderQuery.data) return;

    const latest = latestOrderQuery.data;
    if (latest.status === 'PENDING') {
      if (!pendingOrderNo || pendingOrderNo !== latest.orderNo) {
        setPendingOrderNo(latest.orderNo);
        setPayHint('订单已创建，正在确认支付状态...');
        if (typeof window !== 'undefined')
          localStorage.setItem(LAST_PENDING_ORDER_KEY, latest.orderNo);
      }
      return;
    }

    if (latest.status === 'PAID')
      finalizePaidOrder(latest.orderNo, latest.currentBalance);
  }, [watchRecentPayment, latestOrderQuery.data, pendingOrderNo, finalizePaidOrder]);

  const paidOrderNo = orderStatusQuery.data?.status === 'PAID'
    ? orderStatusQuery.data.orderNo
    : null;

  React.useEffect(() => {
    if (!paidOrderNo) return;
    finalizePaidOrder(paidOrderNo, orderStatusQuery.data?.currentBalance);
  }, [paidOrderNo, orderStatusQuery.data?.currentBalance, finalizePaidOrder]);

  const createOrderMutation = apiQuery.payment.createOrder.useMutation({
    onSuccess: (res) => {
      if (res.payUrl) {
        setPendingOrderNo(res.orderNo);
        setWatchRecentPayment(true);
        setPayHint(res.message || null);
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_PENDING_ORDER_KEY, res.orderNo);
          localStorage.setItem(LAST_PAYMENT_INTENT_AT_KEY, String(Date.now()));
        }
        window.location.assign(res.payUrl);
        return;
      }

      setPendingOrderNo(null);
      setWatchRecentPayment(false);
      setPayHint(res.message || '订单已创建，但未拿到支付链接，请检查支付配置。');
    },
  });

  const redeemCodeMutation = apiQuery.coin.redeemCode.useMutation({
    onSuccess: (res) => {
      setRedeemHint(`兑换成功，+${res.coinAmount} 金币`);
      setRedeemCodeInput('');
      utils.coin.getBalance.setData(undefined, { balance: res.newBalance });
      void refetchBalance();
    },
    onError: (err: any) => {
      setRedeemHint(err?.message || '兑换失败');
    },
  });

  const rechargeOptions: RechargeOption[] = React.useMemo(() => {
    const source = packageData?.items?.length ? packageData.items : FALLBACK_RECHARGE_OPTIONS;
    return [...source].sort((a, b) => {
      if (!!a.popular !== !!b.popular)
        return a.popular ? -1 : 1;
      if (a.amountYuan !== b.amountYuan)
        return a.amountYuan - b.amountYuan;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [packageData?.items]);

  const chatPricing = React.useMemo<ChatModelPricing[]>(() => {
    if (!Array.isArray(chatModelPricing))
      return [];
    return [...chatModelPricing]
      .filter((item): item is ChatModelPricing => !!item && typeof item.coinCost === 'number' && typeof item.modelId === 'string')
      .sort((a, b) => a.coinCost - b.coinCost || (a.modelName || a.modelId).localeCompare(b.modelName || b.modelId));
  }, [chatModelPricing]);

  const generatePricing = React.useMemo<GenerateModelPricing[]>(() => {
    if (!Array.isArray(generateModelPricing))
      return [];
    return [...generateModelPricing]
      .filter((item): item is GenerateModelPricing => !!item && typeof item.coinCost === 'number' && typeof item.modelId === 'string' && (item.category === 'IMAGE' || item.category === 'VIDEO'));
  }, [generateModelPricing]);

  const cheapestChatModel = chatPricing[0] || null;
  const cheapestImageModel = React.useMemo(() => {
    return generatePricing
      .filter(item => item.category === 'IMAGE')
      .sort((a, b) => a.coinCost - b.coinCost || (a.modelName || a.modelId).localeCompare(b.modelName || b.modelId))[0] || null;
  }, [generatePricing]);

  const cheapestVideoModel = React.useMemo(() => {
    return generatePricing
      .filter(item => item.category === 'VIDEO')
      .sort((a, b) => a.coinCost - b.coinCost || (a.modelName || a.modelId).localeCompare(b.modelName || b.modelId))[0] || null;
  }, [generatePricing]);
  const cheapestNanoBananaProModel = React.useMemo(() => {
    return generatePricing
      .filter(item => item.category === 'IMAGE' && matchesImageFamily(item, 'nano-banana-pro'))
      .sort((a, b) => a.coinCost - b.coinCost || (a.modelName || a.modelId).localeCompare(b.modelName || b.modelId))[0] || null;
  }, [generatePricing]);

  const cheapestNanoBanana2Model = React.useMemo(() => {
    return generatePricing
      .filter(item => item.category === 'IMAGE' && matchesImageFamily(item, 'nano-banana-2'))
      .sort((a, b) => a.coinCost - b.coinCost || (a.modelName || a.modelId).localeCompare(b.modelName || b.modelId))[0] || null;
  }, [generatePricing]);

  const referralSummary = referralSummaryQuery.data as ReferralSummary | undefined;

  const shareLink = React.useMemo(() => {
    if (!referralSummary || typeof window === 'undefined')
      return '';
    return `${window.location.origin}/auth?ref=${encodeURIComponent(referralSummary.shareCode)}`;
  }, [referralSummary]);

  const handleCreateOrder = (packageId: string) => {
    createOrderMutation.mutate({
      packageId,
      channel: selectedChannel,
    });
  };

  return (
    <AppSmallContainer
      title='金币中心'
      description='查看余额并通过微信支付购买金币'
    >
      <Card
        variant='outlined'
        sx={{
          mb: 2,
          borderRadius: '20px',
          borderColor: 'divider',
          boxShadow: 'sm',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.level1',
          }}
        >
          <Typography level='title-sm'>账户与充值</Typography>
        </Box>
        <Box
          sx={{
            p: 2.5,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box>
            <Typography level='body-sm' sx={{ opacity: 0.75 }}>当前余额</Typography>
            <Typography level='h2' sx={{ mt: 0.75, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SavingsIcon sx={{ fontSize: '2rem', color: 'primary.500' }} />
              {coinData?.balance ?? 0}
              <Box component='span' sx={{ opacity: 0.8, fontSize: '1.125rem', lineHeight: 1 }} aria-label='coin'>
                {COIN_ICON}
              </Box>
            </Typography>
            <Typography level='body-xs' sx={{ mt: 1, opacity: 0.7 }}>
              充值后可立即用于文本、生图和视频模型调用。
            </Typography>
          </Box>

          <Stack spacing={1} sx={{ minWidth: { sm: 180 }, width: { xs: '100%', sm: 'auto' } }}>
            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography level='body-xs' sx={{ opacity: 0.7 }}>账户类型</Typography>
              <Chip color='success' variant='soft' size='sm' sx={{ mt: 0.5 }}>
                {user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' ? '管理员' : '用户'}
              </Chip>
            </Box>
            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography level='body-xs' sx={{ opacity: 0.7, mb: 0.5 }}>支付方式</Typography>
              <Stack direction='row' spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                <Button
                  size='sm'
                  variant={selectedChannel === 'WECHAT' ? 'solid' : 'soft'}
                  color={selectedChannel === 'WECHAT' ? 'primary' : 'neutral'}
                  startDecorator={<QrCode2Icon />}
                  onClick={() => setSelectedChannel('WECHAT')}
                >
                  微信支付
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Card>

      <Typography level='title-lg' sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddCircleOutlineIcon color='primary' /> 充值套餐
      </Typography>

      <Card variant='outlined' sx={{ mb: 2, overflow: 'hidden' }}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.level1',
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
            <Box>
              <Typography level='title-sm'>价格说明与用量参考</Typography>
              <Typography level='body-xs' sx={{ opacity: 0.72, mt: 0.5 }}>
                根据后台当前启用的模型定价实时计算，适合在充值前快速估算常用模型的大致可用次数。
              </Typography>
            </Box>
            <Chip size='sm' variant='soft' color='primary'>
              实时价格
            </Chip>
          </Stack>
        </Box>

        <Box sx={{ p: 2 }}>
          <Grid container spacing={1.5}>
            <Grid xs={12} md={4}>
              <Card variant='soft' sx={{ height: '100%', bgcolor: 'background.level1', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ p: 2 }}>
                  <Typography level='body-xs' sx={{ opacity: 0.72 }}>文本模型最低门槛</Typography>
                  <Typography level='h3' sx={{ mt: 1, fontSize: '1.75rem' }}>
                    {cheapestChatModel?.coinCost ?? '--'}
                    <Typography component='span' level='body-sm' sx={{ ml: 0.75, opacity: 0.72 }}>
                      金币 / 次
                    </Typography>
                  </Typography>
                  <Typography level='body-xs' sx={{ opacity: 0.75, mt: 1.25 }}>
                    当前最低模型：{cheapestChatModel?.modelName || '暂未配置'}
                  </Typography>
                </Box>
              </Card>
            </Grid>
            <Grid xs={12} md={4}>
              <Card
                variant='soft'
                sx={{
                  height: '100%',
                  bgcolor: 'rgba(var(--joy-palette-success-mainChannel) / 0.06)',
                  border: '1px solid',
                  borderColor: 'success.softBorder',
                }}
              >
                <Box sx={{ p: 2 }}>
                  <Chip size='sm' color='success' variant='soft' sx={{ mb: 1 }}>
                    推荐家族
                  </Chip>
                  <Typography level='title-lg'>Nano Banana Pro</Typography>
                  <Typography level='h4' sx={{ mt: 1, color: 'success.700' }}>
                    {cheapestNanoBananaProModel?.coinCost ?? '--'}
                    <Typography component='span' level='body-sm' sx={{ ml: 0.75, color: 'inherit', opacity: 0.8 }}>
                      金币 / 次
                    </Typography>
                  </Typography>
                  <Typography level='body-xs' sx={{ opacity: 0.75, mt: 1.25 }}>
                    当前最低线路：{cheapestNanoBananaProModel?.modelName || '暂未配置'}
                  </Typography>
                </Box>
              </Card>
            </Grid>
            <Grid xs={12} md={4}>
              <Card
                variant='soft'
                sx={{
                  height: '100%',
                  bgcolor: 'rgba(var(--joy-palette-warning-mainChannel) / 0.08)',
                  border: '1px solid',
                  borderColor: 'warning.softBorder',
                }}
              >
                <Box sx={{ p: 2 }}>
                  <Chip size='sm' color='warning' variant='soft' sx={{ mb: 1 }}>
                    推荐家族
                  </Chip>
                  <Typography level='title-lg'>Nano Banana 2</Typography>
                  <Typography level='h4' sx={{ mt: 1, color: 'warning.700' }}>
                    {cheapestNanoBanana2Model?.coinCost ?? '--'}
                    <Typography component='span' level='body-sm' sx={{ ml: 0.75, color: 'inherit', opacity: 0.8 }}>
                      金币 / 次
                    </Typography>
                  </Typography>
                  <Typography level='body-xs' sx={{ opacity: 0.75, mt: 1.25 }}>
                    当前最低线路：{cheapestNanoBanana2Model?.modelName || '暂未配置'}
                  </Typography>
                </Box>
              </Card>
            </Grid>
          </Grid>

          <Card variant='soft' sx={{ mt: 1.5, bgcolor: 'background.level1' }}>
            <Box sx={{ px: 1.5, py: 1.25 }}>
              <Typography level='body-xs' sx={{ opacity: 0.78, lineHeight: 1.8 }}>
                当前启用模型的最低门槛：
                文本 {cheapestChatModel?.coinCost ?? '--'} 金币 / 次，
                生图 {cheapestImageModel?.coinCost ?? '--'} 金币 / 次，
                视频 {cheapestVideoModel?.coinCost ?? '--'} 金币 / 次。
              </Typography>
            </Box>
          </Card>
        </Box>
      </Card>

      {packageError && (
        <Card variant='soft' color='warning' sx={{ mb: 2 }}>
          <Typography level='body-sm'>
            服务器套餐配置加载失败，已显示默认套餐。
          </Typography>
        </Card>
      )}

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 4 }}>
        {rechargeOptions.map((opt) => (
          <Grid key={opt.id} xs={12} sm={opt.popular ? 12 : 6} md={4}>
            <Card
              variant={opt.popular ? 'soft' : 'outlined'}
              color={opt.popular ? 'primary' : 'neutral'}
              sx={{
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: { xs: '16px', md: '18px' },
                borderWidth: opt.popular ? 2 : 1,
                borderColor: opt.popular ? 'primary.500' : 'divider',
                boxShadow: opt.popular ? 'xl' : 'xs',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                bgcolor: opt.popular ? 'rgba(var(--joy-palette-primary-mainChannel) / 0.10)' : 'background.surface',
                opacity: opt.popular ? 1 : 0.92,
                transform: opt.popular ? { md: 'scale(1.02)' } : 'none',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: opt.popular ? 'xl' : 'md',
                  borderColor: opt.popular ? 'primary.500' : 'neutral.300',
                  opacity: 1,
                },
              }}
              onClick={() => handleCreateOrder(opt.id)}
            >
              {opt.popular && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(var(--joy-palette-primary-mainChannel) / 0.10) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.02) 45%, transparent 100%)',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {opt.popular && (
                <Chip
                  size='sm'
                  color='warning'
                  sx={{ position: 'absolute', top: 12, right: 12, fontWeight: 800, zIndex: 1, boxShadow: 'sm' }}
                >
                  推荐
                </Chip>
              )}

              <Box sx={{ position: 'relative', zIndex: 1, p: { xs: 1.5, md: 2 } }}>
                <Typography level='title-md' sx={{ fontWeight: 700, fontSize: { xs: '0.98rem', sm: '1.05rem', md: '1.125rem' } }}>
                  {normalizeRechargePackageLabel(opt.label, opt.id)}
                </Typography>
                {opt.popular && (
                  <Typography
                    level='body-xs'
                    sx={{
                      mt: 0.5,
                      color: 'primary.700',
                      fontWeight: 600,
                      opacity: 0.92,
                    }}
                  >
                    更适合高频使用，单次充值更省心。
                  </Typography>
                )}
                <Typography level='h2' sx={{ my: { xs: 1, md: 1.25 }, fontSize: { xs: '1.75rem', md: '2rem' }, fontWeight: 800 }}>
                  {opt.coinAmount}
                  <Box component='span' sx={{ ml: 0.5, fontSize: { xs: '0.85rem', md: '0.95rem' }, lineHeight: 1 }} aria-label='coin'>
                    {COIN_ICON}
                  </Box>
                </Typography>

                <Card
                  variant='soft'
                  sx={{
                    mb: 1.25,
                    textAlign: 'left',
                    bgcolor: opt.popular ? 'rgba(var(--joy-palette-primary-mainChannel) / 0.08)' : 'background.level1',
                    border: '1px solid',
                    borderColor: opt.popular ? 'primary.softBorder' : 'divider',
                  }}
                >
                  <Box sx={{ px: { xs: 1, md: 1.25 }, py: { xs: 0.9, md: 1 } }}>
                    <Typography level='body-xs' sx={{ opacity: 0.72, mb: 0.75 }}>
                      套餐信息
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                      <Typography level='body-xs' sx={{ opacity: 0.72 }}>价格</Typography>
                      <Typography level='body-sm' fontWeight='lg'>￥{opt.amountYuan}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography level='body-xs' sx={{ opacity: 0.72 }}>有效期</Typography>
                      <Typography level='body-sm' fontWeight='lg'>{opt.expiresInDays ? `${opt.expiresInDays} 天` : '不限时'}</Typography>
                    </Box>
                  </Box>
                </Card>

                <Card
                  variant='soft'
                  sx={{
                    mt: 1,
                    textAlign: 'left',
                    bgcolor: 'background.level1',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ px: { xs: 1, md: 1.25 }, py: { xs: 0.9, md: 1 } }}>
                    <Typography level='body-xs' sx={{ opacity: 0.75, mb: 0.75 }}>
                      大约可用
                    </Typography>
                    <Box sx={{ display: 'grid', rowGap: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography level='body-xs' sx={{ opacity: 0.78 }}>Nano Banana Pro</Typography>
                        <Typography level='body-xs' fontWeight='lg'>{calcUsableTimes(opt.coinAmount, cheapestNanoBananaProModel?.coinCost)} 张</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography level='body-xs' sx={{ opacity: 0.78 }}>Nano Banana 2</Typography>
                        <Typography level='body-xs' fontWeight='lg'>{calcUsableTimes(opt.coinAmount, cheapestNanoBanana2Model?.coinCost)} 张</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography level='body-xs' sx={{ opacity: 0.78 }}>文本模型</Typography>
                        <Typography level='body-xs' fontWeight='lg'>{calcUsableTimes(opt.coinAmount, cheapestChatModel?.coinCost)} 次</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Card>
              </Box>

              <Button
                size='md'
                fullWidth
                color={opt.popular ? 'primary' : 'neutral'}
                variant={opt.popular ? 'solid' : 'soft'}
                loading={createOrderMutation.isPending}
                sx={{
                  mt: 1.25,
                  borderRadius: '12px',
                  fontWeight: 700,
                  bgcolor: opt.popular ? 'primary.500' : 'rgba(var(--joy-palette-primary-mainChannel) / 0.08)',
                  color: opt.popular ? '#fff' : 'primary.700',
                  minHeight: { xs: 42, md: 44 },
                  fontSize: { xs: '0.95rem', md: '1rem' },
                }}
              >
                立即下单
              </Button>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card variant='soft' sx={{ mb: 2 }}>
        <Box sx={{ p: 2 }}>
          <Typography level='title-sm' sx={{ mb: 1.5 }}>
            分享邀请
          </Typography>
          <Typography level='body-sm' sx={{ opacity: 0.8, mb: 1.5 }}>
            邀请新用户通过你的分享链接注册，对方可获得 {referralSummary?.signupRewardPerUser ?? 20} 金币奖励；对方前 {referralSummary?.rechargeRewardLimit ?? 3} 次充值，你可获得充值金币的 {(referralSummary?.rechargeRewardRate ?? 0.05) * 100}% 奖励。
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
            <Input value={shareLink} readOnly placeholder='登录后自动生成分享链接' sx={{ flex: 1 }} />
            <Button disabled={!shareLink} onClick={() => copyToClipboard(shareLink, '分享链接')}>
              复制链接
            </Button>
          </Stack>
          <Grid container spacing={1.5}>
            <Grid xs={12} sm={4}>
              <Card variant='outlined'>
                <Typography level='body-xs'>邀请注册人数</Typography>
                <Typography level='h4'>{referralSummary?.invitedUsers ?? 0}</Typography>
              </Card>
            </Grid>
            <Grid xs={12} sm={4}>
              <Card variant='outlined'>
                <Typography level='body-xs'>累计邀请奖励</Typography>
                <Typography level='h4'>
                  {referralSummary?.totalRewardCoins ?? 0}
                  <Box component='span' sx={{ ml: 0.5, fontSize: '0.85rem', lineHeight: 1 }} aria-label='coin'>
                    {COIN_ICON}
                  </Box>
                </Typography>
              </Card>
            </Grid>
            <Grid xs={12} sm={4}>
              <Card variant='outlined'>
                <Typography level='body-xs'>充值返佣次数</Typography>
                <Typography level='h4'>{referralSummary?.rechargeRewardCount ?? 0}</Typography>
              </Card>
            </Grid>
          </Grid>
          {!!referralSummary?.recentRewards?.length && (
            <Box sx={{ mt: 1.5 }}>
              <Typography level='body-sm' sx={{ mb: 1 }}>
                最近奖励
              </Typography>
              <Stack spacing={1}>
                {referralSummary.recentRewards.map((item) => (
                  <Box
                    key={`${item.type}-${item.referredUserId}-${item.createdAt}`}
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px', bgcolor: '#fff', px: 1.5, py: 1 }}
                  >
                    <Box>
                      <Typography level='body-sm'>
                        {item.referredNickname}
                        {item.type === 'SIGNUP' ? ' 完成注册' : ` 完成第 ${item.rechargeSequence} 次充值`}
                      </Typography>
                      <Typography level='body-xs' sx={{ opacity: 0.7 }}>
                        {formatDateTime(item.createdAt)}
                      </Typography>
                    </Box>
                    <Typography level='title-sm' sx={{ color: 'success.700' }}>
                      +{item.rewardCoins}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Card>

      <Card variant='outlined' sx={{ mb: 2 }}>
        <Box sx={{ p: 2 }}>
          <Typography level='title-sm' sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <RedeemIcon fontSize='small' /> 兑换码兑换
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Input
              value={redeemCodeInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRedeemCodeInput(e.target.value.toUpperCase())}
              placeholder='输入兑换码'
            />
            <Button
              onClick={() => redeemCodeMutation.mutate({ code: redeemCodeInput.trim() })}
              loading={redeemCodeMutation.isPending}
              disabled={!redeemCodeInput.trim()}
            >
              立即兑换
            </Button>
          </Stack>
          {redeemHint && (
            <Typography level='body-xs' sx={{ mt: 1, opacity: 0.85 }}>
              {redeemHint}
            </Typography>
          )}
        </Box>
      </Card>

      {payHint && (
        <Card variant='soft' color='warning' sx={{ mb: 2 }}>
          <Typography level='body-sm'>{payHint}</Typography>
          {pendingOrderNo && (
            <Typography level='body-xs' sx={{ mt: 0.5 }}>
              待确认订单：{pendingOrderNo}
            </Typography>
          )}
        </Card>
      )}

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button
          variant='plain'
          color='neutral'
          size='sm'
          startDecorator={<HistoryIcon />}
          onClick={() => router.push('/billing')}
        >
          查看消费记录
        </Button>
      </Box>
    </AppSmallContainer>
  );
}
