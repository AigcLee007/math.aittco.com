import * as React from 'react';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { Box, Input, Modal, ModalClose, ModalDialog, Typography, List, ListItem, ListItemButton, ListItemDecorator } from '@mui/joy';
import SearchIcon from '@mui/icons-material/Search';

import { useChatStore } from '~/common/stores/chat/store-chats';
import { useFolderStore } from '~/common/stores/folders/store-chat-folders';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { ChatDrawerItemMemo } from '~/apps/chat/components/layout-drawer/ChatDrawerItem';
import { useChatDrawerRenderItems } from '~/apps/chat/components/layout-drawer/useChatDrawerRenderItems';
import { useChatDrawerFilters } from '~/apps/chat/store-app-chat';
import { optimaCloseSearch } from '~/common/layout/optima/useOptima';


// this is here to make shallow comparisons work on the next hook
const noFolders: any[] = [];

export function GlobalSearchModal(props: { open: boolean, onClose: () => void }) {
  const { push } = useRouter();
  // local state
  const [searchQuery, setSearchQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // external state
  const { filterHasStars, filterHasImageAssets, filterHasDocFragments, filterIsArchived } = useChatDrawerFilters();
  const { folders, enableFolders } = useFolderStore(useShallow(state => ({ folders: state.folders, enableFolders: state.enableFolders })));
  const contentScaling = useUIPreferencesStore(state => state.contentScaling);

  // search logic
  const { renderNavItems } = useChatDrawerRenderItems(
    null, [], searchQuery, null, enableFolders ? folders : noFolders, 
    filterHasStars, filterHasImageAssets, filterHasDocFragments, filterIsArchived, 
    'date', 'frequency', false, 'attachments'
  );

  // Focus input on open
  React.useEffect(() => {
    if (props.open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [props.open]);

  const handleClose = () => {
    setSearchQuery('');
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={handleClose}>
      <ModalDialog
        sx={{
          minWidth: { xs: '90vw', sm: '600px' },
          maxWidth: '800px',
          p: 0,
          overflow: 'hidden',
          borderRadius: 'xl',
          border: 'none',
          boxShadow: 'xl',
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon sx={{ color: 'text.tertiary' }} />
          <Input
            slotProps={{ input: { ref: inputRef } }}
            variant="plain"
            placeholder="搜索对话和项目..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, '--Input-placeholderOpacity': 0.5, fontSize: 'lg' }}
          />
          <ModalClose sx={{ position: 'static' }} />
        </Box>

        <Box sx={{ p: 1, maxHeight: '60vh', overflowY: 'auto', bgcolor: 'background.level1' }}>
          {renderNavItems.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography level="body-sm" sx={{ color: 'text.tertiary' }}>
                {searchQuery ? `未找到关于 "${searchQuery}" 的结果` : '支持至少输入 3 个字符进行搜索...'}
              </Typography>
            </Box>
          ) : (
            <List sx={{ '--ListItem-radius': '8px' }}>
              {renderNavItems.map((item, idx) => (
                item.type === 'nav-item-chat-data' ? (
                  <ChatDrawerItemMemo
                    key={item.conversationId}
                    item={item}
                    showSymbols={true}
                    bottomBarBasis={0}
                    onConversationActivate={(id, _close) => {
                       push(`/?chat=${id}`);
                       handleClose();
                    }}
                    onConversationBranch={() => {}}
                    onConversationDeleteNoConfirmation={() => {}}
                    onConversationExport={() => {}}
                    onConversationFolderChange={() => {}}
                  />
                ) : item.type === 'nav-item-group' ? (
                   <Typography key={idx} level="body-xs" sx={{ px: 2, py: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                     {item.title}
                   </Typography>
                ) : null
              ))}
            </List>
          )}
        </Box>
      </ModalDialog>
    </Modal>
  );
}
