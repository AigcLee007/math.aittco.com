import type { SxProps } from '@mui/joy/styles/types';

import { animationColorRainbow } from '~/common/util/animUtils';


export const messageAsideColumnSx: SxProps = {
  // make this stick to the top
  position: 'sticky',
  top: '0.25rem',

  minWidth: { xs: 40, md: 56 },
  flexShrink: 0,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.5,

  // when with the 'edit-button' class
  '&.msg-edit-button': {
    gap: 0.25,
  },
};

export const messageZenAsideColumnSx: SxProps = {
  ...messageAsideColumnSx,
  minWidth: undefined,
  maxWidth: undefined,
  mx: -1,
};

export const messageAvatarLabelSx: SxProps = {
  overflowWrap: 'anywhere',
};

export const messageAvatarLabelAnimatedSx: SxProps = {
  animation: `${animationColorRainbow} 5s linear infinite`,
  // Extra hinting... but looks weird
  // fontStyle: 'italic',
};
