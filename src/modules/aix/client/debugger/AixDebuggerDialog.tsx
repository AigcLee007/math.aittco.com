import * as React from 'react';

import { Box, Button, Chip, Divider, FormControl, FormLabel, Link, Option, Select, Switch, Typography } from '@mui/joy';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { KeyStroke } from '~/common/components/KeyStroke';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { AixDebuggerFrame } from './AixDebuggerFrame';
import { DebugPayloadOverride } from './DebugPayloadOverride';
import { aixClientDebuggerActions, useAixClientDebuggerStore } from './memstore-aix-client-debugger';


// configuration
const DEBUGGER_DEBOUNCE_MS = 1000 / 5; // 5Hz

const _styles = {
  zeroState: {
    minHeight: '228px', // take up some space even when empty

    // backgroundColor: 'background.level1',
    borderBottom: '1px solid',
    borderBottomColor: 'divider',

    margin: 'calc(-1 * var(--Card-padding, 1rem))', mb: 0, padding: 'var(--Card-padding, 1rem)', // fill card

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameViewer: {
    overflow: 'auto', // scroll this part of the dialog, i.e. the full debugging frame

    // backgroundColor: 'background.level1',
    borderBottom: '1px solid',
    borderBottomColor: 'divider',

    margin: 'calc(-1 * var(--Card-padding, 1rem))', mb: 0, padding: 'var(--Card-padding, 1rem)', // fill card
  },
} as const;


function _getStoreSnapshot() {
  const state = useAixClientDebuggerStore.getState();
  return {
    frames: state.frames,
    activeFrameId: state.activeFrameId,
    maxFrames: state.maxFrames,
  };
}


/**
 * Prevent UI performance issues from high-frequency updates.
 */
function useDebouncedAixDebuggerStore() {

  // state with initial value from store
  const [debouncedState, setDebouncedState] = React.useState(_getStoreSnapshot);

  React.useEffect(() => {
    let lastUpdate = Date.now();
    let updateTimerId: ReturnType<typeof setTimeout> | null = null;

    function performUpdate() {
      setDebouncedState(_getStoreSnapshot);
      updateTimerId = null;
      lastUpdate = Date.now();
    }

    // subscribe to store changes
    const unsubscribe = useAixClientDebuggerStore.subscribe(() => {
      if (!updateTimerId) {
        const elapsedSinceLastUpdate = Date.now() - lastUpdate;
        const delayMs = Math.max(0, DEBUGGER_DEBOUNCE_MS - elapsedSinceLastUpdate);
        if (delayMs === 0)
          performUpdate();
        else
          updateTimerId = setTimeout(performUpdate, delayMs);
      }
    });

    return () => {
      unsubscribe();
      if (updateTimerId)
        clearTimeout(updateTimerId);
    };
  }, []); // no dependencies - subscription handles all changes

  return debouncedState;
}


export function AixDebuggerDialog(props: {
  onClose: () => void;
}) {

  // external state
  const isMobile = useIsMobile();
  const hasInspector = useUIPreferencesStore(state => state.aixInspector);
  const hasInjectorJson = useAixClientDebuggerStore(state => !!state.requestBodyOverrideJson);
  const { frames, activeFrameId, maxFrames } = useDebouncedAixDebuggerStore();

  // local state
  const [showInjector, setShowInjector] = React.useState(hasInjectorJson);

  // derived state
  const activeFrame = frames.find(f => f.id === activeFrameId) ?? null;
  const willInjectJson = hasInspector && hasInjectorJson;


  // handlers

  const handleSetMaxFrames = React.useCallback((value: number) => {
    aixClientDebuggerActions().setMaxFrames(value);
  }, []);

  const handleSetActiveFrame = React.useCallback((value: number | null) => {
    aixClientDebuggerActions().setActiveFrame(value);
  }, []);

  const handleToggleInjector = React.useCallback(() => {
    setShowInjector(on => !on);
    // NOTE: we don't clear injection on close anymore, as we have a good 'active' tag to show injection
    // if (showInjector || hasInjectorJson) {
    //   // aixClientDebuggerSetRBO(''); // turning off - clear the RBO
    //   setShowInjector(false);
    // } else {
    //   setShowInjector(true);
    // }
  }, []);


  return (
    <GoodModal
      open
      onClose={props.onClose}
      unfilterBackdrop
      autoOverflow
      fullscreen={isMobile || 'button'}
      titleStartDecorator={
        <Switch
          checked={hasInspector}
          onChange={useUIPreferencesStore.getState().toggleAixInspector}
          sx={{ mr: 1 }}
        />
      }
      title={isMobile ? 'AI 检查器' :
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          AI 请求{(willInjectJson || showInjector) ? '注入器' : '检查器'}
          <KeyStroke size='sm' variant='soft' combo='Ctrl + Shift + A' />
        </Box>
      }
      startButton={
        <Button
          disabled={!hasInspector}
          variant={showInjector ? 'solid' : willInjectJson ? 'soft' : 'plain'}
          color={willInjectJson ? 'warning' : 'neutral'}
          size='sm'
          onClick={handleToggleInjector}
          startDecorator={<KeyboardDoubleArrowDownIcon sx={{ transition: 'transform 0.2s', transform: showInjector ? 'rotate(0deg)' : 'rotate(180deg)' }} />}
          endDecorator={!hasInjectorJson ? null : <Chip size='sm' color='warning' variant={showInjector ? 'soft' : 'solid'}>Active</Chip>}
          // sx={{ gap: 1 }}
        >
          {isMobile ? '注入' : 'AI 注入器'}
        </Button>
      }
      sx={{ maxWidth: undefined }}
    >

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>

        {/* Request Switcher */}
        <FormControl sx={{ flex: 1, minWidth: 0 }}>
          <FormLabel>选择请求</FormLabel>
          <Select
            size='sm'
            variant='outlined'
            value={activeFrameId}
            onChange={(_, value) => handleSetActiveFrame(value)}
            placeholder='暂无请求'
            disabled={!frames.length}
            sx={{ backgroundColor: 'background.popup' }}
          >
            {frames.map((frame) => {
              const label = `请求 #${frame.id} - ${frame.context.contextName}`;
              return (
                <Option key={frame.id} value={frame.id} label={label + (frame.isComplete ? ` (${frame.particles.length})` : ' (运行中)')}>
                  <div>{label} - {frame.particles.length} pts.</div>
                  <Box component='span' sx={{ marginLeft: 'auto', fontSize: 'xs' }}>{new Date(frame.timestamp).toLocaleTimeString()}</Box>
                </Option>
              );
            })}
          </Select>
        </FormControl>

        {/* History Size Preferences */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <FormControl>
            <FormLabel>历史记录数量</FormLabel>
            <Select
              size='sm'
              value={maxFrames}
              onChange={(_, value) => value !== null && handleSetMaxFrames(value)}
              sx={{ backgroundColor: 'background.popup' }}
            >
              <Option value={5}>保留 5 条请求</Option>
              <Option value={10}>保留 10 条请求</Option>
              <Option value={20}>保留 20 条请求</Option>
              <Option value={50}>保留 50 条请求</Option>
            </Select>
          </FormControl>

          {/* Clear History */}
          <Button
            size='sm'
            color='danger'
            onClick={aixClientDebuggerActions().clearHistory}
            startDecorator={<ClearAllIcon />}
            disabled={frames.length === 0}
          >
            清除历史
          </Button>
        </Box>
      </Box>

      <Divider />

      {/* Zero State */}
      {(!frames.length || !activeFrame) && (
        <Box sx={_styles.zeroState}>
          {!frames.length && <>
            <Typography level='title-lg'>
              {hasInspector ? '准备捕获' : 'AI 请求检查器'}
            </Typography>
            <Typography level='body-sm' sx={{ mt: 2, maxWidth: 468, textAlign: 'center' }}>
              {hasInspector
                ? '您的下一个 AI 请求将在此处捕获。'
                : <>
                  <Link
                    component='button'
                    level='body-sm'
                    onClick={useUIPreferencesStore.getState().toggleAixInspector}
                  >
                    开启检查器
                  </Link> 以查看发送给 AI 模型的具体请求。
                </>}
            </Typography>
          </>}
          {!activeFrame && !!frames.length && (
            <Typography level='body-sm'>
              选择一个请求以查看详情
            </Typography>
          )}
        </Box>
      )}

      {/* Frame viewer */}
      {!!activeFrame && (
        <Box sx={_styles.frameViewer}>
          <AixDebuggerFrame frame={activeFrame} />
        </Box>
      )}

      {/* Debug Payload Override */}
      {showInjector && <DebugPayloadOverride />}

    </GoodModal>
  );
}
