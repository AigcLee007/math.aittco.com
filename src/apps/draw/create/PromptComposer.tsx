import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, Dropdown, FormControl, Grid, IconButton, Menu, MenuButton, MenuItem, Textarea, Typography } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MicIcon from '@mui/icons-material/Mic';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import NumbersRoundedIcon from '@mui/icons-material/NumbersRounded';
import RemoveIcon from '@mui/icons-material/Remove';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';

import { imaginePromptFromTextOrThrow } from '~/modules/aifn/imagine/imaginePromptFromText';

import { agiUuid } from '~/common/util/idUtils';
import { animationEnterBelow } from '~/common/util/animUtils';
import { lineHeightTextareaMd } from '~/common/app.theme';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { ButtonPromptFromIdea } from './ButtonPromptFromIdea';
import { useDrawIdeas } from './useDrawIdeas';


const promptButtonClass = 'PromptDesigner-button';


export interface DesignerPrompt {
  dpId: string,
  prompt: string,
  _repeatCount: number,
  // tags: string[],
  // effects: string[],
  // style: string[],
  // detail: string[],
  // restyle: string[],
  // [key: string]: string[],
}


export function PromptComposer(props: {
  isMobile: boolean,
  queueLength: number,
  onDrawingStop: () => void,
  onPromptEnqueue: (prompt: DesignerPrompt[]) => void,
  sx?: SxProps,
}) {

  // state
  const [nextPrompt, setNextPrompt] = React.useState<string>('');
  const [tempRepeat, setTempRepeat] = React.useState<number>(1);

  // external state
  const { currentIdea, nextRandomIdea, clearCurrentIdea } = useDrawIdeas();
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);

  // derived state
  const userHasText = !!nextPrompt;
  const currentIdeaPrompt = currentIdea?.prompt || '';
  const nonEmptyPrompt = nextPrompt || currentIdeaPrompt;
  const queueLength = props.queueLength;
  const qBusy = queueLength > 0;

  // Handlers
  const { onDrawingStop, onPromptEnqueue } = props;

  const handlePromptEnqueue = React.useCallback(() => {
    setNextPrompt('');
    clearCurrentIdea();
    if (nonEmptyPrompt?.trim()) {
      onPromptEnqueue([{
        dpId: agiUuid('draw-prompt'),
        prompt: nonEmptyPrompt,
        _repeatCount: tempRepeat,
      }]);
    }
  }, [clearCurrentIdea, nonEmptyPrompt, onPromptEnqueue, tempRepeat]);

  const handleTextareaTextChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNextPrompt(e.target.value);
  }, []);

  const handleTextareaKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      if (enterIsNewline ? e.shiftKey : !e.shiftKey) {
        if (userHasText) handlePromptEnqueue();
        return e.preventDefault();
      }
    }
  }, [enterIsNewline, handlePromptEnqueue, userHasText]);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: '2.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: props.isMobile ? 'calc(100% - 2rem)' : 'min(900px, 95%)',
        zIndex: 100,
        ...props.sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'background.surface',
          borderRadius: '2.4rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.2)',
          border: '1px solid',
          borderColor: 'divider',
          p: 1.5,
          gap: 1,
        }}
      >
        {/* Top: Controls row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
          <IconButton size="sm" variant="soft" color="neutral" sx={{ borderRadius: '50%' }} onClick={nextRandomIdea}>
            <AddRoundedIcon />
          </IconButton>

          <Button 
            size="sm" 
            variant="plain" 
            color="neutral" 
            endDecorator={<KeyboardArrowDownIcon sx={{ fontSize: '1rem' }} />}
            sx={{ borderRadius: '1rem', fontWeight: 600, color: 'text.secondary' }}
          >
            Flow
          </Button>

          <Dropdown>
            <MenuButton
              slots={{ root: Button }}
              slotProps={{ root: { size: 'sm', variant: 'plain', color: 'neutral', endDecorator: <KeyboardArrowDownIcon sx={{ fontSize: '1rem' }} /> } }}
              sx={{ borderRadius: '1rem', fontWeight: 600, color: 'text.secondary' }}
            >
              {tempRepeat}:1
            </MenuButton>
            <Menu placement="top">
              {[1, 2, 4, 9].map(n => (
                <MenuItem key={n} onClick={() => setTempRepeat(n)}>{n}:1</MenuItem>
              ))}
            </Menu>
          </Dropdown>

          <Button 
            size="sm" 
            variant="plain" 
            color="neutral" 
            endDecorator={<KeyboardArrowDownIcon sx={{ fontSize: '1rem' }} />}
            sx={{ borderRadius: '1rem', fontWeight: 600, color: 'text.secondary' }}
          >
            Style
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          {/* Enhancement Toggle? */}
          <IconButton size="sm" variant="plain" color="neutral">
            <AutoFixHighIcon sx={{ fontSize: '1.2rem' }} />
          </IconButton>
        </Box>

        {/* Bottom: Input row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <Textarea
            variant="plain"
            minRows={1}
            maxRows={4}
            placeholder={currentIdeaPrompt || "Type or describe your image idea here..."}
            value={nextPrompt}
            onChange={handleTextareaTextChange}
            onKeyDown={handleTextareaKeyDown}
            sx={{
              flexGrow: 1,
              bgcolor: 'transparent',
              '--Textarea-focusedHighlight': 'transparent',
              p: 1.5,
              fontSize: '1rem',
            }}
          />
          
          <Box sx={{ display: 'flex', gap: 1, p: 0.5 }}>
            <IconButton size="md" variant="plain" color="neutral">
              <MicIcon />
            </IconButton>
            
            <IconButton
              variant="solid"
              color="primary"
              onClick={handlePromptEnqueue}
              disabled={!nonEmptyPrompt || qBusy}
              sx={{
                borderRadius: '50%',
                width: 44,
                height: 44,
                boxShadow: '0 4px 12px rgba(var(--joy-palette-primary-mainChannel) / 0.4)',
              }}
            >
              {qBusy ? <StopOutlinedIcon /> : <ArrowUpwardIcon />}
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}