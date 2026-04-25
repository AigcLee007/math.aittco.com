import * as React from 'react';
import { Box } from '@mui/joy';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';

import { useChatLLMDropdown } from './useLLMDropdown';
import { useFolderDropdown } from './useFolderDropdown';
import { DarkModeToggleButton } from '~/common/components/DarkModeToggleButton';
import { AnnouncementCenter } from '~/common/components/AnnouncementCenter';


export function ChatBarChat(props: {
  conversationId: DConversationId | null;
  llmDropdownRef: React.Ref<OptimaBarControlMethods>;
}) {

  // state
  const { chatLLMDropdown } = useChatLLMDropdown(props.llmDropdownRef);
  const { folderDropdown } = useFolderDropdown(props.conversationId);

  return <>

    <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', width: '100%' }}>
      {/* Model selector */}
      {chatLLMDropdown}

      {/* Folder selector */}
      {folderDropdown}

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AnnouncementCenter showStrip={false} />
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <DarkModeToggleButton />
        </Box>
      </Box>
    </Box>

  </>;
}

