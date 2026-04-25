import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function LayoutSidebarLeft(props: SvgIconProps) {
  return (
    <SvgIcon
      viewBox='0 0 16 16'
      width={16}
      height={16}
      fill='currentColor'
      {...props}
    >
      <path d='M2 1 1 2v12l1 1h12l1-1V2l-1-1H2zm12 1h-6v12h6V2zm-7 0H2v12h5V2zm-4 1v1H2V3h3zm0 2v1H2V5h3zm0 2v1H2V7h3z' />
    </SvgIcon>
  );
}
