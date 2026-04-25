import * as React from 'react';

import { Button, Sheet, Typography } from '@mui/joy';

import { useSingleTabEnforcer } from '../components/useSingleTabEnforcer';


export const ProviderSingleTab = (props: { disabled?: boolean, children: React.ReactNode }) => {

  // state
  const isSingleTab = useSingleTabEnforcer('big-agi-tabs');
  const [dismissed, setDismissed] = React.useState(false);

  // allow multi-window usage, only show a non-blocking notice
  const showNotice = !props.disabled && isSingleTab === false && !dismissed;

  return (
    <>
      {props.children}

      {showNotice && (
        <Sheet
          variant='solid'
          invertedColors
          sx={{
            position: 'fixed',
            left: 12,
            right: 12,
            top: 12,
            zIndex: 2000,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            gap: 1.5,
            p: 1.5,
            borderRadius: 'md',
            boxShadow: 'lg',
          }}
        >
          <Typography level='body-sm'>
            检测到你在同一浏览器中打开了多个窗口或标签页。当前已允许同时使用，但为避免状态不同步，建议尽量在同一窗口完成操作。
          </Typography>

          <Button size='sm' onClick={() => setDismissed(true)}>
            我知道了
          </Button>
        </Sheet>
      )}
    </>
  );
};
