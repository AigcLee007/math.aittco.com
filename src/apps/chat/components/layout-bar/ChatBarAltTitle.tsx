import * as React from 'react';

import { Box, Typography } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import { autoConversationTitle } from '~/modules/aifn/autotitle/autoTitle';

import { DConversationId } from '~/common/stores/chat/chat.conversation';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { DarkModeToggleButton } from '~/common/components/DarkModeToggleButton';
import { AnnouncementCenter } from '~/common/components/AnnouncementCenter';

import { CHAT_NOVEL_TITLE } from '../../AppChat';

import { FadeInButton } from '../layout-drawer/ChatDrawerItem';


export function ChatBarAltTitle(props: {
  conversationId: DConversationId | null,
  conversationTitle: string,
}) {

  // state
  const [isEditingTitle, setIsEditingTitle] = React.useState<boolean>(false);

  // derived state
  const { conversationId, conversationTitle } = props;
  const hasConversation = !!conversationId;


  const handleTitleEditAuto = React.useCallback(async () => {
    if (!conversationId) return;
    setIsEditingTitle(true);
    await autoConversationTitle(conversationId, true);
    setIsEditingTitle(false);
  }, [conversationId]);


  return (
    <Box sx={{ display: 'flex', gap: { xs: 1, md: 3 }, alignItems: 'center' }}>

      <Typography>
        {capitalizeFirstLetter(conversationTitle?.trim() || CHAT_NOVEL_TITLE)}
      </Typography>

      {hasConversation && (
        <FadeInButton size='sm' disabled={isEditingTitle} onClick={handleTitleEditAuto}>
          <AutoFixHighIcon />
        </FadeInButton>
      )}

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AnnouncementCenter showStrip={false} />
        <DarkModeToggleButton />
      </Box>

    </Box>
  );
}

