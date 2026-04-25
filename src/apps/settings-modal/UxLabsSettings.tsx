import * as React from 'react';

import { FormControl, Switch, Typography } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import CodeIcon from '@mui/icons-material/Code';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EngineeringIcon from '@mui/icons-material/Engineering';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import SpeedIcon from '@mui/icons-material/Speed';
import TitleIcon from '@mui/icons-material/Title';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { Is } from '~/common/util/pwaUtils';
import { Link } from '~/common/components/Link';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUXLabsStore } from '~/common/stores/store-ux-labs';


// uncomment for more settings
export const DEV_MODE_SETTINGS = false;


export function UxLabsSettings() {

  // external state
  const isMobile = useIsMobile();
  const {
    labsAttachScreenCapture, setLabsAttachScreenCapture,
    labsCameraDesktop, setLabsCameraDesktop,
    labsChatBarAlt, setLabsChatBarAlt,
    labsEnhanceCodeBlocks, setLabsEnhanceCodeBlocks,
    labsHighPerformance, setLabsHighPerformance,
    labsShowCost, setLabsShowCost,
    labsAutoHideComposer, setLabsAutoHideComposer,
    labsShowShortcutBar, setLabsShowShortcutBar,
    labsDevMode, setLabsDevMode,
    labsDevNoStreaming, setLabsDevNoStreaming,
  } = useUXLabsStore();

  return <>

    {/* [DEV MODE] Settings */}

    {(Is.Deployment.Localhost || labsDevMode) && (
      <FormSwitchControl
        title={<><EngineeringIcon color='warning' sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />开发者模式</>} description={labsDevMode ? '已启用' : '已禁用'}
        checked={labsDevMode} onChange={setLabsDevMode}
      />
    )}

    {labsDevMode && (
      <FormSwitchControl
        title={<><EngineeringIcon color='warning' sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />禁用流式传输</>} description={labsDevNoStreaming ? '已启用' : '已禁用'}
        checked={labsDevNoStreaming} onChange={setLabsDevNoStreaming}
      />
    )}

    {/* Non-Graduated Settings */}

    <FormSwitchControl
      title={<><CodeIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />增强旧代码</>} description={labsEnhanceCodeBlocks ? '自动增强' : '已禁用'}
      checked={labsEnhanceCodeBlocks} onChange={setLabsEnhanceCodeBlocks}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart
        title={<><SpeedIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />解锁刷新</>}
        description={labsHighPerformance ? '已解锁' : '默认'}
        tooltipWarning={labsHighPerformance}
        tooltip={<>
          解锁聊天和多模型融合的最大 UI 刷新率，并将按原样绘制每个 Token。
          <hr />
          这可能会导致 CPU 使用率高、电池消耗快以及快速模型通过时的卡顿。
          <hr />
          默认：关闭
        </>}
      />
      <Switch checked={labsHighPerformance} onChange={event => setLabsHighPerformance(event.target.checked)}
              endDecorator={labsHighPerformance ? '开' : '关'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    {DEV_MODE_SETTINGS && <FormSwitchControl
      title={<><TitleIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />对话标题</>} description={labsChatBarAlt === 'title' ? '显示标题' : '显示模型'}
      checked={labsChatBarAlt === 'title'} onChange={(on) => setLabsChatBarAlt(on ? 'title' : false)}
    />}

    {!isMobile && <FormSwitchControl
      title={<><ScreenshotMonitorIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} /> 屏幕截图</>} description={labsAttachScreenCapture ? '已启用' : '已禁用'}
      checked={labsAttachScreenCapture} onChange={setLabsAttachScreenCapture}
    />}

    {!isMobile && <FormSwitchControl
      title={<><AddAPhotoIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} /> 摄像头截图</>} description={/*'v1.8 · ' +*/ (labsCameraDesktop ? '已启用' : '已禁用')}
      checked={labsCameraDesktop} onChange={setLabsCameraDesktop}
    />}

    <FormSwitchControl
      title={<><LocalAtmOutlinedIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />消息成本</>} description={labsShowCost ? '可用时显示' : '已禁用'}
      checked={labsShowCost} onChange={setLabsShowCost}
    />

    {!isMobile && <FormSwitchControl
      title={<><ShortcutIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />快捷键栏</>} description={labsShowShortcutBar ? '状态栏' : '已禁用'}
      checked={labsShowShortcutBar} onChange={setLabsShowShortcutBar}
    />}

    <FormSwitchControl
      title={<><EditNoteIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />自动隐藏输入框</>} description={labsAutoHideComposer ? '悬停显示' : '始终显示'}
      checked={labsAutoHideComposer} onChange={setLabsAutoHideComposer}
    />

    {/*
      Other Graduated (removed or backlog):
        - <Link href='https://github.com/enricoros/big-AGI/issues/359' target='_blank'>Draw App</Link>
        - Text Tools: dinamically shown where applicable (e.g. Diff)
        - Chat Mode: follow-ups; moved to Chat Advanced UI
    */}


  </>;
}