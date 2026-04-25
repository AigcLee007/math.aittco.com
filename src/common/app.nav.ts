import type { FunctionComponent } from 'react';

// App icons
import DifferenceOutlinedIcon from '@mui/icons-material/DifferenceOutlined';
import Diversity2Icon from '@mui/icons-material/Diversity2';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import GrainIcon from '@mui/icons-material/Grain';
import ImageIcon from '@mui/icons-material/Image';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import IosShareIcon from '@mui/icons-material/IosShare';
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined';
// Link icons
import GitHubIcon from '@mui/icons-material/GitHub';
import { DiscordIcon } from '~/common/components/icons/3rdparty/DiscordIcon';
// Modal icons
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import { Brand } from '~/common/app.config';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { PhChats } from '~/common/components/icons/phosphor/PhChats';
import { PhChatsDuotone } from '~/common/components/icons/phosphor/PhChatsDuotone';
import { hasNoChatLinkItems } from '~/modules/trade/link/store-share-link';

// enable to show all items, for layout development
const SHOW_ALL_APPS = false;

const SPECIAL_DIVIDER = '__DIVIDER__';

interface ItemBase {
  name: string,
  icon: FunctionComponent,
  iconActive?: FunctionComponent,
  tooltip?: string,
}

export interface NavItemApp extends ItemBase {
  type: 'app',
  mobileName?: string,
  route: string,
  landingRoute?: string,
  barTitle?: string,
  hideOnMobile?: boolean,
  hideIcon?: boolean | (() => boolean),
  hideBar?: boolean,
  hideDrawer?: boolean,
  panelAsMenu?: boolean,
  hideNav?: boolean | (() => boolean),
  fullWidth?: boolean,
  pageBrighter?: boolean,
  position?: 'top' | 'bottom',
  isDev?: boolean,
  _delete?: boolean,
}

export interface NavItemModal extends ItemBase {
  type: 'modal',
  overlayId: 'settings' | 'models',
}

export interface NavItemExtLink extends ItemBase {
  type: 'extLink',
  href: string,
}

export const navItems: {
  apps: NavItemApp[],
  modals: NavItemModal[],
  links: NavItemExtLink[],
} = {

  apps: [
    {
      name: '对话',
      icon: PhChats,
      iconActive: PhChatsDuotone,
      type: 'app',
      route: '/',
    },
    {
      name: '图像生成',
      icon: ImageOutlinedIcon,
      iconActive: ImageIcon,
      type: 'app',
      route: '/banana',
      hideDrawer: true,
      hideBar: true,
      fullWidth: true,
    },
    {
      name: '历史记录',
      icon: EventNoteOutlinedIcon,
      iconActive: EventNoteIcon,
      type: 'app',
      route: '/history',
    },
    {
      name: '创建角色',
      mobileName: '角色',
      icon: Diversity2Icon,
      type: 'app',
      route: '/personas',
      hideBar: true,
      hideOnMobile: true,
    },
    {
      name: '文本对比',
      barTitle: '对比',
      icon: DifferenceOutlinedIcon,
      type: 'app',
      route: '/diff',
      hideDrawer: true,
      hideOnMobile: true,
    },
    {
      name: '金币中心',
      barTitle: '金币中心',
      icon: GrainIcon,
      type: 'app',
      route: '/tokens',
      hideDrawer: true,
      hideOnMobile: true,
      hideIcon: true,
      isDev: true,
    },
    {
      name: '消费记录',
      barTitle: '消费记录',
      icon: EventNoteOutlinedIcon,
      iconActive: EventNoteIcon,
      type: 'app',
      route: '/billing',
      hideDrawer: true,
      hideIcon: true,
      hideNav: true,
      hideOnMobile: true,
    },
    {
      name: '多模型融合',
      icon: ChatBeamIcon,
      type: 'app',
      route: '/dev/beam',
      hideDrawer: true,
      hideIcon: true,
      isDev: true,
    },
    {
      name: '媒体库',
      icon: ImageOutlinedIcon,
      iconActive: ImageIcon,
      type: 'app',
      route: '/media',
      isDev: true,
      _delete: true,
    },
    {
      name: '共享对话',
      barTitle: '共享对话',
      icon: IosShareOutlinedIcon,
      iconActive: IosShareIcon,
      type: 'app',
      route: '/link/chat/[chatLinkId]',
      landingRoute: '/link/chat/list',
      hideOnMobile: true,
      panelAsMenu: true,
      hideIcon: hasNoChatLinkItems,
      hideNav: hasNoChatLinkItems,
    },
    {
      name: '新闻',
      icon: EventNoteOutlinedIcon,
      iconActive: EventNoteIcon,
      type: 'app',
      route: '/news',
      hideBar: true,
      hideDrawer: true,
      hideOnMobile: true,
      _delete: true,
    },
  ],

  modals: [
    {
      name: '配置 AI 模型',
      icon: BuildCircleIcon,
      type: 'modal',
      overlayId: 'models',
    },
    {
      name: '用户中心',
      icon: SettingsIcon,
      type: 'modal',
      overlayId: 'settings',
    },
  ],

  links: [
    // {
    //   type: 'extLink',
    //   name: 'GitHub',
    //   icon: GitHubIcon,
    //   href: Brand.URIs.GitHubRepo,
    // },
    // {
    //   type: 'extLink',
    //   name: 'Discord',
    //   icon: DiscordIcon,
    //   href: Brand.URIs.SupportInvite,
    // },
  ],
};

navItems.apps = navItems.apps.filter(app => !app._delete || SHOW_ALL_APPS);

export function checkDivider(app?: NavItemApp) {
  return app?.name === SPECIAL_DIVIDER;
}

export function checkVisibileIcon(app: NavItemApp, isMobile: boolean, currentApp?: NavItemApp) {
  return app.hideOnMobile && isMobile ? false : app === currentApp ? true : typeof app.hideIcon === 'function' ? !app.hideIcon() : !app.hideIcon;
}

export function checkVisibleNav(app?: NavItemApp) {
  return !app ? false : typeof app.hideNav === 'function' ? !app.hideNav() : !app.hideNav;
}
