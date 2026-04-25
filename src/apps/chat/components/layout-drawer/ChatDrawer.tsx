import * as React from 'react';
import Router from 'next/router';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Dropdown, IconButton, ListDivider, ListItem, ListItemButton, ListItemDecorator, Menu, MenuButton, MenuItem, Stack, Tooltip, Typography, useColorScheme } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ImageIcon from '@mui/icons-material/Image';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import SearchIcon from '@mui/icons-material/Search';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SidebarIcon from '@mui/icons-material/ViewSidebar'; // For collapse icon

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { DFolder, useFolderStore } from '~/common/stores/folders/store-chat-folders';
import { DebouncedInputMemo } from '~/common/components/DebouncedInput';
import { FoldersToggleOff } from '~/common/components/icons/FoldersToggleOff';
import { ClaudeSettingsIcon } from '~/common/layout/optima/nav/ClaudeIcons';
import { FoldersToggleOn } from '~/common/components/icons/FoldersToggleOn';
import { OPTIMA_DRAWER_BACKGROUND } from '~/common/layout/optima/optima.config';
import { OptimaDrawerHeader } from '~/common/layout/optima/drawer/OptimaDrawerHeader';
import { OptimaDrawerList } from '~/common/layout/optima/drawer/OptimaDrawerList';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { getIsMobile } from '~/common/components/useMatchMedia';
import { optimaCloseDrawer, optimaOpenPreferences, optimaOpenSearch, useOptimaDrawerOpen } from '~/common/layout/optima/useOptima';
import { themeScalingMap, themeSerifFontFamilyCss, themeZIndexOverMobileDrawer } from '~/common/app.theme';
import { useUIPreferencesStore } from '~/common/stores/store-ui';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';
import { useLLM } from '~/common/stores/llms/llms.hooks';

import { ChatDrawerItemMemo, FolderChangeRequest } from './ChatDrawerItem';
import { ChatFolderList } from './folders/ChatFolderList';
import { ChatNavGrouping, ChatSearchDepth, ChatSearchSorting, isDrawerSearching, useChatDrawerRenderItems } from './useChatDrawerRenderItems';
import { ClearFolderText } from '../layout-bar/useFolderDropdown';
import { useChatDrawerFilters } from '../../store-app-chat';


// this is here to make shallow comparisons work on the next hook
const noFolders: DFolder[] = [];

/*
 * Lists folders and returns the active folder
 */
export const useFolders = (activeFolderId: string | null) => useFolderStore(useShallow(({ enableFolders, folders, toggleEnableFolders }) => {

  // finds the active folder if any
  const activeFolder = (enableFolders && activeFolderId)
    ? folders.find(folder => folder.id === activeFolderId) ?? null
    : null;

  return {
    activeFolder,
    allFolders: enableFolders ? folders : noFolders,
    enableFolders,
    toggleEnableFolders,
  };
}));


export const ChatDrawerMemo = React.memo(ChatDrawer);

function ChatDrawer(props: {
  activeConversationId: DConversationId | null,
  activeFolderId: string | null,
  chatPanesConversationIds: DConversationId[],
  disableNewButton: boolean,
  focusedChatBeamOpen: boolean,
  onConversationActivate: (conversationId: DConversationId) => void,
  onConversationBranch: (conversationId: DConversationId, messageId: string | null, addSplitPane: boolean) => void,
  onConversationNew: (forceNoRecycle: boolean, isIncognito: boolean) => void,
  onConversationsDelete: (conversationIds: DConversationId[], bypassConfirmation: boolean) => void,
  onConversationsExportDialog: (conversationId: DConversationId | null, exportAll: boolean) => void,
  onConversationsImportDialog: () => void,
  setActiveFolderId: (folderId: string | null) => void,
}) {

  const { onConversationActivate, onConversationBranch, onConversationNew, onConversationsDelete, onConversationsExportDialog } = props;

  // local state
  const isDrawerOpen = useOptimaDrawerOpen();
  const [navGrouping, setNavGrouping] = React.useState<ChatNavGrouping>('date');
  const [searchSorting, setSearchSorting] = React.useState<ChatSearchSorting>('date');
  const [searchDepth, setSearchDepth] = React.useState<ChatSearchDepth>('attachments'); // default: full search
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');
  const [folderChangeRequest, setFolderChangeRequest] = React.useState<FolderChangeRequest | null>(null);
  const [renderLimit, setRenderLimit] = React.useState(200); // progressive loading limit
  const { mode } = useColorScheme();

  // external state
  const {
    clearFilters,
    filterHasDocFragments, toggleFilterHasDocFragments,
    filterHasImageAssets, toggleFilterHasImageAssets,
    filterHasStars, toggleFilterHasStars,
    filterIsArchived, toggleFilterIsArchived,
    showPersonaIcons, toggleShowPersonaIcons,
    showRelativeSize, toggleShowRelativeSize,
  } = useChatDrawerFilters();
  const { activeFolder, allFolders, enableFolders, toggleEnableFolders } = useFolders(props.activeFolderId);
  const { filteredChatsCount, filteredChatIDs, filteredChatsAreEmpty, filteredChatsBarBasis, filteredChatsIncludeActive, renderNavItems } = useChatDrawerRenderItems(
    props.activeConversationId, props.chatPanesConversationIds, debouncedSearchQuery, activeFolder, allFolders, filterHasStars, filterHasImageAssets, filterHasDocFragments, filterIsArchived, navGrouping, searchSorting, showRelativeSize, searchDepth,
  );
  const [uiComplexityMode, contentScaling] = useUIPreferencesStore(useShallow((state) => [state.complexityMode, state.contentScaling]));
  const zenMode = uiComplexityMode === 'minimal';
  const gifMode = uiComplexityMode === 'extra';

  // Dynamic sidebar title based on current model vendor
  const { domainModelId: activeLLMId } = useModelDomain('primaryChat');
  const activeLLM = useLLM(activeLLMId);
  const sidebarTitle = React.useMemo(() => {
    const vId = activeLLM?.vId;
    if (vId === 'googleai') return 'Gemini';
    if (vId === 'anthropic') return 'Claude';
    if (vId === 'openai') return 'GPT';
    if (vId === 'xai') return 'XAI';
    if (vId === 'deepseek') return 'DeepSeek';
    if (vId === 'groq') return 'Groq';
    if (vId === 'mistral') return 'Mistral';
    return 'AI'; // fallback
  }, [activeLLM?.vId]);

  // Calculate chat counts per folder
  // TODO: restore this, but also check if conversations are active? or move the computation to the renderNavItems hook?
  // const folderChatCounts = React.useMemo(() => {
  //   const counts: Record<string, number> = {};
  //   allFolders.forEach(folder => {
  //     counts[folder.id] = folder.conversationIds.length;
  //   });
  //   return counts;
  // }, [allFolders]);


  // New/Activate/Delete Conversation

  const isMultiPane = props.chatPanesConversationIds.length >= 2;
  const disableNewButton = props.disableNewButton && filteredChatsIncludeActive;
  const newButtonDontRecycle = isMultiPane || !filteredChatsIncludeActive;

  const handleButtonNew = React.useCallback((event: React.MouseEvent) => {
    // FIXME: undocumented: shift+click to force incognito mode
    onConversationNew(newButtonDontRecycle, event.shiftKey);
    if (getIsMobile())
      optimaCloseDrawer();
  }, [newButtonDontRecycle, onConversationNew]);

  const handleConversationActivate = React.useCallback((conversationId: DConversationId, closeMenu: boolean) => {
    onConversationActivate(conversationId);
    if (closeMenu && getIsMobile())
      optimaCloseDrawer();
  }, [onConversationActivate]);

  const handleConversationsDeleteFiltered = React.useCallback(() => {
    !!filteredChatIDs?.length && onConversationsDelete(filteredChatIDs, false);
  }, [filteredChatIDs, onConversationsDelete]);

  const handleConversationDeleteNoConfirmation = React.useCallback((conversationId: DConversationId) => {
    conversationId && onConversationsDelete([conversationId], true);
  }, [onConversationsDelete]);

  const handleConversationsExport = React.useCallback(() => {
    props.activeConversationId && onConversationsExportDialog(props.activeConversationId, true);
  }, [onConversationsExportDialog, props.activeConversationId]);


  // Folder change request

  const handleConversationFolderChange = React.useCallback((folderChangeRequest: FolderChangeRequest) => setFolderChangeRequest(folderChangeRequest), []);

  const handleConversationFolderCancel = React.useCallback(() => setFolderChangeRequest(null), []);

  const handleConversationFolderSet = React.useCallback((conversationId: DConversationId, nextFolderId: string | null) => {
    // Remove conversation from existing folders
    const { addConversationToFolder, folders, removeConversationFromFolder } = useFolderStore.getState();
    folders.forEach(folder => folder.conversationIds.includes(conversationId) && removeConversationFromFolder(folder.id, conversationId));

    // Add conversation to the selected folder
    nextFolderId && addConversationToFolder(nextFolderId, conversationId);

    // Close the menu
    setFolderChangeRequest(null);
  }, []);


  // Render limit - load more items

  const handleRenderLimitIncrease = React.useCallback(() => {
    setRenderLimit(prevValue => {
      // Thresholds: 200 --(+200)--> 400 --(+500)--> 900 --(+1000)--> 1900 --> Infinity --> 200 (cycle)
      if (prevValue === 200)
        return (filteredChatsCount > 400 ? 400 : Infinity); // if less than 400, show all
      else if (prevValue === 400)
        return (filteredChatsCount > 900 ? 900 : Infinity); // if less than 900, show all
      else if (prevValue === 900)
        return (filteredChatsCount > 1900 ? 1900 : Infinity); // if less than 1900, show all
      else if (prevValue === 1900)
        return Infinity; // no limit
      else
        return 200; // go back to optimized view
    });
  }, [filteredChatsCount]);

  // Reset render limit when search query changes
  React.useEffect(() => {
    setRenderLimit(200);
  }, [debouncedSearchQuery]);


  // memoize the group dropdown
  const { isSearching } = isDrawerSearching(debouncedSearchQuery);
  const groupingComponent = React.useMemo(() => (
    <Dropdown>
      <MenuButton
        aria-label='View options'
        slots={{ root: IconButton }}
        slotProps={{ root: { size: 'sm' } }}
      >
        <MoreVertIcon />
      </MenuButton>

      {!isSearching ? (
        // Search/Filter default menu: Grouping, Filtering, ...
        <Menu placement='bottom-start' sx={{ minWidth: 200, zIndex: themeZIndexOverMobileDrawer /* need to be on top of the Modal on Mobile */ }}>
          <ListItem>
            <Typography level='body-sm'>分组方式</Typography>
          </ListItem>
          {(['date', 'persona', 'dimension'] as Exclude<ChatNavGrouping, false>[]).map(_gName => {
            const groupNameMap: Record<string, string> = {
              'date': '日期',
              'persona': '角色',
              'dimension': '维度'
            };
            return (
            <MenuItem
              key={'group-' + _gName}
              aria-label={`Group by ${_gName}`}
              selected={navGrouping === _gName}
              onClick={() => setNavGrouping(grouping => grouping === _gName ? false : _gName)}
            >
              <ListItemDecorator>{navGrouping === _gName && <CheckRoundedIcon />}</ListItemDecorator>
              {groupNameMap[_gName] || capitalizeFirstLetter(_gName)}
            </MenuItem>
            );
          })}

          <ListDivider />
          <ListItem>
            <Typography level='body-sm'>筛选</Typography>
          </ListItem>
          <MenuItem onClick={toggleFilterHasStars}>
            <ListItemDecorator>{filterHasStars && <CheckRoundedIcon />}</ListItemDecorator>
            已加星 <StarOutlineRoundedIcon />
          </MenuItem>
          <MenuItem onClick={toggleFilterIsArchived}>
            <ListItemDecorator>{filterIsArchived && <CheckRoundedIcon />}</ListItemDecorator>
            已归档 <ArchiveOutlinedIcon />
          </MenuItem>
          <MenuItem onClick={toggleFilterHasImageAssets}>
            <ListItemDecorator>{filterHasImageAssets && <CheckRoundedIcon />}</ListItemDecorator>
            包含图片 <FormatPaintOutlinedIcon />
          </MenuItem>
          <MenuItem onClick={toggleFilterHasDocFragments}>
            <ListItemDecorator>{filterHasDocFragments && <CheckRoundedIcon />}</ListItemDecorator>
            包含附件 <AttachFileRoundedIcon />
          </MenuItem>

          <ListDivider />
          <ListItem>
            <Typography level='body-sm'>显示</Typography>
          </ListItem>
          <MenuItem onClick={toggleShowPersonaIcons}>
            <ListItemDecorator>{showPersonaIcons && <CheckRoundedIcon />}</ListItemDecorator>
            图标
          </MenuItem>
          <MenuItem onClick={toggleShowRelativeSize}>
            <ListItemDecorator>{showRelativeSize && <CheckRoundedIcon />}</ListItemDecorator>
            相对大小
          </MenuItem>
        </Menu>
      ) : (
        // While searching, show the sorting and depth options
        <Menu placement='bottom-start' sx={{ minWidth: 180, zIndex: themeZIndexOverMobileDrawer /* need to be on top of the Modal on Mobile */ }}>
          <ListItem>
            <Typography level='body-sm'>排序方式</Typography>
          </ListItem>
          <MenuItem selected={searchSorting === 'frequency'} onClick={() => setSearchSorting('frequency')}>
            <ListItemDecorator>{searchSorting === 'frequency' && <CheckRoundedIcon />}</ListItemDecorator>
            匹配度
          </MenuItem>
          <MenuItem selected={searchSorting === 'date'} onClick={() => setSearchSorting('date')}>
            <ListItemDecorator>{searchSorting === 'date' && <CheckRoundedIcon />}</ListItemDecorator>
            日期
          </MenuItem>
          <ListDivider />
          <ListItem>
            <Typography level='body-sm'>搜索范围</Typography>
          </ListItem>
          <MenuItem selected={searchDepth === 'titles'} onClick={() => setSearchDepth('titles')}>
            <ListItemDecorator>{searchDepth === 'titles' && <CheckRoundedIcon />}</ListItemDecorator>
            标题
          </MenuItem>
          <MenuItem selected={searchDepth === 'content'} onClick={() => setSearchDepth('content')}>
            <ListItemDecorator>{searchDepth === 'content' && <CheckRoundedIcon />}</ListItemDecorator>
            标题 + 内容
          </MenuItem>
          <MenuItem selected={searchDepth === 'attachments'} onClick={() => setSearchDepth('attachments')}>
            <ListItemDecorator>{searchDepth === 'attachments' && <CheckRoundedIcon />}</ListItemDecorator>
            全部
          </MenuItem>
        </Menu>
      )}
    </Dropdown>
  ), [
    filterHasDocFragments, filterHasImageAssets, filterHasStars, isSearching, navGrouping, searchSorting, searchDepth, filterIsArchived, showPersonaIcons, showRelativeSize,
    toggleFilterHasDocFragments, toggleFilterHasImageAssets, toggleFilterHasStars, toggleFilterIsArchived, toggleShowPersonaIcons, toggleShowRelativeSize,
  ]);


  return <>

    {/* Drawer Header */}
    <OptimaDrawerHeader title="" onClose={optimaCloseDrawer}>
      <IconButton 
        onClick={optimaCloseDrawer}
        sx={{ display: { xs: 'flex', md: 'none' }, mr: 1, borderRadius: '50%' }}
      >
        <ArrowBackRoundedIcon />
      </IconButton>
      <Box 
        onClick={handleButtonNew}
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer', 
          flexGrow: 1,
          '&:hover': { opacity: 0.8 },
        }}
      >
        {(() => {
          let logoSrc = '/logo/openai-icon.svg'; // fallback
          const vId = activeLLM?.vId;
          if (vId === 'googleai') logoSrc = '/logo/google-gemini-icon.svg';
          else if (vId === 'anthropic') logoSrc = '/logo/claude-ai-icon.svg';
          else if (vId === 'xai') logoSrc = '/logo/grok-icon.svg';
          else if (vId === 'openai') logoSrc = '/logo/openai-icon.svg';
          
          return <Box 
            component="img" 
            src={logoSrc} 
            alt="Model Logo"
            draggable={false}
            sx={{ 
              width: 24, 
              height: 24, 
              borderRadius: '4px', 
              filter: (mode === 'dark' && (vId === 'openai' || vId === 'xai')) ? 'invert(1) brightness(1.5)' : undefined,
              userSelect: 'none',
              pointerEvents: 'none',
            }} 
          />;
        })()}
        <Typography className="stationary-icon" sx={{ 
          fontFamily: themeSerifFontFamilyCss, 
          fontSize: '1.25rem', 
          fontWeight: 600,
          flexGrow: 1,
          ml: 1,
          visibility: isDrawerOpen ? 'visible' : 'hidden',
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          {activeLLM?.vId === 'xai' ? 'Grok' : sidebarTitle}
        </Typography>
      </Box>
      {/* 文件夹功能已被用户要求隐藏
      <Tooltip title={enableFolders ? '隐藏文件夹' : '使用文件夹'}>
        <IconButton size='sm' onClick={toggleEnableFolders}>
          {enableFolders ? <FoldersToggleOn /> : <FoldersToggleOff />}
        </IconButton>
      </Tooltip> */}
      {/* Redundant close button removed to match Claude.ai where the main toggle is on top */}
    </OptimaDrawerHeader>

    {/* Folders List (shrink at twice the rate as the Titles) */}
    {/*<Box sx={{*/}
    {/*  display: 'grid',*/}
    {/*  gridTemplateRows: !enableFolders ? '0fr' : '1fr',*/}
    {/*  transition: 'grid-template-rows 0.42s cubic-bezier(.17,.84,.44,1)',*/}
    {/*  '& > div': {*/}
    {/*    padding: enableFolders ? 2 : 0,*/}
    {/*    transition: 'padding 0.42s cubic-bezier(.17,.84,.44,1)',*/}
    {/*    overflow: 'hidden',*/}
    {/*  },*/}
    {/*}}>*/}
    {/* Removed ChatFolderList for better alignment with collapsed state */}
    {/*</Box>*/}

    {/* Chats List */}
    <Box sx={{
      flexGrow: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'background.surface',
      borderRight: '1px solid',
      borderColor: 'divider',
      overflow: 'hidden',
    }}>
      <OptimaDrawerList variant='plain' noTopPadding noBottomPadding tallRows>

        {enableFolders && <ListDivider sx={{ mb: 0 }} />}

        {/* Navigation Items (Claude Style) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1, px: 0, gap: 0.5 }}>
          
          <ListItemButton onClick={handleButtonNew} sx={{ borderRadius: '0.5rem', py: 1, px: 0, mx: 1 }}>
            <ListItemDecorator className="stationary-icon" sx={{ minWidth: '8px', justifyContent: 'center', ml: '4px', visibility: 'hidden' }}>
              <AddIcon />
            </ListItemDecorator>
            <Typography level="body-sm" sx={{ fontWeight: 500, userSelect: 'none' }}>新对话</Typography>
          </ListItemButton>

          <ListItemButton onClick={() => Router.push('/history')} sx={{ borderRadius: '0.5rem', py: 0.75, px: 0, mx: 1, bgcolor: Router.pathname === '/history' ? 'background.level1' : 'transparent' }}>
            <ListItemDecorator className="stationary-icon" sx={{ minWidth: '8px', justifyContent: 'center', ml: '4px', visibility: 'hidden' }}>
              <EventNoteOutlinedIcon sx={{ fontSize: '1.2rem' }} />
            </ListItemDecorator>
            <Typography level="body-sm" sx={{ userSelect: 'none' }}>历史记录</Typography>
          </ListItemButton>

             <ListItemButton 
                onClick={() => Router.push('/banana')}
                sx={{ borderRadius: '0.5rem', py: 0.75, px: 0, mx: 1, bgcolor: Router.pathname === '/banana' ? 'background.level1' : 'transparent' }}
             >
                <ListItemDecorator className="stationary-icon" sx={{ minWidth: '8px', justifyContent: 'center', ml: '4px', visibility: 'hidden' }}>
                  <ImageOutlinedIcon sx={{ fontSize: '1.2rem' }} />
                </ListItemDecorator>
                <Typography level="body-sm" sx={{ userSelect: 'none' }}>图像生成</Typography>
             </ListItemButton>

          <Typography level="body-xs" sx={{ mt: 2, mb: 0.5, px: 0, ml: '12px', color: 'text.tertiary', fontWeight: 600, userSelect: 'none' }}>
            最近对话
          </Typography>
        </Box>

        {/* Chat Titles List (shrink as half the rate as the Folders List) */}
        <Box sx={{ flexGrow: 1, flexShrink: 1, flexBasis: '20rem', overflowY: 'auto', ...themeScalingMap[contentScaling].chatDrawerItemSx }}>
          {renderNavItems.slice(0, renderLimit).map((item, idx) => item.type === 'nav-item-chat-data' ? (
              <ChatDrawerItemMemo
                key={'nav-chat-' + item.conversationId}
                item={item}
                showSymbols={!showPersonaIcons ? false : zenMode ? false : gifMode ? 'gif' : true}
                bottomBarBasis={filteredChatsBarBasis}
                onConversationActivate={handleConversationActivate}
                onConversationBranch={onConversationBranch}
                onConversationDeleteNoConfirmation={handleConversationDeleteNoConfirmation}
                onConversationExport={onConversationsExportDialog}
                onConversationFolderChange={handleConversationFolderChange}
              />
            ) : item.type === 'nav-item-group' ? (
              <Typography key={'nav-divider-' + idx} level='body-xs' sx={{
                textAlign: 'center',
                my: 1,
                // my: 'calc(var(--ListItem-minHeight) / 4)',
                // keeps the group header sticky to the top
                position: 'sticky',
                top: 0,
                backgroundColor: OPTIMA_DRAWER_BACKGROUND,
                zIndex: 1,
                userSelect: 'none',
              }}>
                {item.title}
              </Typography>
            ) : item.type === 'nav-item-info-message' ? (
              <Box key={'nav-info-' + idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, ml: 2 }}>
                <Typography level='body-xs' sx={{ color: 'primary.softColor', my: 'calc(var(--ListItem-minHeight) / 4)' }}>
                  {filterHasStars && <StarOutlineRoundedIcon sx={{ color: 'primary.softColor', fontSize: 'xl', mb: -0.5, mr: 1 }} />}
                  {item.message}
                </Typography>
                {(filterHasStars || filterHasImageAssets || filterHasDocFragments || filterIsArchived) && (
                  <Tooltip title='清除筛选'>
                    <IconButton size='sm' color='primary' onClick={clearFilters}>
                      <ClearIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ) : null,
          )}
        </Box>

        {/* Load More Button */}
        {filteredChatsCount > 200 && (
          <ListItem>
            <ListItemButton
              variant='soft'
              onClick={handleRenderLimitIncrease}
              sx={{ justifyContent: 'center', py: 3 }}
            >
              {renderLimit === Infinity
                ? '显示更少'
                : (renderLimit === 200 && filteredChatsCount > 400)
                  ? '再显示 200 条'
                  : (renderLimit === 400 && filteredChatsCount > 900)
                    ? '再显示 500 条'
                    : (renderLimit === 900 && filteredChatsCount > 1900)
                      ? '再显示 1000 条'
                      : '显示全部'
              } {renderLimit !== Infinity && `(已隐藏 ${filteredChatsCount - renderLimit} 条)`}
            </ListItemButton>
          </ListItem>
        )}
      </OptimaDrawerList>

      {/* Settings Button at the bottom (Claude style replacement for user profile) */}
      <Box sx={{ 
        mt: 'auto', 
        p: 1,
        pb: '12px', // Match DesktopNav bottom spacing
        borderTop: '1px solid',
        borderColor: 'divider',
      }}>
        <ListItemButton 
          onClick={() => optimaOpenPreferences()}
          sx={{ borderRadius: '0.5rem', py: 1, px: 0, mx: 1 }}
        >
          <ListItemDecorator className="stationary-icon" sx={{ minWidth: '8px', justifyContent: 'center', ml: '4px', visibility: 'hidden' }}>
            <ClaudeSettingsIcon />
          </ListItemDecorator>
          <Typography level="body-sm" sx={{ fontWeight: 500, userSelect: 'none' }}>设置</Typography>
        </ListItemButton>
      </Box>
    </Box>


    {/* [Menu] Chat Item Folder Change */}
    {!!folderChangeRequest?.anchorEl && (
      <CloseablePopup
        menu anchorEl={folderChangeRequest.anchorEl} onClose={handleConversationFolderCancel}
        bigIcons
        minWidth={200}
        placement='bottom-start'
        zIndex={themeZIndexOverMobileDrawer /* need to be on top of the Modal on Mobile */}
      >

        {/* Folder Assignment Buttons */}
        {allFolders.map(folder => {
          const isRequestFolder = folder === folderChangeRequest.currentFolder;
          return (
            <ListItem
              key={folder.id}
              variant={isRequestFolder ? 'soft' : 'plain'}
              onClick={() => handleConversationFolderSet(folderChangeRequest.conversationId, folder.id)}
            >
              <ListItemButton>
                <ListItemDecorator>
                  <FolderIcon sx={{ color: folder.color }} />
                </ListItemDecorator>
                {folder.title}
              </ListItemButton>
            </ListItem>
          );
        })}

        {/* Remove Folder Assignment */}
        {!!folderChangeRequest.currentFolder && (
          <ListItem onClick={() => handleConversationFolderSet(folderChangeRequest.conversationId, null)}>
            <ListItemButton>
              <ListItemDecorator>
                <ClearIcon />
              </ListItemDecorator>
              {ClearFolderText}
            </ListItemButton>
          </ListItem>
        )}

      </CloseablePopup>
    )}

  </>;
}