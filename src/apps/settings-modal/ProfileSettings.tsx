import * as React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Stack,
  Typography,
} from '@mui/joy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import { apiQuery } from '~/common/util/trpc.client';

type BuiltinAvatarOption = {
  id: string;
  src: string;
};

const BUILTIN_AVATAR_FILES = [
  '3DDD.png',
  'Afterclap-4.png',
  'Afterclap.png',
  'Delivery boy.png',
  'E-commerce-1.png',
  'E-commerce-2.png',
  'Funny Bunny-3.png',
  'Guacamole-1.png',
  'No comments 3.png',
  'No comments 8.png',
  'No Comments-1.png',
  'No gravity-3.png',
  'OSLO-12.png',
  'OSLO-7.png',
  'Teamwork-2.png',
  'Teamwork-3.png',
  'Teamwork-6.png',
  'Upstream-2.png',
  'Upstream-4.png',
  'Upstream-8.png',
] as const;

export function ProfileSettings() {
  const { user, setUser } = useAuthStore();
  const [nickname, setNickname] = React.useState(user?.nickname || '');
  const [avatar, setAvatar] = React.useState(user?.avatar || '');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [verificationCode, setVerificationCode] = React.useState('');
  const [countdown, setCountdown] = React.useState(0);

  React.useEffect(() => {
    setNickname(user?.nickname || '');
    setAvatar(user?.avatar || '');
  }, [user?.nickname, user?.avatar]);

  const builtinAvatarOptions = React.useMemo(
    () => BUILTIN_AVATAR_FILES.map((fileName) => ({
      id: fileName,
      src: `/avatars/builtin/${encodeURIComponent(fileName)}`,
    }) satisfies BuiltinAvatarOption),
    [],
  );

  const updateProfileMutation = apiQuery.auth.updateProfile.useMutation({
    onSuccess: (data: any) => {
      if (user) {
        setUser({
          ...user,
          shortId: data.shortId ?? user.shortId,
          nickname: data.nickname ?? user.nickname,
          avatar: data.avatar ?? user.avatar,
        });
      }
      setSuccess(true);
      setError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setVerificationCode('');
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || '更新失败');
      setSuccess(false);
    },
  });

  const sendCodeMutation = apiQuery.auth.sendChangePasswordCode.useMutation({
    onSuccess: () => {
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
    },
    onError: (err: any) => {
      setError(err.message || '验证码发送失败');
    },
  });

  const handleSave = () => {
    if (!user) return;

    setError(null);

    if (nickname.trim().length < 2) {
      setError('昵称至少需要 2 个字符');
      return;
    }

    if (currentPassword && !newPassword) {
      setError('请输入新密码');
      return;
    }

    if (newPassword) {
      if (!currentPassword) {
        setError('请输入旧密码');
        return;
      }
      if (newPassword.length < 6) {
        setError('新密码长度至少为 6 位');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError('两次输入的新密码不一致');
        return;
      }
      if (!verificationCode || verificationCode.length !== 6) {
        setError('请输入 6 位邮箱验证码');
        return;
      }
    }

    updateProfileMutation.mutate({
      userId: user.id,
      nickname: nickname.trim(),
      avatar: avatar || '',
      currentPassword: currentPassword || undefined,
      newPassword: newPassword || undefined,
      code: verificationCode || undefined,
    });
  };

  if (!user) return null;

  return (
    <Stack spacing={2.5} sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 1 }}>
        <Avatar
          src={avatar || undefined}
          sx={{ width: 80, height: 80, fontSize: '2rem' }}
          variant='soft'
          color='primary'
        >
          {nickname.substring(0, 1).toUpperCase()}
        </Avatar>
        <Box>
          <Typography level='title-lg'>{nickname}</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', opacity: 0.7 }}>
            <Typography level='body-sm'>{user.email}</Typography>
            <Typography level='body-xs' sx={{ bgcolor: 'background.level2', px: 0.6, borderRadius: 'sm' }}>
              ID: #{user.shortId || '---'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Typography level='title-sm' color='neutral'>基本资料</Typography>

      <FormControl>
        <FormLabel>昵称</FormLabel>
        <Input
          size='md'
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder='请输入昵称'
        />
      </FormControl>

      <FormControl>
        <FormLabel>内置头像（20选1）</FormLabel>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(5, minmax(0, 1fr))', md: 'repeat(10, minmax(0, 1fr))' },
            gap: 1,
            mt: 1,
          }}
        >
          {builtinAvatarOptions.map((option) => (
            <IconButton
              key={option.id}
              variant={avatar === option.src ? 'solid' : 'outlined'}
              color={avatar === option.src ? 'primary' : 'neutral'}
              onClick={() => setAvatar(option.src)}
              sx={{ p: 0.5 }}
            >
              <Avatar src={option.src} sx={{ width: 32, height: 32 }} />
            </IconButton>
          ))}
        </Box>
      </FormControl>

      <Divider sx={{ my: 1 }} />
      <Typography level='title-sm' color='neutral'>安全设置</Typography>

      <FormControl>
        <FormLabel>旧密码（留空则不修改）</FormLabel>
        <Input
          type={showPassword ? 'text' : 'password'}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder='请输入当前密码'
          endDecorator={(
            <IconButton onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
          )}
        />
      </FormControl>

      <FormControl>
        <FormLabel>新密码</FormLabel>
        <Input
          type={showPassword ? 'text' : 'password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder='至少 6 位新密码'
          endDecorator={(
            <IconButton onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
          )}
        />
      </FormControl>

      <FormControl>
        <FormLabel>确认新密码</FormLabel>
        <Input
          type={showPassword ? 'text' : 'password'}
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder='请再次输入新密码'
        />
      </FormControl>

      <FormControl>
        <FormLabel>邮箱验证码</FormLabel>
        <Input
          placeholder='6 位数字'
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          endDecorator={(
            <Button
              variant='plain'
              size='sm'
              disabled={countdown > 0 || sendCodeMutation.isPending}
              onClick={() => sendCodeMutation.mutate()}
              sx={{ fontWeight: 'bold' }}
            >
              {countdown > 0 ? `${countdown}s` : (sendCodeMutation.isPending ? '发送中...' : '获取验证码')}
            </Button>
          )}
        />
        <Typography level='body-xs' sx={{ mt: 0.5 }}>
          修改密码时必须进行邮箱身份验证
        </Typography>
      </FormControl>

      {success && <Alert color='success' variant='soft'>个人资料更新成功</Alert>}
      {error && <Alert color='danger' variant='soft'>{error}</Alert>}

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant='solid'
          color='primary'
          onClick={handleSave}
          loading={updateProfileMutation.isPending}
          startDecorator={<AccountCircleIcon />}
          sx={{ minWidth: 120 }}
        >
          保存所有改动
        </Button>
      </Box>
    </Stack>
  );
}
