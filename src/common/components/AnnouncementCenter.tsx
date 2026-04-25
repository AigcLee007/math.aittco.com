import * as React from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Modal,
  ModalClose,
  ModalDialog,
  Stack,
  Tooltip,
  Typography,
  AspectRatio,
} from '@mui/joy';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import CircleRoundedIcon from '@mui/icons-material/CircleRounded';
import { apiQuery } from '~/common/util/trpc.client';

type AnnouncementType = 'info' | 'success' | 'warning' | 'danger';

function typeToColor(type: string): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' {
  const normalized = String(type || '').toLowerCase() as AnnouncementType;
  if (normalized === 'success')
    return 'success';
  if (normalized === 'warning')
    return 'warning';
  if (normalized === 'danger')
    return 'danger';
  return 'primary';
}

function formatAnnouncementTime(value: Date | string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
}

export function AnnouncementCenter(props: { showStrip?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const showStrip = props.showStrip !== false;
  const query = (apiQuery.coin.getAnnouncements as any).useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const markOne = (apiQuery.coin.markAnnouncementRead as any).useMutation({
    onSuccess: () => query.refetch(),
  });
  const markAll = (apiQuery.coin.markAllAnnouncementsRead as any).useMutation({
    onSuccess: () => query.refetch(),
  });

  const announcements = query.data?.announcements || [];
  const unreadCount = query.data?.unreadCount || 0;
  const latestUnread = announcements.find((item: any) => !item.isRead) || announcements[0];

  const handleMarkRead = React.useCallback((announcementId: string, isRead: boolean) => {
    if (isRead || markOne.isPending)
      return;
    markOne.mutate({ announcementId });
  }, [markOne]);

  return (
    <>
      {showStrip && latestUnread && (
        <Chip
          variant={latestUnread.isRead ? 'soft' : 'outlined'}
          color={typeToColor(latestUnread.type)}
          onClick={() => setOpen(true)}
          sx={{
            borderRadius: '999px',
            maxWidth: 220,
            px: 1,
            mr: 0.5,
            cursor: 'pointer',
            '.MuiChip-label': {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: latestUnread.isRead ? 500 : 700,
            },
          }}
        >
          {latestUnread.title}
        </Chip>
      )}

      <Tooltip title='公告中心' placement='bottom'>
        <Badge badgeContent={unreadCount} color='danger' max={99} size='sm' sx={{ '.MuiBadge-badge': { zIndex: 100 } }}>
          <IconButton
            size='sm'
            variant='soft'
            color='neutral'
            onClick={() => setOpen(true)}
            sx={{ borderRadius: '0.6rem' }}
          >
            <NotificationsNoneRoundedIcon />
          </IconButton>
        </Badge>
      </Tooltip>

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog
          variant='outlined'
          sx={{
            width: 'min(640px, 92vw)',
            maxHeight: '80vh',
            overflow: 'hidden',
            p: 0,
            borderRadius: '16px',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16,19,26,0.94)' : 'background.surface',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography level='title-lg' sx={{ fontWeight: 700 }}>公告中心</Typography>
            <Stack direction='row' spacing={1} alignItems='center'>
              <Button
                size='sm'
                variant='soft'
                color='primary'
                startDecorator={<DoneAllRoundedIcon />}
                onClick={() => markAll.mutate()}
                loading={markAll.isPending}
                disabled={!unreadCount}
              >
                全部已读
              </Button>
              <ModalClose sx={{ position: 'static' }} />
            </Stack>
          </Box>

          <Box sx={{ p: 1.5, overflowY: 'auto', minHeight: 140 }}>
            {!announcements.length && (
              <Typography level='body-sm' sx={{ opacity: 0.7, textAlign: 'center', py: 4 }}>
                暂无公告
              </Typography>
            )}
            {!!announcements.length && (
              <List sx={{ gap: 1.5 }}>
                {announcements.map((item: any) => (
                  <ListItem key={item.id} sx={{ p: 0 }}>
                    <ListItemButton
                      onClick={() => handleMarkRead(item.id, item.isRead)}
                      sx={{
                        borderRadius: '10px',
                        alignItems: 'flex-start',
                        border: '1px solid',
                        borderColor: item.isRead ? 'divider' : 'primary.outlinedBorder',
                        bgcolor: item.isRead ? 'background.body' : 'primary.softBg',
                        p: 2,
                      }}
                    >
                      <Stack spacing={1.5} sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {!item.isRead && <CircleRoundedIcon sx={{ fontSize: 10, color: 'danger.500' }} />}
                          <Typography level='title-sm' sx={{ fontWeight: item.isRead ? 600 : 700 }}>
                            {item.title}
                          </Typography>
                          <Chip size='sm' variant='soft' color={typeToColor(item.type)} sx={{ ml: 'auto' }}>
                            {String(item.type || 'info').toUpperCase()}
                          </Chip>
                        </Box>
                        
                        {item.imageUrl && (
                          <Box sx={{ borderRadius: 'sm', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                            <img 
                              src={item.imageUrl} 
                              alt={item.title} 
                              style={{ width: '100%', display: 'block' }}
                              loading="lazy" 
                            />
                          </Box>
                        )}

                        <Typography level='body-sm' sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'text.secondary' }}>
                          {item.content}
                        </Typography>
                        <Typography level='body-xs' sx={{ opacity: 0.65 }}>
                          发布时间：{formatAnnouncementTime(item.createdAt)}
                        </Typography>
                      </Stack>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </ModalDialog>
      </Modal>
    </>
  );
}
