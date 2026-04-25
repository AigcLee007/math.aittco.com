import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Link,
  Modal,
  ModalClose,
  ModalDialog,
  Stack,
  Typography,
} from '@mui/joy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useRouter } from 'next/router';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import { apiQuery } from '~/common/util/trpc.client';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [shareRef, setShareRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const referralPreviewQuery = apiQuery.auth.previewReferralShare.useQuery(
    { ref: shareRef },
    { enabled: !!shareRef, retry: false },
  );

  useEffect(() => {
    if (!error)
      return;

    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!router.isReady)
      return;

    const ref = Array.isArray(router.query.ref) ? router.query.ref[0] : router.query.ref;
    setShareRef(ref ? String(ref).trim() : '');
  }, [router.isReady, router.query.ref]);

  const loginMutation = apiQuery.auth.login.useMutation({
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      router.push('/');
    },
    onError: (err) => setError(err.message || '登录失败，请检查账号或密码'),
  });

  const registerMutation = apiQuery.auth.register.useMutation({
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      router.push('/');
    },
    onError: (err) => setError(err.message || '注册失败，请检查验证码或邮箱状态'),
  });

  const sendCodeMutation = apiQuery.auth.sendRegisterCode.useMutation({
    onSuccess: () => startCountdown(),
    onError: (err) => setError(err.message || '验证码发送失败，请稍后重试'),
  });

  const sendResetCodeMutation = apiQuery.auth.sendPasswordResetCode.useMutation({
    onSuccess: () => startCountdown(),
    onError: (err) => setError(err.message || '验证码发送失败，请稍后重试'),
  });

  const resetPasswordMutation = apiQuery.auth.resetPassword.useMutation({
    onSuccess: () => {
      setError(null);
      setIsForgotPassword(false);
      setIsLogin(true);
      setPassword('');
      setCode('');
      alert('密码重置成功，请使用新密码登录');
    },
    onError: (err) => setError(err.message || '密码重置失败'),
  });

  function startCountdown() {
    setError(null);
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const openAuth = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setIsForgotPassword(false);
    setError(null);
    setOpen(true);
  };

  const resetFormByMode = useMemo(() => () => {
    setError(null);
    setPassword('');
    setCode('');
    if (isLogin) {
      setIdentifier('');
    }
  }, [isLogin]);

  const handleSendCode = () => {
    setError(null);
    if (!email || !email.includes('@')) {
      setError('请输入有效的电子邮箱');
      return;
    }

    if (isForgotPassword)
      sendResetCodeMutation.mutate({ email });
    else
      sendCodeMutation.mutate({ email });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isForgotPassword) {
      if (!email || !email.includes('@')) return setError('请输入有效的电子邮箱');
      if (!code || code.length !== 6) return setError('请输入 6 位验证码');
      if (password.length < 6) return setError('新密码至少需要 6 位');
      resetPasswordMutation.mutate({ email, code, newPassword: password });
      return;
    }

    if (isLogin) {
      if (!identifier) return setError('请输入邮箱或用户名');
      if (!password) return setError('请输入密码');
      loginMutation.mutate({ identifier, password });
      return;
    }

    if (!nickname) return setError('请输入显示昵称');
    if (!email || !email.includes('@')) return setError('请输入有效的电子邮箱');
    if (!code || code.length !== 6) return setError('请输入 6 位验证码');
    if (password.length < 6) return setError('密码至少需要 6 位');

    registerMutation.mutate({
      email,
      password,
      nickname,
      username: username || undefined,
      invitationCode: invitationCode || undefined,
      shareRef: shareRef || undefined,
      code,
    });
  };

  const busy = loginMutation.isPending
    || registerMutation.isPending
    || sendCodeMutation.isPending
    || sendResetCodeMutation.isPending
    || resetPasswordMutation.isPending;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f6f5f2',
        background: 'linear-gradient(180deg, #f8f6f1 0%, #f1eee7 100%)',
        color: '#111',
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 4 }, py: { xs: 6, md: 10 } }}>
        <Stack spacing={4} alignItems='center'>
          <Stack spacing={2} alignItems='center' textAlign='center' sx={{ maxWidth: 760 }}>
            <Typography level='h1' sx={{ fontSize: { xs: '2.2rem', md: '4rem' }, fontWeight: 700 }}>
              数模工作台
            </Typography>
            <Typography level='body-lg' sx={{ maxWidth: 720, color: '#57534e' }}>
              在一个工作台里完成文本、图片、视频与数模协作任务。登录后即可开始使用模型、查看余额与管理充值。
            </Typography>
            <Stack direction='row' spacing={1.5} useFlexGap flexWrap='wrap' justifyContent='center'>
              <Button size='lg' onClick={() => openAuth(false)}>开始注册</Button>
              <Button size='lg' variant='outlined' color='neutral' onClick={() => openAuth(true)}>已有账号登录</Button>
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ width: '100%' }}>
            <Card variant='outlined' sx={{ flex: 1 }}>
              <CardContent>
                <Typography level='title-md'>文本模型</Typography>
                <Typography level='body-sm' sx={{ mt: 1, color: '#57534e' }}>
                  集中调用 GPT、Gemini、Claude 等文本模型，统一管理额度、价格与展示顺序。
                </Typography>
              </CardContent>
            </Card>
            <Card variant='outlined' sx={{ flex: 1 }}>
              <CardContent>
                <Typography level='title-md'>图片模型</Typography>
                <Typography level='body-sm' sx={{ mt: 1, color: '#57534e' }}>
                  支持多线路生图模型，适合活动海报、商品图、角色图和品牌视觉草图。
                </Typography>
              </CardContent>
            </Card>
            <Card variant='outlined' sx={{ flex: 1 }}>
              <CardContent>
                <Typography level='title-md'>视频模型</Typography>
                <Typography level='body-sm' sx={{ mt: 1, color: '#57534e' }}>
                  通过视频模型把创意延展成动态内容，并保留日志、画布记录和历史文件。
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Stack>
      </Box>

      <Modal open={open} onClose={() => { setOpen(false); resetFormByMode(); }}>
        <ModalDialog sx={{ width: 'min(100%, 520px)', p: 3 }}>
          <ModalClose />
          <Typography level='h2' sx={{ mb: 0.5 }}>
            {isForgotPassword ? '重置密码' : isLogin ? '欢迎回来' : '创建账号'}
          </Typography>
          <Typography level='body-sm' sx={{ color: '#666', mb: 2 }}>
            {isForgotPassword ? '输入邮箱、验证码和新密码完成重置。' : '登录以继续使用模型与查看余额。'}
          </Typography>

          {!isForgotPassword && (
            <Box sx={{ mb: 2, p: 0.5, bgcolor: '#f5f5f4', borderRadius: '999px', display: 'flex' }}>
              <Button
                fullWidth
                variant={isLogin ? 'solid' : 'plain'}
                color='neutral'
                onClick={() => { setIsLogin(true); setError(null); }}
              >
                登录
              </Button>
              <Button
                fullWidth
                variant={!isLogin ? 'solid' : 'plain'}
                color='neutral'
                onClick={() => { setIsLogin(false); setError(null); }}
              >
                注册
              </Button>
            </Box>
          )}

          <form onSubmit={onSubmit}>
            <Stack spacing={2}>
              {error && <Alert color='danger'>{error}</Alert>}

              {!isLogin && !isForgotPassword && shareRef && (
                <Alert color={referralPreviewQuery.data?.valid ? 'success' : 'warning'}>
                  {referralPreviewQuery.data?.valid
                    ? `通过 ${referralPreviewQuery.data.referrerNickname} 的分享链接注册，可额外获得 ${referralPreviewQuery.data.signupRewardCoins} 金币。`
                    : '当前分享链接无效，注册时不会发放分享奖励。'}
                </Alert>
              )}

              {isLogin && !isForgotPassword && (
                <FormControl>
                  <FormLabel>邮箱 / 用户名</FormLabel>
                  <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
                </FormControl>
              )}

              {!isLogin && !isForgotPassword && (
                <>
                  <FormControl>
                    <FormLabel>显示昵称</FormLabel>
                    <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>电子邮箱</FormLabel>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>验证码</FormLabel>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      endDecorator={(
                        <Button size='sm' variant='soft' disabled={countdown > 0 || sendCodeMutation.isPending} onClick={handleSendCode}>
                          {countdown > 0 ? `${countdown}s` : '获取验证码'}
                        </Button>
                      )}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>登录用户名（选填）</FormLabel>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} />
                  </FormControl>
                </>
              )}

              {isForgotPassword && (
                <>
                  <FormControl>
                    <FormLabel>电子邮箱</FormLabel>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>验证码</FormLabel>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      endDecorator={(
                        <Button size='sm' variant='soft' disabled={countdown > 0 || sendResetCodeMutation.isPending} onClick={handleSendCode}>
                          {countdown > 0 ? `${countdown}s` : '获取验证码'}
                        </Button>
                      )}
                    />
                  </FormControl>
                </>
              )}

              <FormControl>
                <FormLabel>{isForgotPassword ? '新密码' : '密码'}</FormLabel>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  endDecorator={(
                    <IconButton variant='plain' color='neutral' onClick={() => setShowPassword((prev) => !prev)}>
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  )}
                />
              </FormControl>

              {!isLogin && !isForgotPassword && (
                <FormControl>
                  <FormLabel>邀请码（选填）</FormLabel>
                  <Input value={invitationCode} onChange={(e) => setInvitationCode(e.target.value)} />
                </FormControl>
              )}

              <Button type='submit' size='lg' loading={busy}>
                {isForgotPassword ? '立即重置密码' : isLogin ? '立即登录' : '立即注册'}
              </Button>

              {isLogin && !isForgotPassword && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                  <Typography level='body-sm'>还没有账号？ <Link component='button' onClick={() => { setIsLogin(false); setError(null); }}>创建一个新账号</Link></Typography>
                  <Link component='button' onClick={() => { setIsForgotPassword(true); setError(null); }}>忘记密码？</Link>
                </Box>
              )}

              {!isLogin && !isForgotPassword && (
                <Typography level='body-sm'>已有账号？ <Link component='button' onClick={() => { setIsLogin(true); setError(null); }}>立即返回登录</Link></Typography>
              )}

              {isForgotPassword && (
                <Typography level='body-sm'>想起密码了？ <Link component='button' onClick={() => { setIsForgotPassword(false); setIsLogin(true); setError(null); }}>返回登录</Link></Typography>
              )}
            </Stack>
          </form>
        </ModalDialog>
      </Modal>
    </Box>
  );
};
