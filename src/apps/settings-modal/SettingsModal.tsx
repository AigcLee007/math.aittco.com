import * as React from 'react';

import { Accordion, AccordionDetails, AccordionGroup, AccordionSummary, accordionSummaryClasses, Avatar, Box, Button, ListItemContent, styled, Tab, TabList, TabPanel, Tabs, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import Diversity2Icon from '@mui/icons-material/Diversity2';
import KeyboardCommandKeyOutlinedIcon from '@mui/icons-material/KeyboardCommandKeyOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import MicIcon from '@mui/icons-material/Mic';
import SearchIcon from '@mui/icons-material/Search';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';


import { DallESettings } from '~/modules/t2i/dalle/DallESettings';
import { GoogleSearchSettings } from '~/modules/google/GoogleSearchSettings';
import { T2ISettings } from '~/modules/t2i/T2ISettings';
import { GeminiSettings } from '~/modules/t2i/gemini/GeminiSettings';

import type { PreferencesTabId } from '~/common/layout/optima/store-layout-optima';
import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';
import { DarkModeToggleButton, darkModeToggleButtonSx } from '~/common/components/DarkModeToggleButton';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { PhVoice } from '~/common/components/icons/phosphor/PhVoice';
import { optimaActions } from '~/common/layout/optima/useOptima';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { ApiKeysSettings } from './ApiKeysSettings';
import { AppChatSettingsAI } from './AppChatSettingsAI';
import { AppChatSettingsUI } from './settings-ui/AppChatSettingsUI';
import { PersonasSettings } from './PersonasSettings';

import { AboutSettings } from './AboutSettings';


// configuration
const TAB_RADIUS = 'md';
const COLOR_TAB_LIST = 'primary';
const COLOR_TOPIC_ICON = 'primary';


// styled <AccordionGroup variant='plain'> into a Topics component
const Topics = styled(AccordionGroup)({
  // round and clip corners
  borderRadius: `calc(var(--joy-radius-${TAB_RADIUS}) - 1px)`, // compensates for a half-pixel weirdness
  overflow: 'hidden',

  // larger summary, with a spinning icon
  [`& .${accordionSummaryClasses.button}`]: {
    minHeight: '52px',
    border: 'none',
    paddingRight: '0.75rem',
    backgroundColor: 'rgba(var(--joy-palette-primary-lightChannel) / 0.2)',
    gap: '1rem',
  },
  [`& .${accordionSummaryClasses.indicator}`]: {
    transition: '0.2s',
  },
  [`& [aria-expanded="true"] .${accordionSummaryClasses.indicator}`]: {
    transform: 'rotate(45deg)',
  },
});

function Topic(props: { title?: React.ReactNode, icon?: string | React.ReactNode, startCollapsed?: boolean, children?: React.ReactNode }) {

  // state
  const [expanded, setExpanded] = React.useState(props.startCollapsed !== true);

  // derived state
  const hideTitleBar = !props.title && !props.icon;

  return (
    <Accordion
      expanded={expanded || hideTitleBar}
      onChange={(_event, expanded) => setExpanded(expanded)}
      sx={{
        '&:not(:last-child)': {
          borderBottomColor: 'primary.softActiveBg',
        },
        '&:last-child': {
          borderBottom: 'none',
        },
      }}
    >

      {!hideTitleBar && (
        <AccordionSummary
          color='primary'
          variant={expanded ? 'plain' : 'soft'}
          indicator={<AddIcon />}
          slotProps={!expanded ? undefined : {
            button: { sx: { backgroundColor: 'rgba(var(--joy-palette-primary-lightChannel) / 0.2)' } },
          }}
        >
          {!!props.icon && (
            <Avatar
              size='sm'
              color={COLOR_TOPIC_ICON}
              variant={expanded ? 'plain' /* was: soft */ : 'plain'}
            >
              {props.icon}
            </Avatar>
          )}
          <ListItemContent sx={{ color: `${COLOR_TOPIC_ICON}.softColor` }}>
            {props.title}
          </ListItemContent>
        </AccordionSummary>
      )}

      <AccordionDetails
        slotProps={{
          content: {
            sx: {
              p: { xs: 1.5, md: 2.5 },
            },
          },
        }}
      >
        <Box sx={{
          display: 'grid',
          gap: 2, // keep in sync with ProviderConfigure > ExpanderControlledBox > Card > CardContent (Draw App)
        }}>
          {props.children}
        </Box>
      </AccordionDetails>

    </Accordion>
  );
}


const _styles = {

  // modal: undefined,
  modal: {
    flexGrow: 1,
    backgroundColor: 'background.level1',
  } as const,

  tabs: {
    backgroundColor: 'transparent',
  } as const,

  tabsList: {
    backgroundColor: `${COLOR_TAB_LIST}.softHoverBg`,
    mb: 2,
    p: 0.5,
    // borderRadius: '2rem',
    borderRadius: TAB_RADIUS,
    fontSize: 'md',
    fontWeight: 'md',
    boxShadow: `inset 1px 1px 4px -3px var(--joy-palette-${COLOR_TAB_LIST}-solidHoverBg)`,
    gap: 0.5,
  } as const,

  tabsListTab: {
    // borderRadius: '2rem',
    borderRadius: 'sm',
    fontSize: 'sm',
    flex: 1,
    p: 0,
    '&[aria-selected="true"]': {
      // color: 'primary.plainColor',
      bgcolor: 'background.popup',
      // color: `${COLOR_TAB_LIST}.solidColor`,
      // bgcolor: `${COLOR_TAB_LIST}.solidBg`,
      boxShadow: 'xs',
      fontWeight: 'lg',
      zIndex: 1,
    } as const,
    // '&:hover': {
    //   backgroundColor: 'background.level1',
    // } as const,
  } as const,

  tabPanel: {
    boxShadow: 'xs',
    backgroundColor: 'background.surface',
    borderRadius: TAB_RADIUS,
    p: 0,
    // p: 'var(--Tabs-gap)',
  } as const,

} as const;


import { ProfileSettings } from './ProfileSettings';

/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 */
export function SettingsModal(props: {
  open: boolean,
  tab: PreferencesTabId,
  setTab: (index: PreferencesTabId) => void,
  onClose: () => void,
  onOpenShortcuts: () => void,
}) {

  // external state
  const isMobile = useIsMobile();

  // handlers

  const { setTab } = props;
  const enableAixDebuggerDialog = true;

  const handleSetTab = React.useCallback((_event: any, value: string | number | null) => {
    setTab((value ?? undefined) as PreferencesTabId);
  }, [setTab]);

  return (
    <GoodModal
      // title='Preferences' strongerTitle
      title={
        <AppBreadcrumbs size='md' rootTitle={isMobile ? '用户' : '用户中心'}>
          <AppBreadcrumbs.Leaf><b>账户设置</b></AppBreadcrumbs.Leaf>
        </AppBreadcrumbs>
      }
      open={props.open} onClose={props.onClose}
      fullscreen={isMobile}
      startButton={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <DarkModeToggleButton hasText />
          {!isMobile && <Button variant='soft' color='neutral' onClick={props.onOpenShortcuts} startDecorator={<KeyboardCommandKeyOutlinedIcon color='primary' />} sx={darkModeToggleButtonSx}>
            快捷键
          </Button>}
        </Box>
      }
      sx={_styles.modal}
    >

      {/*<Divider />*/}

      <Tabs
        aria-label='Settings tabbed menu'
        value={props.tab || 'chat'}
        onChange={handleSetTab}
        sx={_styles.tabs}
      >
        <TabList
          size='sm'
          disableUnderline
          sx={_styles.tabsList}
        >
          <Tab value='profile' disableIndicator sx={_styles.tabsListTab}>个人资料</Tab>
          <Tab value='apikeys' disableIndicator sx={_styles.tabsListTab}>账户余额</Tab>
          <Tab value='chat' disableIndicator sx={_styles.tabsListTab}>对话</Tab>
          <Tab value='personas' disableIndicator sx={_styles.tabsListTab}>AI 角色</Tab>
          <Tab value='about' disableIndicator sx={_styles.tabsListTab}>关于</Tab>
        </TabList>

        <TabPanel value='profile' color='primary' variant='outlined' sx={_styles.tabPanel}>
          <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
            <ProfileSettings />
          </Box>
        </TabPanel>

        <TabPanel value='apikeys' color='primary' variant='outlined' sx={_styles.tabPanel}>
          <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
            <ApiKeysSettings />
          </Box>
        </TabPanel>

        <TabPanel value='chat' color='primary' variant='outlined' sx={_styles.tabPanel}>
          <Topics>
            <Topic title='界面设置'>
              <AppChatSettingsUI />
            </Topic>
            <Topic icon={<AutoAwesomeIcon />} title={
              '对话 AI'
              // <>Chat AI <WarningRoundedIcon sx={{ ml: 1, color: 'orangered' }} /></>
            } startCollapsed>
              <AppChatSettingsAI />
            </Topic>
          </Topics>
        </TabPanel>


        <TabPanel value='personas' color='primary' variant='outlined' sx={_styles.tabPanel}>
          <Topics>
            <Topic icon={<Diversity2Icon />} title='AI 角色'>
              <PersonasSettings />
            </Topic>
          </Topics>
        </TabPanel>


        <TabPanel value='about' color='primary' variant='outlined' sx={_styles.tabPanel}>
          <AboutSettings />
        </TabPanel>
      </Tabs>

      {/*<Divider />*/}

    </GoodModal>
  );
}
