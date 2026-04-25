'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  AspectRatio,
  Box,
  Card,
  Divider,
  Button,
  IconButton,
  Modal,
  ModalDialog,
  Tooltip,
  Typography,
} from '@mui/joy';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SmartDisplayRoundedIcon from '@mui/icons-material/SmartDisplayRounded';
import { getNanoBananaCanvasModelLabel } from '../nanoBananaLine1';

interface HistoryItem {
  image?: string;
  video?: string;
  videoPoster?: string;
  timestamp: number;
  prompt: string;
  model: string;
}

interface RecentGalleryProps {
  onSelect: (image: string) => void;
  onUseAsReference: (image: string) => void;
  onRegenerate: (item: HistoryItem) => void;
  history: HistoryItem[];
  setHistory: (history: HistoryItem[]) => void;
  layout?: 'panel' | 'modal';
}

export function RecentGallery({
  onSelect,
  onUseAsReference,
  onRegenerate,
  history,
  setHistory,
  layout = 'panel',
}: RecentGalleryProps) {
  const isModal = layout === 'modal';
  const [activeTab, setActiveTab] = React.useState<'image' | 'video'>('image');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = React.useState(false);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('banana_studio_history');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday)
      return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;

    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const downloadImage = (image: string) => {
    const link = document.createElement('a');
    link.href = image;
    link.download = `banana-history-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadVideo = (video: string) => {
    const link = document.createElement('a');
    link.href = video;
    link.download = `banana-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const imageHistory = history.filter((item) => !!item.image);
  const videoHistory = history.filter((item) => !!item.video);
  const displayHistory = activeTab === 'image' ? imageHistory : videoHistory;

  const handleBatchDownload = () => {
    window.dispatchEvent(new CustomEvent('canvas-batch-download'));
  };

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: isModal ? 'transparent' : 'background.level1',
      borderRight: isModal ? 'none' : '1px solid',
      borderColor: 'divider',
    }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        pb: isModal ? 1 : 1.5,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryRoundedIcon sx={{ color: isModal ? 'rgba(255,255,255,0.7)' : 'text.tertiary', fontSize: '1.2rem' }} />
          <Typography level="title-sm" sx={{ color: isModal ? 'rgba(255,255,255,0.92)' : 'text.secondary', fontWeight: 600 }}>
            历史记录
          </Typography>
        </Box>
        <Tooltip title="清空历史" variant="soft">
          <IconButton size="sm" variant="plain" color="neutral" onClick={() => setIsClearConfirmOpen(true)} sx={{ color: isModal ? 'rgba(255,255,255,0.78)' : undefined }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: '1.2rem' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {isModal ? (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Box
            sx={{
              p: 0.5,
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.2)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0.5,
            }}
          >
            <Button
              size="sm"
              variant={activeTab === 'image' ? 'soft' : 'plain'}
              onClick={() => setActiveTab('image')}
              sx={{
                borderRadius: '10px',
                bgcolor: activeTab === 'image' ? 'rgba(255,255,255,0.16)' : undefined,
                color: activeTab === 'image' ? '#fff' : 'rgba(255,255,255,0.7)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
              }}
            >
              图片历史
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'video' ? 'soft' : 'plain'}
              onClick={() => setActiveTab('video')}
              sx={{
                borderRadius: '10px',
                bgcolor: activeTab === 'video' ? 'rgba(255,255,255,0.16)' : undefined,
                color: activeTab === 'video' ? '#fff' : 'rgba(255,255,255,0.7)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
              }}
            >
              视频历史
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          <Divider sx={{ mx: 2, opacity: 0.5 }} />
          <Box sx={{
            mx: 2, mt: 1.5, mb: 0.5, p: 1,
            bgcolor: 'warning.softBg',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            border: '1px solid',
            borderColor: 'warning.softBorder',
          }}>
            <InfoOutlinedIcon sx={{ fontSize: '1rem', color: 'warning.main', mt: 0.2 }} />
            <Typography level="body-xs" sx={{ color: 'warning.darkChannel', lineHeight: 1.4, fontWeight: 500 }}>
              生成后请尽快下载到本地，以免丢失图片
            </Typography>
          </Box>
        </>
      )}

      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        p: isModal ? 2 : 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: isModal ? 1 : 1.5,
      }}>
        {isModal && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5, pb: 0.5 }}>
            <Typography level="body-sm" sx={{ color: 'rgba(255,255,255,0.72)' }}>
              共 {displayHistory.length} 条记录
            </Typography>
            <Button
              size="sm"
              variant="plain"
              onClick={handleBatchDownload}
              sx={{ color: '#4DA3FF' }}
            >
              全部打包下载
            </Button>
          </Box>
        )}

        {displayHistory.length === 0 ? (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            opacity: isModal ? 0.55 : 0.3,
            gap: 1,
            py: 4,
            color: isModal ? 'rgba(255,255,255,0.72)' : undefined,
          }}>
            <HistoryRoundedIcon sx={{ fontSize: '2rem' }} />
            <Typography level="body-sm">暂无生成记录</Typography>
          </Box>
        ) : (
          <Box
            sx={isModal ? {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 240px))',
              justifyContent: 'space-between',
              gap: 2,
              pb: 1,
            } : {
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {displayHistory.map((item, idx) => (
              <Card
                key={item.timestamp || idx}
                variant="outlined"
                onClick={() => {
                  if (item.image)
                    onSelect(item.image);
                  else if (item.video)
                    window.open(item.video, '_blank');
                }}
                sx={{
                  p: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  borderColor: isModal ? 'rgba(255,255,255,0.14)' : 'divider',
                  borderRadius: isModal ? '16px' : '12px',
                  bgcolor: isModal ? 'rgba(255,255,255,0.04)' : undefined,
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                    boxShadow: 'md',
                    '& .history-overlay': { opacity: 1 },
                    '& .history-actions': { opacity: 1, transform: 'translate(-50%, 0)' },
                    '& .history-prompt': { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <AspectRatio ratio={isModal ? '3/4' : '1'}>
                  {item.video ? (
                    <Box
                      component='video'
                      src={item.video}
                      poster={item.videoPoster}
                      muted
                      loop
                      autoPlay
                      preload='metadata'
                      playsInline
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }}
                    />
                  ) : (
                    <Image src={item.image || ''} alt={`History item ${new Date(item.timestamp).toLocaleString()}`} fill unoptimized sizes={isModal ? '240px' : '160px'} style={{ objectFit: 'cover' }} />
                  )}
                </AspectRatio>

              <Box
                className="history-overlay"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  transition: 'opacity 0.25s ease',
                  background: 'linear-gradient(to top, rgba(10,12,18,0.46) 0%, rgba(10,12,18,0.18) 42%, rgba(10,12,18,0.04) 100%)',
                }}
              />

              <Box
                className="history-actions"
                sx={{
                  position: 'absolute',
                  left: '50%',
                  bottom: '4.1rem',
                  transform: 'translate(-50%, 10px)',
                  opacity: 0,
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  px: 1,
                  py: 0.7,
                  borderRadius: '999px',
                  bgcolor: 'rgba(8, 12, 20, 0.58)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
                  zIndex: 2,
                }}
              >
                <Tooltip title="放大预览" variant="solid" size="sm">
                  <IconButton
                    size="sm"
                    variant="solid"
                    color="neutral"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.image)
                        onSelect(item.image);
                      else if (item.video)
                        window.open(item.video, '_blank');
                    }}
                    sx={{
                      borderRadius: '50%',
                      bgcolor: 'rgba(255,255,255,0.14)',
                      color: '#fff',
                      width: 34,
                      height: 34,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.24)', transform: 'translateY(-1px)' },
                    }}
                  >
                    {item.video ? <SmartDisplayRoundedIcon /> : <ZoomInRoundedIcon />}
                  </IconButton>
                </Tooltip>

                <Tooltip title="重生" variant="solid" size="sm">
                  <IconButton
                    size="sm"
                    variant="solid"
                    color="warning"
                    onClick={(e) => { e.stopPropagation(); onRegenerate(item); }}
                    sx={{
                      borderRadius: '50%',
                      width: 34,
                      height: 34,
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.28)',
                      '&:hover': { transform: 'translateY(-1px)' },
                    }}
                  >
                    <ReplayRoundedIcon />
                  </IconButton>
                </Tooltip>

                {item.image && (
                  <Tooltip title="垫图参考" variant="solid" size="sm">
                    <IconButton
                      size="sm"
                      variant="solid"
                      color="primary"
                      onClick={(e) => { e.stopPropagation(); onUseAsReference(item.image!); }}
                      sx={{
                        borderRadius: '50%',
                        width: 34,
                        height: 34,
                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.28)',
                        '&:hover': { transform: 'translateY(-1px)' },
                      }}
                    >
                      <AutoFixHighRoundedIcon />
                    </IconButton>
                  </Tooltip>
                )}

                {item.video && (
                  <Tooltip title="复制视频链接" variant="solid" size="sm">
                    <IconButton
                      size="sm"
                      variant="solid"
                      color="primary"
                      onClick={(e) => { e.stopPropagation(); if (item.video) void copyLink(item.video); }}
                      sx={{
                        borderRadius: '50%',
                        width: 34,
                        height: 34,
                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.28)',
                        '&:hover': { transform: 'translateY(-1px)' },
                      }}
                    >
                      <LinkRoundedIcon />
                    </IconButton>
                  </Tooltip>
                )}

                <Tooltip title="下载到本地" variant="solid" size="sm">
                  <IconButton
                    size="sm"
                    variant="solid"
                    color="neutral"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.image)
                        downloadImage(item.image);
                      else if (item.video)
                        downloadVideo(item.video);
                    }}
                    sx={{
                      borderRadius: '50%',
                      bgcolor: 'rgba(255,255,255,0.14)',
                      color: '#fff',
                      width: 34,
                      height: 34,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.24)', transform: 'translateY(-1px)' },
                    }}
                  >
                    <DownloadRoundedIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box
                className="history-prompt"
                sx={{
                  position: 'absolute',
                  left: 10,
                  right: 10,
                  bottom: 10,
                  opacity: 0,
                  transform: 'translateY(8px)',
                  transition: 'all 0.25s ease',
                  zIndex: 2,
                  px: 1.1,
                  py: 0.9,
                  borderRadius: '12px',
                  bgcolor: 'rgba(15, 23, 42, 0.74)',
                  color: '#fff',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 12px 24px rgba(0,0,0,0.22)',
                }}
              >
                <Typography
                  level="body-xs"
                  sx={{
                    color: 'rgba(255,255,255,0.95)',
                    fontSize: '0.72rem',
                    lineHeight: 1.55,
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    textShadow: '0 1px 2px rgba(0,0,0,0.22)',
                  }}
                >
                  {item.prompt || '暂无提示词'}
                </Typography>
              </Box>

                <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: isModal ? 'rgba(0,0,0,0.28)' : 'background.surface' }}>
                  <Typography level="body-xs" sx={{ color: isModal ? 'rgba(255,255,255,0.6)' : 'text.tertiary', fontWeight: 500 }}>
                    {formatTime(item.timestamp)}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: isModal ? 'rgba(255,255,255,0.6)' : 'text.tertiary', maxWidth: '68%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getNanoBananaCanvasModelLabel(item.model)}
                  </Typography>
                </Box>
              </Card>
            ))}
          </Box>
        )}
      </Box>
      <Modal open={isClearConfirmOpen} onClose={() => setIsClearConfirmOpen(false)}>
        <ModalDialog
          size='md'
          sx={{
            borderRadius: '14px',
            minWidth: 320,
            maxWidth: 'calc(100vw - 2rem)',
            p: 2,
          }}
        >
          <Typography level='title-md'>清空历史记录</Typography>
          <Typography level='body-sm' sx={{ color: 'text.tertiary' }}>
            确定要清空所有历史记录吗？该操作不可恢复。
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
            <Button variant='plain' color='neutral' onClick={() => setIsClearConfirmOpen(false)}>
              取消
            </Button>
            <Button
              color='danger'
              onClick={() => {
                clearHistory();
                setIsClearConfirmOpen(false);
              }}
            >
              确认清空
            </Button>
          </Box>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
