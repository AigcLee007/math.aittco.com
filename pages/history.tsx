import * as React from 'react';
import { useRouter } from 'next/router';
import { useShallow } from 'zustand/react/shallow';
import { Box, Button, Container, Input, Typography, List, Checkbox } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';

import { useChatStore } from '~/common/stores/chat/store-chats';
import { withNextJSPerPageLayout } from '~/common/layout/withLayout';

import { ChatDrawerItemMemo } from '~/apps/chat/components/layout-drawer/ChatDrawerItem';
import { useChatDrawerRenderItems } from '~/apps/chat/components/layout-drawer/useChatDrawerRenderItems';
import { useChatDrawerFilters } from '~/apps/chat/store-app-chat';
import { ChatDrawerMemo } from '~/apps/chat/components/layout-drawer/ChatDrawer';
import { useConversation, getConversationSystemPurposeId } from '~/common/stores/chat/store-chats';
import { usePanesManager } from '~/apps/chat/components/panes/store-panes-manager';
import { useFolderStore } from '~/common/stores/folders/store-chat-folders';
import { getIsMobile } from '~/common/components/useMatchMedia';
import { optimaCloseDrawer } from '~/common/layout/optima/useOptima';
import { OptimaDrawerIn } from '~/common/layout/optima/portals/OptimaPortalsIn';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import type { TradeConfig } from '~/modules/trade/TradeModal';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { downloadSpecificJsonV1B } from '~/modules/trade/trade.client';

const TradeModalLazy = React.lazy(() => import('~/modules/trade/TradeModal').then(module => ({ default: module.TradeModal })));


function HistoryPage() {
  const { push } = useRouter();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [tradeConfig, setTradeConfig] = React.useState<TradeConfig | null>(null);
  const { showPromisedOverlay } = useOverlayComponents();

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // external state
  const { filterHasStars, filterHasImageAssets, filterHasDocFragments, filterIsArchived } = useChatDrawerFilters();
  
  const { renderNavItems } = useChatDrawerRenderItems(
    null, [], searchQuery, null, [], 
    filterHasStars, filterHasImageAssets, filterHasDocFragments, filterIsArchived, 
    'date', 'date', false, 'titles', true
  );

  const dataItems = React.useMemo(() => renderNavItems.filter(i => i.type === 'nav-item-chat-data'), [renderNavItems]);
  const isAllSelected = dataItems.length > 0 && selectedIds.size === dataItems.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(dataItems.map(i => i.type === 'nav-item-chat-data' ? i.conversationId : '')));
    }
  };

  const handleNewChat = () => {
    const chatStore = useChatStore.getState();
    const newId = chatStore.prependNewConversation(undefined, false);
    push(`/?chat=${newId}`);
  };

  const handleActivateChat = (id: string) => {
    push(`/?chat=${id}`);
  };

  // ChatDrawer Logic (derived from AppChat.tsx)
  const { 
    focusedPaneConversationId,
    openConversationInFocusedPane,
  } = usePanesManager();

  const {
    prependNewConversation,
    deleteConversations,
    branchConversation,
    recycleNewConversationId,
  } = useConversation(focusedPaneConversationId);

  const handleConversationNewInFocusedPane = React.useCallback((forceNoRecycle: boolean, isIncognito: boolean) => {
    const conversationId = (recycleNewConversationId && !forceNoRecycle && !isIncognito)
      ? recycleNewConversationId
      : prependNewConversation(getConversationSystemPurposeId(focusedPaneConversationId) ?? undefined, isIncognito);
    
    push(`/?chat=${conversationId}`);
    
    const activeFolderId = null; // We don't have folder state here yet
    if (activeFolderId && conversationId)
      useFolderStore.getState().addConversationToFolder(activeFolderId, conversationId);
    
    if (getIsMobile())
      optimaCloseDrawer();
  }, [focusedPaneConversationId, prependNewConversation, push, recycleNewConversationId]);

  const handleDeleteConversations = React.useCallback(async (conversationIds: string[], bypassConfirmation: boolean) => {
    // Basic deletion for history page
    deleteConversations(conversationIds, undefined);
  }, [deleteConversations]);

  const handleConversationBranch = React.useCallback((srcConversationId: string, messageId: string | null, addSplitPane: boolean) => {
    const branchedId = branchConversation(srcConversationId, messageId);
    if (branchedId) push(`/?chat=${branchedId}`);
    return branchedId;
  }, [branchConversation, push]);

  const handleDeleteAll = React.useCallback(async () => {
    const allIds = renderNavItems.map(i => i.type === 'nav-item-chat-data' ? i.conversationId : null).filter(Boolean) as string[];
    if (!allIds.length) return;
    
    if (await showPromisedOverlay('history-delete-all', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText={`确定要删除全部 ${allIds.length} 条对话记录吗？`}
        positiveActionText='删除全部'
        title='清空历史记录'
      />
    )) {
      deleteConversations(allIds, undefined);
    }
  }, [renderNavItems, deleteConversations, showPromisedOverlay]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography level="h2" component="h1" sx={{ fontWeight: 600 }}>
          对话历史
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {dataItems.length > 0 && (
            <Checkbox 
              label="全选" 
              checked={isAllSelected} 
              onChange={handleSelectAll} 
              sx={{ mr: 2 }}
            />
          )}
          <Button variant="outlined" color="neutral" startDecorator={<FileUploadOutlinedIcon />} onClick={() => setTradeConfig({ dir: 'import' })}>导入</Button>
          <Button 
            variant="outlined" 
            color="neutral" 
            startDecorator={<FileDownloadOutlinedIcon />} 
            onClick={() => {
              if (selectedIds.size > 0) {
                downloadSpecificJsonV1B(Array.from(selectedIds));
              } else {
                setTradeConfig({ dir: 'export', exportAll: true, conversationId: null });
              }
            }}
          >
            {selectedIds.size > 0 ? `导出所选 (${selectedIds.size})` : '全部导出'}
          </Button>
          <Button variant="outlined" color="danger" startDecorator={<DeleteOutlineIcon />} onClick={handleDeleteAll}>清空</Button>
          <Button
            variant="solid"
            color="neutral"
            startDecorator={<AddIcon />}
            onClick={handleNewChat}
            sx={{ borderRadius: 'xl', bgcolor: 'black', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
          >
            新对话
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Input
          size="lg"
          variant="outlined"
          placeholder="搜索对话..."
          startDecorator={<SearchIcon />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ borderRadius: 'lg', bgcolor: 'background.surface' }}
        />
      </Box>

      <Box sx={{ 
        bgcolor: 'background.surface', 
        borderRadius: 'xl', 
        p: 2, 
        boxShadow: 'sm', 
        border: '1px solid', 
        borderColor: 'divider',
        maxHeight: 'calc(100vh - 280px)',
        overflowY: 'auto',
      }}>
        <List variant="plain" sx={{ '--ListItem-radius': '8px', gap: 1, p: 0 }}>
          {renderNavItems.map((item, idx) => (
             item.type === 'nav-item-chat-data' ? (
                <ChatDrawerItemMemo
                  key={item.conversationId}
                  item={item}
                  showSymbols={true}
                  bottomBarBasis={0}
                  onConversationActivate={(id) => handleActivateChat(id)}
                  onConversationBranch={(id) => handleConversationBranch(id, null, false)}
                  onConversationDeleteNoConfirmation={(id) => handleDeleteConversations([id], true)}
                  onConversationExport={(id) => setTradeConfig({ dir: 'export', exportAll: false, conversationId: id })}
                  onConversationFolderChange={() => {}}
                  checkboxMode={true}
                  isChecked={selectedIds.has(item.conversationId)}
                  onToggleCheck={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      if (next.has(item.conversationId)) next.delete(item.conversationId);
                      else next.add(item.conversationId);
                      return next;
                    });
                  }}
                />
             ) : item.type === 'nav-item-group' ? (
                <Typography key={idx} level="body-xs" sx={{ px: 2, py: 2, fontWeight: 700, textTransform: 'uppercase', color: 'text.tertiary' }}>
                  {item.title}
                </Typography>
             ) : null
          ))}
          {renderNavItems.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
               <Typography color="neutral">未找到对话。</Typography>
            </Box>
          )}
        </List>
      </Box>

      {/* Portal the ChatDrawer into the Sidebar */}
      <OptimaDrawerIn>
        <ChatDrawerMemo
           activeConversationId={null}
           activeFolderId={null}
           chatPanesConversationIds={[]}
           disableNewButton={false}
           focusedChatBeamOpen={false}
           onConversationActivate={handleActivateChat}
           onConversationBranch={handleConversationBranch}
           onConversationNew={handleConversationNewInFocusedPane}
           onConversationsDelete={handleDeleteConversations}
           onConversationsExportDialog={() => {}}
           onConversationsImportDialog={() => {}}
           setActiveFolderId={() => {}}
        />
      </OptimaDrawerIn>

      {!!tradeConfig && (
        <React.Suspense fallback={null}>
          <TradeModalLazy
            config={tradeConfig}
            onConversationActivate={handleActivateChat}
            onClose={() => setTradeConfig(null)}
          />
        </React.Suspense>
      )}
    </Container>
  );
}

export default withNextJSPerPageLayout({ type: 'optima' }, HistoryPage);
