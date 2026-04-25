import * as React from 'react';

import { Avatar, Box, IconButton, ListItem, ListItemButton, ListItemDecorator, Sheet, styled, Tooltip, Typography, Dropdown, Menu, MenuButton, MenuItem, ListDivider, Checkbox } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CopyAllIcon from '@mui/icons-material/CopyAll';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import { autoConversationTitle } from '~/modules/aifn/autotitle/autoTitle';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DFolder } from '~/common/stores/folders/store-chat-folders';
import { ANIM_BUSY_TYPING } from '~/common/util/dMessageUtils';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { isDeepEqual } from '~/common/util/hooks/useDeep';
import { useChatStore } from '~/common/stores/chat/store-chats';

import { CHAT_NOVEL_TITLE } from '../../AppChat';


// set to true to display the conversation IDs
// const DEBUG_CONVERSATION_IDS = false;


export const FadeInButton = styled(IconButton)({
  opacity: 0.5,
  transition: 'opacity 0.16s',
  '&:hover': { opacity: 1 },
});


export const ChatDrawerItemMemo = React.memo(ChatDrawerItem, (prev, next) =>
  // usign a custom function because `ChatNavigationItemData` is a complex object and memo won't work
  isDeepEqual(prev.item, next.item) &&
  prev.showSymbols === next.showSymbols &&
  prev.bottomBarBasis === next.bottomBarBasis &&
  prev.onConversationActivate === next.onConversationActivate &&
  prev.onConversationBranch === next.onConversationBranch &&
  prev.onConversationDeleteNoConfirmation === next.onConversationDeleteNoConfirmation &&
  prev.onConversationExport === next.onConversationExport &&
  prev.onConversationFolderChange === next.onConversationFolderChange &&
  prev.checkboxMode === next.checkboxMode &&
  prev.isChecked === next.isChecked &&
  prev.onToggleCheck === next.onToggleCheck,
);

export interface ChatNavigationItemData {
  type: 'nav-item-chat-data',
  conversationId: DConversationId;
  isActive: boolean;
  isAlsoOpen: string | false;
  isEmpty: boolean;
  isIncognito: boolean;
  title: string;
  isArchived: boolean;
  userSymbol: string | undefined;
  userFlagsSummary: string | undefined;
  lastMessageSummary?: string;
  containsDocAttachments: boolean;
  containsImageAssets: boolean;
  folder: DFolder | null | undefined; // null: 'All', undefined: do not show folder select
  updatedAt: number;
  hasBeamOpen: boolean;
  messageCount: number;
  beingGenerated: boolean;
  systemPurposeId: SystemPurposeId;
  searchFrequency: number;
}

export interface FolderChangeRequest {
  conversationId: DConversationId;
  anchorEl: HTMLButtonElement;
  currentFolder: DFolder | null;
}

function ChatDrawerItem(props: {
  // NOTE: always update the Memo comparison if you add or remove props
  item: ChatNavigationItemData,
  showSymbols: boolean | 'gif',
  bottomBarBasis: number,
  onConversationActivate: (conversationId: DConversationId, closeMenu: boolean) => void,
  onConversationBranch: (conversationId: DConversationId, messageId: string | null, addSplitPane: boolean) => void,
  onConversationDeleteNoConfirmation: (conversationId: DConversationId) => void,
  onConversationExport: (conversationId: DConversationId, exportAll: boolean) => void,
  onConversationFolderChange: (folderChangeRequest: FolderChangeRequest) => void,
  checkboxMode?: boolean,
  isChecked?: boolean,
  onToggleCheck?: () => void,
}) {

  // state
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [isAutoEditingTitle, setIsAutoEditingTitle] = React.useState(false);
  const [deleteArmed, setDeleteArmed] = React.useState(false);

  // derived state
  const { onConversationBranch, onConversationExport, onConversationFolderChange } = props;
  const {
    conversationId,
    isActive,
    isAlsoOpen,
    isIncognito,
    title,
    userSymbol,
    userFlagsSummary,
    lastMessageSummary,
    containsDocAttachments,
    containsImageAssets,
    folder,
    hasBeamOpen,
    messageCount,
    beingGenerated,
    systemPurposeId,
    searchFrequency,
  } = props.item;
  const isNew = messageCount === 0;


  // [effect] auto-disarm when inactive
  const shallClose = deleteArmed && !isActive;
  React.useEffect(() => {
    if (shallClose)
      setDeleteArmed(false);
  }, [shallClose]);


  // Activate

  const handleConversationActivate = () => props.onConversationActivate(conversationId, true);


  // branch

  const handleConversationBranch = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    conversationId && onConversationBranch(conversationId, null, false /* no pane from Drawer duplicate */);
  }, [conversationId, onConversationBranch]);


  // export

  const handleConversationExport = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    conversationId && onConversationExport(conversationId, false);
  }, [conversationId, onConversationExport]);


  // Folder change

  const handleFolderChangeBegin = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onConversationFolderChange({
      conversationId,
      anchorEl: event.currentTarget,
      currentFolder: folder ?? null,
    });
  }, [conversationId, folder, onConversationFolderChange]);


  // Title Edit

  const handleTitleEditBegin = React.useCallback(() => setIsEditingTitle(true), []);

  const handleTitleEditCancel = React.useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  const handleTitleEditChange = React.useCallback((text: string) => {
    setIsEditingTitle(false);
    useChatStore.getState().setUserTitle(conversationId, text.trim());
  }, [conversationId]);

  const handleTitleEditAuto = React.useCallback(async () => {
    setIsAutoEditingTitle(true);
    await autoConversationTitle(conversationId, true);
    setIsAutoEditingTitle(false);
  }, [conversationId]);


  // Delete

  const { onConversationDeleteNoConfirmation } = props;
  const handleDeleteButtonShow = React.useCallback((event: React.MouseEvent) => {
    // special case: if 'Shift' is pressed, delete immediately
    if (event.shiftKey) { // immediately delete:conversation
      event.stopPropagation();
      onConversationDeleteNoConfirmation(conversationId);
      return;
    }
    setDeleteArmed(true);
  }, [conversationId, onConversationDeleteNoConfirmation]);

  const handleDeleteButtonHide = React.useCallback(() => setDeleteArmed(false), []);

  const handleConversationDelete = React.useCallback((event: React.MouseEvent) => {
    if (deleteArmed) {
      setDeleteArmed(false);
      event.stopPropagation();
      onConversationDeleteNoConfirmation(conversationId);
    }
  }, [conversationId, deleteArmed, onConversationDeleteNoConfirmation]);


  const personaSymbol = userSymbol || SystemPurposes[systemPurposeId]?.symbol || '❓';
  const personaImageURI = SystemPurposes[systemPurposeId]?.imageUri ?? undefined;


  const progress = props.bottomBarBasis ? 100 * (searchFrequency || messageCount) / props.bottomBarBasis : 0;

  const titleRowComponent = React.useMemo(() => <>

    {/* Symbol hidden for Claude Style Recents, unless being generated */}
    {beingGenerated && (
      <ListItemDecorator sx={{ minInlineSize: '2rem' }}>
          <Avatar
            alt='chat activity'
            variant='plain'
            src={ANIM_BUSY_TYPING}
            sx={{
              width: '1.25rem',
              height: '1.25rem',
            }}
          />
      </ListItemDecorator>
    )}

    {/* Title */}
    {!isEditingTitle ? (
      // using Box to not reset the parent font scaling
      <Box
        onDoubleClick={handleTitleEditBegin}
        sx={{
          color: isActive ? 'text.primary' : 'text.secondary',
          overflowWrap: 'anywhere',
          userSelect: 'none',
          flex: 1,
        }}
      >
        {/*{DEBUG_CONVERSATION_IDS && `${conversationId} - `}*/}
        {title.trim() ? title : CHAT_NOVEL_TITLE}{beingGenerated && ' ...'}
      </Box>
    ) : (
      <InlineTextarea
        invertedColors
        initialText={title}
        onEdit={handleTitleEditChange}
        onCancel={handleTitleEditCancel}
        sx={{
          flexGrow: 1,
          ml: -1.5, mr: -0.5,
        }}
      />
    )}

    {/* Right text */}
    {searchFrequency > 0 ? (
      // Display search frequency if it exists and is greater than 0
      <Typography level='body-sm'>
        {searchFrequency}
      </Typography>
    ) : (props.showSymbols && (userFlagsSummary || containsDocAttachments || containsImageAssets)) ? (
      <Box sx={{
        fontSize: 'xs',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 120, // constrain the width so title doesn't disappear
      }}>
        {userFlagsSummary || <Typography level="body-xs" sx={{ color: 'text.tertiary', display: 'inline' }}>{lastMessageSummary}</Typography>}
        {containsDocAttachments && '📄'}
        {containsImageAssets && '🖍️'}
      </Box>
    ) : null}

  </>, [beingGenerated, containsDocAttachments, containsImageAssets, handleTitleEditBegin, handleTitleEditCancel, handleTitleEditChange, isActive, isEditingTitle, props.showSymbols, searchFrequency, title, userFlagsSummary, lastMessageSummary]);

  const progressBarFixedComponent = React.useMemo(() =>
    progress > 0 && (
      <Box sx={{
        backgroundColor: 'neutral.softHoverBg',
        position: 'absolute', left: 0, bottom: 0, width: progress + '%', height: 4,
      }} />
    ), [progress]);

  return (isActive || isAlsoOpen) ? (

    // Active or Also Open
    <Sheet
      variant="plain"
      onClick={!isActive ? handleConversationActivate : undefined}
      sx={{
        '--ListItem-minHeight': '2.25rem',
        fontSize: '0.875rem',
        backgroundColor: isActive ? 'background.level2' : 'transparent',
        borderRadius: '0.5rem',
        mx: '0.5rem',
        mb: '2px',
        '&:hover': {
           backgroundColor: isActive ? 'background.level2' : 'background.level1',
        },
        '&:hover .chat-item-actions': {
          opacity: 1,
          width: 'auto',
        },
        ...(isIncognito && {
          opacity: 0.8,
        }),
      }}
    >

      <ListItem sx={{ border: 'none', display: 'grid', gap: 0, px: 0, py: 0.5 }}>

        {/* Title row */}
        <Box sx={{ display: 'flex', gap: 'var(--ListItem-gap)', minHeight: '2.5rem', alignItems: 'center', ml: '12px' }}>
          {props.checkboxMode && (
            <Checkbox
              checked={props.isChecked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); props.onToggleCheck?.(); }}
              sx={{ mr: 1 }}
            />
          )}
          {titleRowComponent}
        </Box>

        <Box className="chat-item-actions" sx={{ 
          display: 'flex', 
          gap: 0.25, 
          height: '1.75rem',
          overflow: 'hidden',
          alignItems: 'center',
          transition: 'opacity 0.15s ease',
          opacity: isActive ? 1 : 0,
          width: isActive ? 'auto' : 0,
        }}>
          {(!isEditingTitle) && (
            <Dropdown>
              <MenuButton
                slots={{ root: IconButton }}
                slotProps={{ root: { size: 'sm', variant: 'plain', color: 'neutral' } }}
                onClick={(e) => { e.stopPropagation(); }}
              >
                <MoreVertIcon sx={{ fontSize: '1.1rem' }} />
              </MenuButton>
              <Menu size='sm' placement='bottom-end' sx={{ zIndex: 10000, minWidth: '160px' }}>
                <MenuItem onClick={(e) => { e.stopPropagation(); handleTitleEditBegin(); }}>
                  <ListItemDecorator><EditRoundedIcon /></ListItemDecorator> 重命名
                </MenuItem>
                {!isNew && (
                  <MenuItem onClick={(e) => { e.stopPropagation(); handleTitleEditAuto(); }}>
                    <ListItemDecorator><AutoFixHighIcon /></ListItemDecorator> 自动生成标题
                  </MenuItem>
                )}
                {!isNew && (
                  <MenuItem onClick={(e) => { e.stopPropagation(); onConversationBranch(conversationId, null, false); }}>
                    <ListItemDecorator><CopyAllIcon /></ListItemDecorator> 创建副本
                  </MenuItem>
                )}
                <MenuItem onClick={(e) => { e.stopPropagation(); onConversationExport(conversationId, false); }}>
                  <ListItemDecorator><FileDownloadOutlinedIcon /></ListItemDecorator> 导出
                </MenuItem>
                <ListDivider />
                <MenuItem variant="soft" color="danger" onClick={(e) => { e.stopPropagation(); props.onConversationDeleteNoConfirmation(conversationId); }}>
                  <ListItemDecorator><DeleteOutlineIcon color="error" /></ListItemDecorator> 删除
                </MenuItem>
              </Menu>
            </Dropdown>
          )}
        </Box>

        {/* View places row */}
        {isAlsoOpen && (
          <Typography level='body-xs' sx={{ mx: 'auto' }}>
            <em>In view {isAlsoOpen}</em>
          </Typography>
        )}

      </ListItem>

      {/* Optional progress bar, underlay */}
      {/* NOTE: disabled on 20240204: quite distracting on the active chat sheet */}
      {/*{progressBarFixedComponent}*/}

    </Sheet>

  ) : (

    // Inactive Conversation - click to activate
    <ListItem sx={{ px: 0 }}>
      <ListItemButton
        onClick={handleConversationActivate}
        sx={{
          '--ListItem-minHeight': '2.25rem',
          fontSize: '0.875rem',
          borderRadius: '0.5rem',
          mx: '0.5rem',
          mb: '2px',
          px: 0,
          '&:hover .chat-item-actions': {
            opacity: 1,
            width: 'auto',
          },
          ...(isIncognito && {
            opacity: 0.8,
          }),
        }}
      >
        <Box sx={{ display: 'flex', gap: 'var(--ListItem-gap)', minHeight: '2.5rem', alignItems: 'center', ml: '12px' }}>
          {props.checkboxMode && (
            <Checkbox
              checked={props.isChecked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); props.onToggleCheck?.(); }}
              sx={{ mr: 1 }}
            />
          )}
          {titleRowComponent}
        </Box>

        <Box className="chat-item-actions" sx={{ 
          display: 'flex', 
          gap: 0.25, 
          height: '1.75rem',
          overflow: 'hidden',
          alignItems: 'center',
          transition: 'opacity 0.15s ease',
          opacity: 0,
          width: 0,
        }}>
          {(!isEditingTitle) && (
            <Dropdown>
              <MenuButton
                slots={{ root: IconButton }}
                slotProps={{ root: { size: 'sm', variant: 'plain', color: 'neutral' } }}
                onClick={(e) => { e.stopPropagation(); }}
              >
                <MoreVertIcon sx={{ fontSize: '1.1rem' }} />
              </MenuButton>
              <Menu size='sm' placement='bottom-end' sx={{ zIndex: 10000, minWidth: '160px' }}>
                <MenuItem onClick={(e) => { e.stopPropagation(); handleTitleEditBegin(); }}>
                  <ListItemDecorator><EditRoundedIcon /></ListItemDecorator> 重命名
                </MenuItem>
                {!isNew && (
                  <MenuItem onClick={(e) => { e.stopPropagation(); handleTitleEditAuto(); }}>
                    <ListItemDecorator><AutoFixHighIcon /></ListItemDecorator> 自动生成标题
                  </MenuItem>
                )}
                {!isNew && (
                  <MenuItem onClick={(e) => { e.stopPropagation(); onConversationBranch(conversationId, null, false); }}>
                    <ListItemDecorator><CopyAllIcon /></ListItemDecorator> 创建副本
                  </MenuItem>
                )}
                <MenuItem onClick={(e) => { e.stopPropagation(); onConversationExport(conversationId, false); }}>
                  <ListItemDecorator><FileDownloadOutlinedIcon /></ListItemDecorator> 导出
                </MenuItem>
                <ListDivider />
                <MenuItem variant="soft" color="danger" onClick={(e) => { e.stopPropagation(); props.onConversationDeleteNoConfirmation(conversationId); }}>
                  <ListItemDecorator><DeleteOutlineIcon color="error" /></ListItemDecorator> 删除
                </MenuItem>
              </Menu>
            </Dropdown>
          )}
        </Box>
      </ListItemButton>
    </ListItem>
  );
}
