import * as React from 'react';
import { Box, Modal, ModalClose, ModalDialog, Typography, IconButton, Tooltip } from '@mui/joy';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';

export function ContactService() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Tooltip title="联系客服" placement="right">
        <IconButton
          variant="soft"
          color="success"
          onClick={() => setOpen(true)}
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '12px',
            '&:hover': {
              bgcolor: 'success.softHoverBg',
            },
          }}
        >
          <HeadsetMicIcon />
        </IconButton>
      </Tooltip>

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog
          variant="outlined"
          role="alertdialog"
          sx={{
            width: 'min(400px, 90vw)',
            borderRadius: '24px',
            p: 3,
            textAlign: 'center',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 20, 24, 0.96)' : 'background.surface',
            backdropFilter: 'blur(16px)',
          }}
        >
          <ModalClose />
          <Typography level="title-lg" sx={{ mb: 1, fontWeight: 700 }}>
            联系人工客服
          </Typography>
          <Typography level="body-sm" sx={{ mb: 3, opacity: 0.8 }}>
            请使用微信扫描下方二维码进行咨询
          </Typography>
          
          <Box
            sx={{
              width: '100%',
              maxWidth: 240,
              mx: 'auto',
              p: 1,
              bgcolor: '#fff',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            }}
          >
            <img
              src="/wechat.png"
              alt="WeChat QR Code"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: '8px',
              }}
            />
          </Box>
          
          <Typography level="body-xs" sx={{ mt: 3, opacity: 0.5 }}>
            工作时间：周一至周日 10:00 - 24:00
          </Typography>
        </ModalDialog>
      </Modal>
    </>
  );
}
