import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Button, FormControl, Switch } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { useUIPreferencesStore } from '~/common/stores/store-ui';
import { isPwa } from '~/common/util/pwaUtils';
import { optimaOpenModels } from '~/common/layout/optima/useOptima';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useModelsZeroState } from '~/common/stores/llms/hooks/useModelsZeroState';

import { SettingUIComplexity } from './SettingUIComplexity';
import { SettingUIComposerQuickButton } from './SettingUIComposerQuickButton';
import { SettingUIContentScaling } from './SettingUIContentScaling';


// configuration
const SHOW_MARKDOWN_DISABLE_SETTING = false;
const SHOW_PURPOSE_FINDER = false;


const OptionsPageSize = [
  { value: 'narrow', label: <WidthNormalIcon sx={{ width: 25, height: 24, mt: -0.25 }} /> },
  { value: 'wide', label: <WidthWideIcon sx={{ width: 25, height: 24, mt: -0.25 }} /> },
  { value: 'full', label: '全屏' },
] as const;


function ModelsSetupButton(props: { isMissingModels?: boolean }) {
  return <Button
    // variant='soft' color='success'
    color={props.isMissingModels ? 'danger' : undefined}
    onClick={optimaOpenModels}
    startDecorator={<BuildCircleIcon />}
    sx={{
      '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
      minWidth: 150,
      boxShadow: props.isMissingModels ? 'lg' : undefined,
    }}
  >
    {/*Admin Models*/}
    AI 模型
  </Button>;
}


export function AppChatSettingsUI() {

  // external state
  const isMobile = useIsMobile();
  const isMissingModels = useModelsZeroState();
  const {
    centerMode, setCenterMode,
    disableMarkdown, setDisableMarkdown,
    doubleClickToEdit, setDoubleClickToEdit,
    enterIsNewline, setEnterIsNewline,
    showPersonaFinder, setShowPersonaFinder,
  } = useUIPreferencesStore(useShallow(state => ({
    centerMode: state.centerMode, setCenterMode: state.setCenterMode,
    disableMarkdown: state.disableMarkdown, setDisableMarkdown: state.setDisableMarkdown,
    doubleClickToEdit: state.doubleClickToEdit, setDoubleClickToEdit: state.setDoubleClickToEdit,
    enterIsNewline: state.enterIsNewline, setEnterIsNewline: state.setEnterIsNewline,
    showPersonaFinder: state.showPersonaFinder, setShowPersonaFinder: state.setShowPersonaFinder,
  })));

  const handleEnterIsNewlineChange = (event: React.ChangeEvent<HTMLInputElement>) => setEnterIsNewline(!event.target.checked);

  const handleDoubleClickToEditChange = (event: React.ChangeEvent<HTMLInputElement>) => setDoubleClickToEdit(event.target.checked);

  const handleDisableMarkdown = (event: React.ChangeEvent<HTMLInputElement>) => setDisableMarkdown(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPersonaFinder(event.target.checked);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='AI 模型'
                      description='配置' />
      <ModelsSetupButton isMissingModels={isMissingModels} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Enter 发送 ⏎'
                      description={enterIsNewline ? '换行' : '发送消息'} />
      <Switch checked={!enterIsNewline} onChange={handleEnterIsNewlineChange}
              endDecorator={enterIsNewline ? '关' : '开'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    {SHOW_MARKDOWN_DISABLE_SETTING && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='禁用 Markdown'
                        description={disableMarkdown ? '纯文本' : '渲染 Markdown'} />
        <Switch checked={disableMarkdown} onChange={handleDisableMarkdown}
                endDecorator={disableMarkdown ? '开' : '关'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </FormControl>
    )}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title={isMobile ? '编辑模式' : '简易编辑'}
                      description={doubleClickToEdit ? (isMobile ? '双击' : '双击') : (isMobile ? '菜单' : 'Shift + 双击')} />
      <Switch checked={doubleClickToEdit} onChange={handleDoubleClickToEditChange}
              endDecorator={doubleClickToEdit ? '开' : '关'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    {SHOW_PURPOSE_FINDER && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='目标发现器'
                      description={showPersonaFinder ? '显示搜索栏' : '隐藏搜索栏'} />
      <Switch checked={showPersonaFinder} onChange={handleShowSearchBarChange}
              endDecorator={showPersonaFinder ? '开' : '关'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>}

    <SettingUIContentScaling />

    {!isPwa() && !isMobile && (
      <FormRadioControl
        title='页面宽度'
        description={centerMode === 'full' ? '全屏对话' : centerMode === 'narrow' ? '窄屏对话' : '宽屏'}
        options={OptionsPageSize}
        value={centerMode} onChange={setCenterMode}
      />
    )}

    <SettingUIComplexity />

    {isMobile && <SettingUIComposerQuickButton />}

  </>;
}
