import * as React from 'react';
import type { FileWithHandle } from 'browser-fs-access';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Card, Divider, FormControl, IconButton, Textarea, Tooltip, Typography } from '@mui/joy';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

import { RenderWordsDiff, useWordsDifference } from '~/modules/blocks/wordsdiff/RenderWordsDiff';

import { ButtonAttachFilesMemo } from '~/common/components/ButtonAttachFiles';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { countWords } from '~/common/util/textUtils';
import { themeScalingMap } from '~/common/app.theme';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIContentScaling } from '~/common/stores/store-ui';

import { AppSmallContainer } from '../AppSmallContainer';


export function AppDiff() {

  // state
  const [text1, setText1] = React.useState('这是原文...');
  const [text2, setText2] = React.useState('这是修改后的文本...');
  const [isSwapping, setIsSwapping] = React.useState(false);


  // external state
  const isMobile = useIsMobile();
  const contentScaling = useUIContentScaling();
  const diffs = useWordsDifference(text2 || '', text1 || '', true);

  // memos
  const handleSwap = React.useCallback(() => {
    setIsSwapping(true);
    setTimeout(() => {
      const temp = text1;
      setText1(text2);
      setText2(temp);
      setIsSwapping(false);
    }, 200); // sync this with the transition duration
  }, [text1, text2]);

  const scaledTypographySx: SxProps = React.useMemo(() => ({
    fontSize: themeScalingMap[contentScaling]?.blockFontSize ?? undefined,
    lineHeight: themeScalingMap[contentScaling]?.blockLineHeight ?? 1.75,
  }), [contentScaling]);


  const c1 = text1?.length || 0;
  const c2 = text2?.length || 0;
  const w1 = countWords(text1);
  const w2 = countWords(text2);


  return (
    <AppSmallContainer
      title={isMobile ? '文本差异' : '文本对比'}
      description='对比两个版本的文本，突出显示更改和差异。'
    >

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Grid with the 2 input boxes */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr auto 1fr' },
          gap: 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>

          <FormControl sx={{ alignSelf: 'flex-start' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
              <FormLabelStart title='原文' />
              <ButtonAttachFilesMemo noToolTip onAttachFiles={(files: FileWithHandle[]) => files[0]?.text().then((text) => setText1(text))} />
            </Box>
            <Textarea
              variant='outlined'
              color={text1 ? undefined : 'warning'}
              minRows={5}
              maxRows={isMobile ? 8 : 10}
              placeholder='在此粘贴或输入您的原文...'
              autoFocus
              value={text1}
              onChange={(e) => setText1(e.target.value)}
              endDecorator={
                <Box sx={{
                  backgroundColor: 'background.surface', px: 0.5, py: 0.25, borderRadius: 'xs',
                  width: '100%', lineHeight: 'lg', fontSize: 'xs',
                  display: 'flex', flexFlow: 'row wrap', gap: 1, justifyContent: 'space-between',
                }}>
                  {!w1 ? <div>无单词</div> : <div>单词数: <b>{w1}</b></div>}
                  {!c1 ? <div>无字符</div> : <div>字符数: <b>{c1}</b></div>}
                </Box>
              }
              sx={{
                transition: 'transform 0.2s ease-in-out',
                transform: isSwapping ? 'scale(0.97) translateX(5%)' : 'scale(1)',
                '&:focus-within': { backgroundColor: 'background.popup' },
                ...scaledTypographySx,
              }}
            />
          </FormControl>

          <Tooltip title='交换文本' disableInteractive>
            <IconButton
              variant='soft'
              onClick={handleSwap}
              sx={{
                my: { xs: 1, md: 0 },
                transition: isSwapping ? 'transform 0.2s ease-in-out' : undefined,
                transform: isSwapping ? 'rotate(180deg)' : 'rotate(0)',
              }}
            >
              <SwapHorizIcon />
            </IconButton>
          </Tooltip>

          <FormControl sx={{ alignSelf: 'flex-start' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
              <FormLabelStart title='修改后' />
              <ButtonAttachFilesMemo noToolTip onAttachFiles={(files: FileWithHandle[]) => files[0]?.text().then((text) => setText2(text))} />
            </Box>
            <Textarea
              variant='outlined'
              color={text2 ? undefined : 'warning'}
              minRows={5}
              maxRows={isMobile ? 8 : 10}
              placeholder='在此粘贴或输入您修改后的文本...'
              value={text2}
              onChange={(e) => setText2(e.target.value)}
              endDecorator={
                <Box sx={{
                  backgroundColor: 'background.surface', px: 0.5, py: 0.25, borderRadius: 'xs',
                  width: '100%', lineHeight: 'lg', fontSize: 'xs',
                  display: 'flex', flexFlow: 'row wrap', gap: 1, justifyContent: 'space-between',
                }}>
                  {!w2 ? <div>无单词</div> : <div>单词数: <b>{w2}</b></div>}
                  {!c2 ? <div>无字符</div> : <div>字符数: <b>{c2}</b></div>}
                </Box>
              }
              sx={{
                transition: 'transform 0.2s ease-in-out',
                transform: isSwapping ? 'scale(0.97) translateX(-5%)' : 'scale(1)',
                '&:focus-within': { backgroundColor: 'background.popup' },
                ...scaledTypographySx,
              }}
            />
          </FormControl>

        </Box>

        {diffs?.length ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            <Divider sx={{ my: 2 }}>
              <Typography level='title-sm'>
                差异
              </Typography>
            </Divider>

            <Card sx={{
              borderRadius: 'sm',
              backgroundColor: 'background.popup',
              p: 1,
            }}>
              <RenderWordsDiff
                wordsDiff={diffs}
                sx={scaledTypographySx}
              />
            </Card>

            <Typography level='body-sm'>
              <Typography color='danger'>红色</Typography>：已删除，<Typography color='success'>绿色</Typography>：已添加。
            </Typography>

          </Box>
        ) : (
          <Typography level='body-sm' sx={{ my: 2 }}>
            输入或粘贴您的文本，差异将在此处突出显示。
          </Typography>
        )}

      </Box>
    </AppSmallContainer>
  );
}