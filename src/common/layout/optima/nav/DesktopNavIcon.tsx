import { Box, IconButton, styled } from '@mui/joy';

import { animationColorBeamScatterINV } from '~/common/util/animUtils';

import { OPTIMA_NAV_RADIUS } from '../optima.config';


export const DesktopNavGroupBox = styled(Box)({
  // flex column
  display: 'flex',
  flexDirection: 'column',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',

  // nav items, reduce the marginBlock a little
  '--GroupMarginY': '0.125rem',

  // style
  // backgroundColor: 'rgba(0 0 0 / 0.5)',
  // borderRadius: '1rem',
  // paddingBlock: '0.5rem',
  // overflow: 'hidden',
});


export const navItemClasses = {
  typeMenu: 'NavButton-typeMenu',
  typeApp: 'NavButton-typeApp',
  typeLinkOrModal: 'NavButton-typeLink',
  dev: 'NavButton-dev',
  active: 'NavButton-active',
  paneOpen: 'NavButton-paneOpen',
  attractive: 'NavButton-attractive',
};

export const DesktopNavIcon = styled(IconButton)(({ theme }) => ({
  // --Bar is defined in InvertedBar
  '--MarginX': '0.25rem',

  // marginBlock: 'var(--GroupMarginY)',
  marginBlock: 0,
  //marginInline: .. not needd because we center the items
  padding: 0,

  [`&.${navItemClasses.typeApp},&.${navItemClasses.typeLinkOrModal}`]: {
    '--Icon-fontSize': '1.7875rem',
    borderRadius: '8px',
  },

  // hamburger menu: quick rotate on click
  [`&.${navItemClasses.typeMenu}`]: {
    '--Icon-fontSize': '1.95rem', // 1.5rem * 1.3
    transition: 'rotate 0.6s',
    '&:active': {
      rotate: '90deg',
      transition: 'rotate 0.2s',
    },
  },


  [`&.${navItemClasses.typeApp},&.${navItemClasses.typeLinkOrModal}`]: {
    '--IconButton-size': '52px', // increased size to accommodate larger icons
    transition: 'background-color 0.2s, color 0.1s',
  },

  [`&.${navItemClasses.typeApp}:hover,&.${navItemClasses.typeLinkOrModal}:hover`]: {
    backgroundColor: '#ecece6', // Soft Claude hover grey/beige
    color: theme.palette.text.primary,
  },

  // Active state styling
  [`&.${navItemClasses.active}`]: {
    backgroundColor: '#e6e6e0', // Slightly darker active beige for better visibility
    color: theme.palette.text.primary,
  },

  // [`&.${navItemClasses.typeLinkOrModal}`]: {
  //   borderRadius: '50%',
  //   transition: 'font-size 5s, color 0.2s',
  // },

  // app active (non hover)
  // [`&.${navItemClasses.typeApp}.${navItemClasses.active}`]: {},

  // pane open: show a connected half
  [`&.${navItemClasses.paneOpen}`]: {
    // squircle animation
    borderStartStartRadius: `var(--joy-radius-${OPTIMA_NAV_RADIUS})`,
    borderEndStartRadius: `var(--joy-radius-${OPTIMA_NAV_RADIUS})`,
    // borderStartStartRadius: 'calc(var(--IconButton-size) / 4)',
    // borderEndStartRadius: 'calc(var(--IconButton-size) / 4)',
    borderStartEndRadius: 0,
    borderEndEndRadius: 0,
    marginLeft: 'calc(2 * var(--MarginX))',
    paddingRight: 'calc(2 * var(--MarginX))',
  },
  [`&.${navItemClasses.paneOpen}:hover`]: {
    borderRadius: `var(--joy-radius-${OPTIMA_NAV_RADIUS})`,
    // borderRadius: 'var(--joy-radius-md, 0.5rem)',
    marginLeft: 0,
    paddingRight: 0,
  },

  // attractive: attract the user to click on this element
  [`&.${navItemClasses.attractive}`]: {
    '--Icon-fontSize': '2rem',
    animation: `${animationColorBeamScatterINV} 4s infinite`,
  },

  // debug: show a red outline
  [`&.${navItemClasses.dev}`]: {
    border: '2px dashed red',
  },

})) as typeof IconButton;