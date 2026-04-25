import * as React from 'react';
import { useRouter } from 'next/router';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Divider, Tooltip } from '@mui/joy';

import { ClaudeHistoryIcon, ClaudeImageIcon, ClaudeNewChatIcon, ClaudeToggleIcon } from './ClaudeIcons';

import { checkDivider, checkVisibileIcon, NavItemApp, navItems } from '~/common/app.nav';
import { clientUtmSource } from '~/common/util/pwaUtils';
import { themeZIndexDesktopNav } from '~/common/app.theme';

import { BringTheLove } from './BringTheLove';
import { DesktopNavGroupBox, DesktopNavIcon, navItemClasses } from './DesktopNavIcon';
import { InvertedBar, InvertedBarCornerItem } from '../InvertedBar';
import { optimaToggleDrawer, useOptimaDrawerOpen, useOptimaDrawerPeeking } from '../useOptima';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { UserMenu } from './UserMenu';
import { ContactService } from '~/common/components/ContactService';

export const bigAgiProUrl = 'https://big-agi.com' + clientUtmSource('upgrade-apps');

const desktopNavBarSx: SxProps = {
  zIndex: themeZIndexDesktopNav,
};

const bottomGroupSx: SxProps = {
  mt: 'auto',
  mb: '12px',
};

const navItemsDividerSx: SxProps = {
  my: 1,
  width: '50%',
  mx: 'auto',
};

export function DesktopNav(props: { component: React.ElementType, currentApp?: NavItemApp }) {
  const { push, pathname } = useRouter();
  const isBananaPage = pathname === '/banana';

  const isDrawerOpen = useOptimaDrawerOpen();
  const isDrawerPeeking = useOptimaDrawerPeeking();

  const logoButtonTogglesPane = true;

  const { navAppItems, navBottomAppItems } = React.useMemo(() => {
    let crossedDivider = false;
    const visibleApps: NavItemApp[] = [];
    const overflowApps: NavItemApp[] = [];
    const bottomApps: NavItemApp[] = [];

    navItems.apps.forEach((app) => {
      if (checkVisibileIcon(app, false, props.currentApp)) {
        if (app.route === '/')
          return;

        if (app.position === 'bottom') {
          bottomApps.push(app);
        } else if (!crossedDivider || app === props.currentApp) {
          visibleApps.push(app);
        } else {
          overflowApps.push(app);
        }
        crossedDivider = crossedDivider || checkDivider(app);
      }
    });

    const components: React.JSX.Element[] = visibleApps.map((app, appIdx) => {
      const isActive = app === props.currentApp;
      const isDrawerable = isActive && !app.hideDrawer;
      const isPaneOpen = isDrawerable && isDrawerOpen;

      if (checkDivider(app))
        return <Divider key={'app-sep-' + appIdx} sx={navItemsDividerSx} />;

      return (
        <Tooltip key={'n-m-' + app.route.slice(1)} disableInteractive enterDelay={600} title={app.name + (app.isDev ? ' [DEV]' : '')}>
          <DesktopNavIcon
            variant={isActive ? 'solid' : undefined}
            onPointerDown={isDrawerable ? optimaToggleDrawer : () => push(app.landingRoute || app.route)}
            className={`${navItemClasses.typeApp} ${isActive ? navItemClasses.active : ''} ${isPaneOpen ? navItemClasses.paneOpen : ''} ${app.isDev ? navItemClasses.dev : ''}`}
            sx={appIdx !== 0 ? undefined : { '--Icon-fontSize': '1.375rem!important' }}
          >
            {(isActive && app.iconActive) ? <app.iconActive /> : <app.icon />}
          </DesktopNavIcon>
        </Tooltip>
      );
    });

    const bottomComponents = bottomApps.map((app) => {
      const isActive = app === props.currentApp;
      const isDrawerable = isActive && !app.hideDrawer;
      const isPaneOpen = isDrawerable && isDrawerOpen;

      return (
        <Tooltip key={'n-m-' + app.route.slice(1)} disableInteractive enterDelay={600} title={app.name + (app.isDev ? ' [DEV]' : '')}>
          <DesktopNavIcon
            variant={isActive ? 'solid' : undefined}
            onPointerDown={isDrawerable ? optimaToggleDrawer : () => push(app.landingRoute || app.route)}
            className={`${navItemClasses.typeApp} ${isActive ? navItemClasses.active : ''} ${isPaneOpen ? navItemClasses.paneOpen : ''} ${app.isDev ? navItemClasses.dev : ''}`}
            sx={{ mb: 1 }}
          >
            {(isActive && app.iconActive) ? <app.iconActive /> : <app.icon />}
          </DesktopNavIcon>
        </Tooltip>
      );
    });

    return { navAppItems: components, navBottomAppItems: bottomComponents };
  }, [props.currentApp, isDrawerOpen, push]);

  const navExtLinkItems = React.useMemo(() => {
    return navItems.links.map((item, index) =>
      <BringTheLove
        key={'nav-ext-' + item.name}
        asIcon
        text={item.name}
        icon={item.icon}
        link={item.href}
        sx={{
          p: 1,
          mb: index > 0 ? 1 : 0,
        }}
      />,
    );
  }, []);

  return (
    <InvertedBar
      id='desktop-nav'
      component={props.component}
      direction='vertical'
      isDrawerOpen={isDrawerOpen}
      sx={desktopNavBarSx}
    >
      <InvertedBarCornerItem>
        <Tooltip
          disableInteractive
          title={isBananaPage
            ? '回到对话'
            : (isDrawerPeeking ? '固定侧边栏' : (isDrawerOpen ? '关闭侧边栏' : '打开侧边栏'))}
        >
          <DesktopNavIcon
            disabled={isBananaPage ? false : !logoButtonTogglesPane}
            onPointerDown={isBananaPage ? () => push('/') : optimaToggleDrawer}
            className={`${navItemClasses.typeMenu} ${(!isBananaPage && isDrawerOpen) ? navItemClasses.active : ''}`}
          >
            <ClaudeToggleIcon />
          </DesktopNavIcon>
        </Tooltip>
      </InvertedBarCornerItem>

      <DesktopNavGroupBox sx={{ mt: '13px', gap: 0, justifyContent: 'flex-start' }}>
        <Tooltip disableInteractive title='开启新对话'>
          <DesktopNavIcon
            onClick={() => {
              const newId = useChatStore.getState().prependNewConversation(undefined, false);
              push(`/?chat=${newId}`);
            }}
          >
            <ClaudeNewChatIcon />
          </DesktopNavIcon>
        </Tooltip>

        <Tooltip disableInteractive title='对话历史记录'>
          <DesktopNavIcon
            className={pathname === '/history' ? navItemClasses.active : undefined}
            onClick={() => push('/history')}
            sx={{ mt: '12px' }}
          >
            <ClaudeHistoryIcon />
          </DesktopNavIcon>
        </Tooltip>

        <Tooltip disableInteractive title='图像生成'>
          <DesktopNavIcon
            className={pathname === '/banana' ? navItemClasses.active : undefined}
            onClick={() => push('/banana')}
            sx={{ mt: '8px' }}
          >
            <ClaudeImageIcon />
          </DesktopNavIcon>
        </Tooltip>

        <Divider sx={navItemsDividerSx} />
      </DesktopNavGroupBox>

      <DesktopNavGroupBox sx={{ ...bottomGroupSx, gap: 0.5 }}>
        {navBottomAppItems}
        {navExtLinkItems}
        <Box sx={{ p: '8px', mt: 0.5 }}>
          <ContactService />
        </Box>
        <UserMenu />
      </DesktopNavGroupBox>
    </InvertedBar>
  );
}
