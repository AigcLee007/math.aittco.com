import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, Button, Card, CircularProgress, Stack, Typography, Alert } from '@mui/joy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { apiQuery } from '~/common/util/trpc.client';

export default function VerifyPage() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('由于您的邮箱非常重要，我们正在进行最后的确认...');

  const verifyMutation = apiQuery.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setStatus('success');
      setMessage('邮箱验证成功！您现在可以登录并开始使用了。');
    },
    onError: (err) => {
      setStatus('error');
      setMessage(err.message || '验证失败，链接可能已过期或无效。');
    },
  });

  useEffect(() => {
    if (token && typeof token === 'string') {
      verifyMutation.mutate({ token });
    } else if (router.isReady && !token) {
      setStatus('error');
      setMessage('无效的验证链接。');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, router.isReady]);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f6f5f2',
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 480,
          p: 4,
          borderRadius: '22px',
          boxShadow: '0 20px 45px rgba(16,16,16,0.1)',
          textAlign: 'center',
        }}
      >
        <Typography level="h2" sx={{ fontFamily: 'Times New Roman, serif', mb: 2 }}>
          邮箱验证
        </Typography>

        <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {status === 'loading' && (
            <>
              <CircularProgress size="lg" sx={{ mb: 2 }} />
              <Typography>{message}</Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
              <Typography level="h4" sx={{ mb: 2, color: '#101010' }}>
                验证成功
              </Typography>
              <Typography sx={{ mb: 4, color: '#5d5952' }}>
                {message}
              </Typography>
              <Button
                fullWidth
                onClick={() => router.push('/auth')}
                sx={{ borderRadius: '12px', bgcolor: '#0b0e14', color: '#fff', '&:hover': { bgcolor: '#000' } }}
              >
                前往登录
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <ErrorOutlineIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
              <Typography level="h4" sx={{ mb: 2, color: '#101010' }}>
                验证失败
              </Typography>
              <Typography sx={{ mb: 4, color: '#5d5952' }}>
                {message}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => router.push('/auth')}
                  sx={{ borderRadius: '12px', border: '1px solid #d8d1c4', color: '#333' }}
                >
                  返回主页
                </Button>
                <Button
                  fullWidth
                  onClick={() => router.push('/auth')}
                  sx={{ borderRadius: '12px', bgcolor: '#0b0e14', color: '#fff', '&:hover': { bgcolor: '#000' } }}
                >
                  重试登录
                </Button>
              </Stack>
            </>
          )}
        </Box>
      </Card>
    </Box>
  );
}
