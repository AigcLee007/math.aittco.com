import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ButtonGroup, CircularProgress, Divider, IconButton, ListDivider, ListItem, ListItemDecorator, MenuItem, Switch, Tooltip, Typography } from '@mui/joy';
import { ClickAwayListener, Popper } from '@mui/base';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DifferenceIcon from '@mui/icons-material/Difference';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyAllRoundedIcon from '@mui/icons-material/ReplyAllRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import TelegramIcon from '@mui/icons-material/Telegram';
import TextureIcon from '@mui/icons-material/Texture';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { ModelVendorAnthropic } from '~/modules/llms/vendors/anthropic/anthropic.vendor';

import { AnthropicIcon } from '~/common/components/icons/vendors/AnthropicIcon';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { DMessage, DMessageId, DMessageUserFlag, DMetaReferenceItem, MESSAGE_FLAG_AIX_SKIP, MESSAGE_FLAG_NOTIFY_COMPLETE, MESSAGE_FLAG_STARRED, MESSAGE_FLAG_VND_ANT_CACHE_AUTO, MESSAGE_FLAG_VND_ANT_CACHE_USER, messageFragmentsReduceText, messageHasUserFlag } from '~/common/stores/chat/chat.message';
import { KeyStroke } from '~/common/components/KeyStroke';
import { MarkHighlightIcon } from '~/common/components/icons/MarkHighlightIcon';
import { Release } from '~/common/app.release';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { adjustContentScaling, themeScalingMap, themeZIndexChatBubble } from '~/common/app.theme';
import { avatarIconSx, makeMessageAvatarIcon, messageBackground, useMessageAvatarLabel } from '~/common/util/dMessageUtils';
import { clipboardCopyDOMSelectionOrFallback } from '~/common/util/clipboardUtils';
import { createTextContentFragment, DMessageFragment, DMessageFragmentId, updateFragmentWithEditedText } from '~/common/stores/chat/chat.fragments';
import { useFragmentBuckets } from '~/common/stores/chat/hooks/useFragmentBuckets';
import { useUIPreferencesStore } from '~/common/stores/store-ui';
import { useUXLabsStore } from '~/common/stores/store-ux-labs';

import { BlockOpContinue } from './BlockOpContinue';
import { BlockOpOptions, optionsExtractFromFragments_dangerModifyFragment } from './BlockOpOptions';
import { BlockOpUpstreamResume } from './BlockOpUpstreamResume';
import { ContentFragments } from './fragments-content/ContentFragments';
import { DocumentAttachmentFragments } from './fragments-attachment-doc/DocumentAttachmentFragments';
import { ImageAttachmentFragments } from './fragments-attachment-image/ImageAttachmentFragments';
import { InReferenceToList } from './in-reference-to/InReferenceToList';
import { VoidFragments } from './fragments-void/VoidFragments';
import { messageAsideColumnSx, messageAvatarLabelAnimatedSx, messageAvatarLabelSx, messageZenAsideColumnSx } from './ChatMessage.styles';
import { setIsNotificationEnabledForModel, useChatShowTextDiff } from '../../store-app-chat';
import { useSelHighlighterMemo } from './useSelHighlighterMemo';


// Enable the menu on text selection
const ENABLE_CONTEXT_MENU = false;
const ENABLE_BUBBLE = true;
export const BUBBLE_MIN_TEXT_LENGTH = 3;

// Enable the hover button to copy the whole message. The Copy button is also available in Blocks, or in the Avatar Menu.
// const ENABLE_COPY_MESSAGE_OVERLAY: boolean = false;


const messageBodySx: SxProps = {
  display: 'flex',
  alignItems: 'flex-start', // avatars at the top, and honor 'static' position
  gap: { xs: 0, md: 1 },
};

const messageBodyReverseSx: SxProps = {
  ...messageBodySx,
  flexDirection: 'row-reverse',
};

export const messageSkippedSx = {
  // show a nice ghostly border (dashed?)
  border: '1px dashed',
  borderColor: 'neutral.solidBg',
  // make it look good
  filter: 'grayscale(1)',
} as const;

const personaAvatarOrMenuSx: SxProps = {
  display: 'flex',
};

const editButtonWrapSx: SxProps = {
  overflowWrap: 'anywhere',
  mb: -0.5, // this is so that the 'edit/cancel' labels won't push down the edit box when single lined
};

const fragmentsListSx: SxProps = {
  // style
  flexGrow: 1,  // capture all the space, for edit modes
  minWidth: 0,  // VERY important, otherwise very wide messages will overflow the container, causing scroll on the whole page
  my: 'auto',   // v-center content if there's any gap (e.g. single line of text)

  // layout
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,     // we give a bit more space between the 'classes' of fragments (in-reply-to, images, content, attachments, etc.)
};

const antCachePromptOffSx: SxProps = {
  transition: 'color 0.16s, transform 0.16s',
};

const antCachePromptOnSx: SxProps = {
  ...antCachePromptOffSx,
  color: ModelVendorAnthropic.brandColor,
  transform: 'rotate(90deg)',
};


export interface ChatMessageFunctionsHandle {
  beginEditTextContent: () => void;
}

export type ChatMessageTextPartEditState = { [fragmentId: DMessageFragmentId]: string };

export const ChatMessageMemo = React.memo(ChatMessage);

/**
 * The Message component is a customizable chat message UI component that supports
 * different roles (user, assistant, and system), text editing, syntax highlighting,
 * and code execution using Sandpack for TypeScript, JavaScript, and HTML code blocks.
 * The component also provides options for copying code to clipboard and expanding
 * or collapsing long user messages.
 *
 */
export function ChatMessage(props: {
  actionsRef?: React.Ref<ChatMessageFunctionsHandle>,
  message: DMessage,
  diffPreviousText?: string,
  fitScreen: boolean,
  hasInReferenceTo?: boolean;
  isMobile: boolean,
  isBottom?: boolean,
  isImagining?: boolean,
  hideAvatar?: boolean,
  showAntPromptCaching?: boolean,
  showBlocksDate?: boolean,
  showUnsafeHtmlCode?: boolean,
  adjustContentScaling?: number,
  topDecorator?: React.ReactNode,
  onAddInReferenceTo?: (item: DMetaReferenceItem) => void,
  onMessageAssistantFrom?: (messageId: string, offset: number) => Promise<void>,
  onMessageBeam?: (messageId: string) => Promise<void>,
  onMessageBranch?: (messageId: string) => void,
  onMessageContinue?: (messageId: string, continueText: null | string) => void,
  onMessageDelete?: (messageId: string) => void,
  onMessageFragmentAppend?: (messageId: DMessageId, fragment: DMessageFragment) => void
  onMessageFragmentDelete?: (messageId: DMessageId, fragmentId: DMessageFragmentId) => void,
  onMessageFragmentReplace?: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void,
  onMessageToggleUserFlag?: (messageId: string, flag: DMessageUserFlag, maxPerConversation?: number) => void,
  onMessageTruncate?: (messageId: string) => void,
  onTextDiagram?: (messageId: string, text: string) => void,
  onTextImagine?: (text: string) => Promise<void>,
  sx?: SxProps,
}) {

  // state
  const blocksRendererRef = React.useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = React.useState(false);
  const [selText, setSelText] = React.useState<string | null>(null);
  const [bubbleAnchor, setBubbleAnchor] = React.useState<HTMLElement | null>(null);
  const [contextMenuAnchor, setContextMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [opsMenuAnchor, setOpsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [textContentEditState, setTextContentEditState] = React.useState<ChatMessageTextPartEditState | null>(null);

  // external state
  const { adjContentScaling, disableMarkdown, doubleClickToEdit, uiComplexityMode } = useUIPreferencesStore(useShallow(state => ({
    adjContentScaling: adjustContentScaling(state.contentScaling, props.adjustContentScaling),
    disableMarkdown: state.disableMarkdown,
    doubleClickToEdit: state.doubleClickToEdit,
    uiComplexityMode: state.complexityMode,
  })));
  const labsEnhanceCodeBlocks = useUXLabsStore(state => state.labsEnhanceCodeBlocks);
  const [showDiff, setShowDiff] = useChatShowTextDiff();


  // derived state
  const {
    id: messageId,
    role: messageRole,
    fragments: messageFragments,
    pendingIncomplete: messagePendingIncomplete,
    purposeId: messagePurposeId,
    generator: messageGenerator,
    metadata: messageMetadata,
    created: messageCreated,
    updated: messageUpdated,
  } = props.message;

  const fromAssistant = messageRole === 'assistant';
  const fromSystem = messageRole === 'system';
  const fromUser = messageRole === 'user';
  const messageHasBeenEdited = !!messageUpdated;

  const isUserMessageSkipped = messageHasUserFlag(props.message, MESSAGE_FLAG_AIX_SKIP);
  const isUserStarred = messageHasUserFlag(props.message, MESSAGE_FLAG_STARRED);
  const isUserNotifyComplete = messageHasUserFlag(props.message, MESSAGE_FLAG_NOTIFY_COMPLETE);
  const isVndAndCacheAuto = !!props.showAntPromptCaching && messageHasUserFlag(props.message, MESSAGE_FLAG_VND_ANT_CACHE_AUTO);
  const isVndAndCacheUser = !!props.showAntPromptCaching && messageHasUserFlag(props.message, MESSAGE_FLAG_VND_ANT_CACHE_USER);

  const {
    annotationFragments,    // Web Citations, References (rendered at top)
    interleavedFragments,   // Reasoning, Placeholders, Text, Code, Tools (interleaved in temporal order)
    imageAttachments,       // Stamp-sized Images
    nonImageAttachments,    // Document Attachments, likely the User dropped them in
    lastFragmentIsError,
  } = useFragmentBuckets(messageFragments);

  const fragmentFlattenedText = React.useMemo(() => messageFragmentsReduceText(messageFragments), [messageFragments]);
  const handleHighlightSelText = useSelHighlighterMemo(messageId, selText, interleavedFragments.filter(f => f.ft === 'content'), fromAssistant, props.onMessageFragmentReplace);

  const textSubject = selText ? selText : fragmentFlattenedText;

  const userCommandApprox = !fromUser ? false
    : fragmentFlattenedText.startsWith('/draw ') ? 'draw'
      : fragmentFlattenedText.startsWith('/react ') ? 'react'
        : false;


  // TODO: fix the diffing
  // const wordsDiff = useWordsDifference(textSubject, props.diffPreviousText, showDiff);


  const { onMessageAssistantFrom, onMessageDelete, onMessageFragmentAppend, onMessageFragmentDelete, onMessageFragmentReplace, onMessageContinue, onTextDiagram, onTextImagine } = props;

  const handleFragmentNew = React.useCallback(() => {
    onMessageFragmentAppend?.(messageId, createTextContentFragment(''));
  }, [messageId, onMessageFragmentAppend]);

  const handleFragmentDelete = React.useCallback((fragmentId: DMessageFragmentId) => {
    onMessageFragmentDelete?.(messageId, fragmentId);
  }, [messageId, onMessageFragmentDelete]);

  const handleFragmentReplace = React.useCallback((fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => {
    onMessageFragmentReplace?.(messageId, fragmentId, newFragment);
  }, [messageId, onMessageFragmentReplace]);

  const handleMessageContinue = React.useCallback((continueText: null | string) => {
    onMessageContinue?.(messageId, continueText);
  }, [messageId, onMessageContinue]);


  // Text Editing

  const isEditingText = !!textContentEditState;

  const handleApplyEdit = React.useCallback((fragmentId: DMessageFragmentId, editedText: string) => {
    // perform deletion of the fragment if the text is empty
    if (!editedText.length)
      return handleFragmentDelete(fragmentId);

    // find the fragment to be replaced
    const oldFragment = messageFragments.find(f => f.fId === fragmentId);
    if (!oldFragment) return;
    const newFragment = updateFragmentWithEditedText(oldFragment, editedText);
    if (newFragment)
      handleFragmentReplace(fragmentId, newFragment);
  }, [handleFragmentDelete, handleFragmentReplace, messageFragments]);

  const handleApplyAllEdits = React.useCallback(async (withControl: boolean) => {
    const state = textContentEditState || {};
    setTextContentEditState(null);
    for (const [fragmentId, editedText] of Object.entries(state))
      handleApplyEdit(fragmentId, editedText);
    // if the user pressed Ctrl, we begin a regeneration from here
    if (withControl && onMessageAssistantFrom)
      await onMessageAssistantFrom(messageId, 0);
  }, [handleApplyEdit, messageId, onMessageAssistantFrom, textContentEditState]);

  const handleEditsApplyClicked = React.useCallback(() => handleApplyAllEdits(false), [handleApplyAllEdits]);

  const handleEditsBegin = React.useCallback(() => setTextContentEditState({}), []);

  const handleEditsCancel = React.useCallback(() => setTextContentEditState(null), []);

  const handleEditSetText = React.useCallback((fragmentId: DMessageFragmentId, editedText: string, applyNow: boolean) => {
    if (applyNow)
      handleApplyEdit(fragmentId, editedText);
    else
      setTextContentEditState((prev): ChatMessageTextPartEditState => ({ ...prev, [fragmentId]: editedText || '' }));
  }, [handleApplyEdit]);


  // Message Operations Menu

  const { onAddInReferenceTo, onMessageToggleUserFlag } = props;

  const handleOpsMenuToggle = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    !!event.currentTarget && setOpsMenuAnchor(event.currentTarget);
  }, []);

  const handleCloseOpsMenu = React.useCallback(() => setOpsMenuAnchor(null), []);

  const handleOpsCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    clipboardCopyDOMSelectionOrFallback(blocksRendererRef.current, textSubject, 'Message');
    handleCloseOpsMenu();
    closeContextMenu();
    closeBubble();
  };

  const handleOpsEditToggle = React.useCallback((e: React.MouseEvent) => {
    if (messagePendingIncomplete && !isEditingText) return; // don't allow editing while incomplete
    if (isEditingText) handleEditsCancel();
    else handleEditsBegin();
    e.preventDefault();
    handleCloseOpsMenu();
  }, [handleCloseOpsMenu, handleEditsBegin, handleEditsCancel, isEditingText, messagePendingIncomplete]);

  const handleOpsToggleAntCacheUser = React.useCallback(() => {
    onMessageToggleUserFlag?.(messageId, MESSAGE_FLAG_VND_ANT_CACHE_USER, 2);
  }, [messageId, onMessageToggleUserFlag]);

  const handleOpsToggleSkipMessage = React.useCallback(() => {
    onMessageToggleUserFlag?.(messageId, MESSAGE_FLAG_AIX_SKIP);
  }, [messageId, onMessageToggleUserFlag]);

  const handleOpsToggleStarred = React.useCallback(() => {
    onMessageToggleUserFlag?.(messageId, MESSAGE_FLAG_STARRED);
  }, [messageId, onMessageToggleUserFlag]);

  const handleOpsToggleNotifyComplete = React.useCallback(() => {
    // also remember the preference, for auto-setting flags by the persona
    setIsNotificationEnabledForModel(messageId, !isUserNotifyComplete);
    onMessageToggleUserFlag?.(messageId, MESSAGE_FLAG_NOTIFY_COMPLETE);
  }, [isUserNotifyComplete, messageId, onMessageToggleUserFlag]);

  const handleOpsAssistantFrom = async (e: React.MouseEvent) => {
    e.preventDefault();
    handleCloseOpsMenu();
    await props.onMessageAssistantFrom?.(messageId, fromAssistant ? -1 : 0);
  };

  const handleOpsBeamFrom = async (e: React.MouseEvent) => {
    e.stopPropagation();
    handleCloseOpsMenu();
    await props.onMessageBeam?.(messageId);
  };

  const handleOpsBranch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // to try to not steal the focus from the branched conversation
    props.onMessageBranch?.(messageId);
    handleCloseOpsMenu();
  };

  const handleOpsToggleShowDiff = () => setShowDiff(!showDiff);


  const handleOpsAddInReferenceTo = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onAddInReferenceTo && textSubject.trim().length >= BUBBLE_MIN_TEXT_LENGTH) {
      onAddInReferenceTo({ mrt: 'dmsg', mText: textSubject.trim(), mRole: messageRole /*, messageId*/ });
      handleCloseOpsMenu();
      closeContextMenu();
      closeBubble();
    }
  };


  const handleOpsTruncate = (_e: React.MouseEvent) => {
    props.onMessageTruncate?.(messageId);
    handleCloseOpsMenu();
  };

  const handleOpsDelete = React.useCallback(() => {
    onMessageDelete?.(messageId);
  }, [messageId, onMessageDelete]);


  // Context Menu

  const removeContextAnchor = React.useCallback(() => {
    if (contextMenuAnchor) {
      try {
        document.body.removeChild(contextMenuAnchor);
      } catch (e) {
        // ignore...
      }
    }
  }, [contextMenuAnchor]);

  const openContextMenu = React.useCallback((event: MouseEvent, selectedText: string) => {
    event.stopPropagation();
    event.preventDefault();

    // remove any stray anchor
    removeContextAnchor();

    // create a temporary fixed anchor element to position the menu
    const anchorEl = document.createElement('div');
    anchorEl.style.position = 'fixed';
    anchorEl.style.left = `${event.clientX}px`;
    anchorEl.style.top = `${event.clientY}px`;
    document.body.appendChild(anchorEl);

    setContextMenuAnchor(anchorEl);
    setSelText(selectedText);
  }, [removeContextAnchor]);

  const closeContextMenu = React.useCallback(() => {
    // window.getSelection()?.removeAllRanges?.();
    removeContextAnchor();
    setContextMenuAnchor(null);
    setSelText(null);
  }, [removeContextAnchor]);

  const handleContextMenu = React.useCallback((event: MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();
      if (selectedText.length > 0)
        openContextMenu(event, selectedText);
    }
  }, [openContextMenu]);


  // Bubble

  const closeBubble = React.useCallback((anchorEl?: HTMLElement, options?: { clearSelection?: boolean }) => {
    // NOTE - we used to have this always on, which would remove the highlighted text, but it's fired too much and in particular
    // it was corrupting the extension of text selection (http://github.com/enricoros/big-AGI/issues/788)
    //
    // However the likely expected user behavior here is to keep the selection, hence by default we don't clear it
    if (options?.clearSelection)
      window.getSelection()?.removeAllRanges?.();
    try {
      const anchor = anchorEl || bubbleAnchor;
      anchor && document.body.removeChild(anchor);
    } catch (e) {
      // ignore...
    }
    setBubbleAnchor(null);
    setSelText(null);
  }, [bubbleAnchor]);

  // restore blocksRendererRef
  const handleOpenBubble = React.useCallback((event?: MouseEvent | null) => {
    // check for selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount <= 0) return;

    // check for enough selection
    const selectionText = selection.toString();
    if (selectionText.trim().length < BUBBLE_MIN_TEXT_LENGTH) return;

    // check for the selection being inside the blocks renderer (core of the message)
    const selectionRange = selection.getRangeAt(0);
    const blocksElement = blocksRendererRef.current;
    if (!blocksElement || !blocksElement.contains(selectionRange.commonAncestorContainer)) return;

    const rangeRects = selectionRange.getClientRects();
    if (rangeRects.length <= 0) return;

    const firstRect = rangeRects[0];
    const anchorEl = document.createElement('div');
    anchorEl.style.position = 'fixed';
    anchorEl.style.left = `${firstRect.left + window.scrollX}px`;
    anchorEl.style.top = !props.isMobile ? `${firstRect.top + window.scrollY}px` : `${firstRect.top + window.scrollY - 45}px`;
    if (props.isMobile)
      anchorEl.style.zIndex = '99999';  // Higher z-index to compete with native UI

    document.body.appendChild(anchorEl);
    anchorEl.setAttribute('role', 'dialog');

    // auto-close logic on unselect
    const closeOnUnselect = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        closeBubble(anchorEl, { clearSelection: false });
        document.removeEventListener('selectionchange', closeOnUnselect);
      }
    };
    document.addEventListener('selectionchange', closeOnUnselect);

    setBubbleAnchor(anchorEl);
    setSelText(selectionText); /* TODO: operate on the underlying content, not the rendered text */
  }, [closeBubble, props.isMobile]);

  const handleBubbleClickAway = React.useCallback((event: MouseEvent | TouchEvent /* DOM, not React */) => {
    if (!event.shiftKey)
      closeBubble();
  }, [closeBubble]);


  // Expose actions handle for parent components
  React.useImperativeHandle(props.actionsRef, () => ({
    beginEditTextContent: () => {
      if (!isEditingText && props.onMessageFragmentReplace && !messagePendingIncomplete)
        handleEditsBegin();
    },
  }), [handleEditsBegin, isEditingText, messagePendingIncomplete, props.onMessageFragmentReplace]);


  // Blocks renderer

  const handleBlocksContextMenu = React.useCallback((event: React.MouseEvent) => {
    handleContextMenu(event.nativeEvent);
  }, [handleContextMenu]);

  const handleBlocksDoubleClick = React.useCallback((event: React.MouseEvent) => {
    if ((doubleClickToEdit || event.shiftKey) && props.onMessageFragmentReplace)
      handleOpsEditToggle(event);
  }, [doubleClickToEdit, handleOpsEditToggle, props.onMessageFragmentReplace]);

  const handleBlocksMouseUp = React.useCallback((event: React.MouseEvent) => {
    // https://github.com/enricoros/big-AGI/issues/788
    // If shift is pressed, it's a selection extension attempt. Let the browser handle it.
    if (event.shiftKey)
      return;
    handleOpenBubble(event.nativeEvent);
  }, [handleOpenBubble]);

  const handleBlocksTouchEnd = React.useCallback((event: React.TouchEvent) => {
    if (event.shiftKey) return; // just to match the flow

    // on mobile, allow for text-selection events to process, then open
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length >= BUBBLE_MIN_TEXT_LENGTH)
        handleOpenBubble(null);
    }, 300);
  }, [handleOpenBubble]);


  // Options interceptor

  const lookForOptions = props.onMessageContinue !== undefined && props.isBottom === true && messageGenerator?.tokenStopReason !== 'out-of-tokens' && fromAssistant && !messagePendingIncomplete && !isEditingText && uiComplexityMode !== 'minimal' && false;

  const { fragments: renderInterleavedFragments, options: continuationOptions } = React.useMemo(() => {
    return optionsExtractFromFragments_dangerModifyFragment(lookForOptions, interleavedFragments);
  }, [interleavedFragments, lookForOptions]);


  // style
  const backgroundColor = messageBackground(messageRole, userCommandApprox, messageHasBeenEdited, false /*isAssistantError && !errorMessage*/);

  const listItemSx: SxProps = React.useMemo(() => ({
    // vars
    // '--AGI-overlay-start-opacity': uiComplexityMode === 'extra' ? 0.1 : 0, // disabled - looks worse

    // style
    backgroundColor: backgroundColor,
    px: { xs: 1, md: 4 },
    py: 2,
    
    // Transparent background for AI messages to match Claude
    ...(fromAssistant && {
      backgroundColor: 'transparent',
    }),

    // style: omit border if set externally
    ...(!('borderBottom' in (props.sx || {})) && !props.isBottom && fromAssistant && {
      borderBottom: '1px solid',
      borderBottomColor: 'rgba(0,0,0,0.04)',
    }),

    // style: when starred
    ...(isUserStarred && {
      outline: '3px solid',
      outlineColor: 'primary.solidBg',
      boxShadow: 'lg',
      borderRadius: 'lg',
      zIndex: 1,
    }),

    // style: when has a user/automatic breakpoint
    ...(isVndAndCacheUser && {
      borderInlineStart: `0.125rem solid ${ModelVendorAnthropic.brandColor}`,
      // borderTopLeftRadius: '0.375rem',
      // borderBottomLeftRadius: '0.375rem',
    }),
    ...(uiComplexityMode === 'extra' && isVndAndCacheAuto && !isVndAndCacheUser && {
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '0.125rem',
        background: `repeating-linear-gradient( -45deg, transparent, transparent 2px, ${ModelVendorAnthropic.brandColor} 2px, ${ModelVendorAnthropic.brandColor} 12px ) repeat`,
      },
    }),
    // style: when the user skips the message
    ...(isUserMessageSkipped && messageSkippedSx),

    // style: when the message is being edited
    ...(isEditingText && {
      zIndex: 1, // this is to make the whole message appear on top of Beam Scatter > RayControlsMemo
    }),

    // for: ENABLE_COPY_MESSAGE_OVERLAY
    // '&:hover > button': { opacity: 1 },

    // layout
    display: 'block', // this is Needed, otherwise there will be a horizontal overflow

    ...props.sx,
  }), [backgroundColor, fromAssistant, isEditingText, isUserMessageSkipped, isUserStarred, isVndAndCacheAuto, isVndAndCacheUser, props.isBottom, props.sx, uiComplexityMode]);


  // avatar icon & label & tooltip

  const zenMode = uiComplexityMode === 'minimal';

  const showAvatarIcon = !props.hideAvatar && !zenMode;
  const messageGeneratorName = messageGenerator?.name;
  const messageAvatarIcon = React.useMemo(
    () => !showAvatarIcon ? null : makeMessageAvatarIcon(uiComplexityMode, messageRole, messageGeneratorName, messagePurposeId, !!messagePendingIncomplete, isUserMessageSkipped, isUserNotifyComplete, true),
    [isUserMessageSkipped, isUserNotifyComplete, messageGeneratorName, messagePendingIncomplete, messagePurposeId, messageRole, showAvatarIcon, uiComplexityMode],
  );

  const { label: messageAvatarLabel, tooltip: messageAvatarTooltip } = useMessageAvatarLabel(props.message, uiComplexityMode);


  return (
    <Box
      component='li'
      role='chat-message'
      tabIndex={-1 /* for shortcuts navigation */}
      onMouseUp={(ENABLE_BUBBLE && !fromSystem /*&& !isAssistantError*/) ? handleBlocksMouseUp : undefined}
      onTouchEnd={(ENABLE_BUBBLE && !fromSystem /*&& !isAssistantError*/) ? handleBlocksTouchEnd : undefined}
      sx={listItemSx}
      // className={messagePendingIncomplete ? 'agi-border-4' /* CSS Effect while in progress */ : undefined}
    >

      {/* (Optional) top decorator */}
      {props.topDecorator}


      {/* Message Row: Aside, Fragment[][], Aside2 */}
      <Box
        role={undefined /* aside | message | ops */}
        sx={(fromAssistant && !isEditingText) ? messageBodySx : messageBodyReverseSx}
      >

        {/* [start-Avatar] Avatar (Persona) */}
        {!props.hideAvatar && !isEditingText && (
          <Box sx={zenMode ? messageZenAsideColumnSx : messageAsideColumnSx}>

            {/* Persona Avatar or Menu Button */}
            <Box
              onClick={(event) => {
                // [DEBUG][PROD] shift+click to dump the DMessage
                event.shiftKey && console.log('message', props.message);
                handleOpsMenuToggle(event);
              }}
              onContextMenu={handleOpsMenuToggle}
              onMouseEnter={props.isMobile ? undefined : () => setIsHovering(true)}
              onMouseLeave={props.isMobile ? undefined : () => setIsHovering(false)}
              sx={personaAvatarOrMenuSx}
            >
              {showAvatarIcon && !isHovering && !opsMenuAnchor ? (
                messageAvatarIcon
              ) : (
                <IconButton
                  size='sm'
                  variant={opsMenuAnchor ? 'solid' : zenMode ? 'plain' : 'soft'}
                  color={(fromAssistant || fromSystem || zenMode) ? 'neutral' : userCommandApprox === 'draw' ? 'warning' : userCommandApprox === 'react' ? 'success' : 'primary'}
                  sx={avatarIconSx}
                >
                  <MoreVertIcon />
                </IconButton>
              )}
            </Box>

            {/* Assistant (llm/function) name */}
            {fromAssistant && !zenMode && (
              <TooltipOutlined asLargePane enableInteractive title={messageAvatarTooltip} placement='bottom-start'>
                <Typography level='body-xs' sx={(messagePendingIncomplete && !Release.Features.LIGHTER_ANIMATIONS) ? messageAvatarLabelAnimatedSx : messageAvatarLabelSx}>
                  {messageAvatarLabel}
                </Typography>
              </TooltipOutlined>
            )}

          </Box>
        )}

        {/* [start-Edit] Fragments Edit: Apply */}
        {isEditingText && (
          <Box sx={messageAsideColumnSx} className='msg-edit-button'>
            <Tooltip arrow disableInteractive title='应用更改'>
              <IconButton size='sm' variant='solid' color='warning' onClick={handleEditsApplyClicked}>
                <CheckRoundedIcon />
              </IconButton>
            </Tooltip>
            <Typography level='body-xs' sx={editButtonWrapSx}>
              完成
            </Typography>
          </Box>
        )}


        {/* V-Fragments: Image Attachments | Content | Doc Attachments */}
        <Box 
          ref={blocksRendererRef /* restricts the BUBBLE menu to the children of this */} 
          sx={{
            ...fragmentsListSx,
            ...(fromUser && {
              backgroundColor: 'neutral.softBg',
              borderRadius: '1.25rem',
              p: 2,
              maxWidth: { xs: '95%', md: '60vw' },
              alignSelf: 'flex-end',
            }),
            ...(fromAssistant && {
              maxWidth: { xs: '95%', md: '60vw' },
              mx: 'auto',
              p: 0,
            })
          }}
        >

          {/* (optional) Message date */}
          {(props.showBlocksDate === true && !!(messageUpdated || messageCreated)) && (
            <Typography level='body-sm' sx={{ mx: 1.5, textAlign: fromAssistant ? 'left' : 'right' }}>
              <TimeAgo date={messageUpdated || messageCreated} />
            </Typography>
          )}

          {/* (special case) System modified warning */}
          {fromSystem && messageHasBeenEdited && (
            <Typography level='body-sm' color='warning' sx={{ mt: 1, mx: 1.5, textAlign: 'end' }}>
              用户已编辑 - 自动更新已禁用
            </Typography>
          )}

          {/* In-Reference-To Bubble */}
          {!!messageMetadata?.inReferenceTo?.length && (
            <InReferenceToList items={messageMetadata.inReferenceTo} />
          )}

          {/* [NOT SYSTEM, UNREAL] Image Attachment Fragments - just for a prettier display on top of the message, but is "WRONG" logically as the text comes before the image */}
          {!fromSystem && imageAttachments.length >= 1 && (
            <ImageAttachmentFragments
              imageAttachments={imageAttachments}
              contentScaling={adjContentScaling}
              messageRole={messageRole}
              disabled={isEditingText}
              onFragmentDelete={!props.onMessageFragmentDelete ? undefined : handleFragmentDelete}
            />
          )}

          {/* Annotation Fragments (absolute top: citations, references) */}
          {annotationFragments.length >= 1 && (
            <VoidFragments
              voidFragments={annotationFragments}
              nonVoidFragmentsCount={interleavedFragments.filter(f => f.ft === 'content').length}
              contentScaling={adjContentScaling}
              uiComplexityMode={uiComplexityMode}
              messageRole={messageRole}
              messagePendingIncomplete={messagePendingIncomplete}
              onFragmentDelete={!props.onMessageFragmentDelete ? undefined : handleFragmentDelete}
              onFragmentReplace={!props.onMessageFragmentReplace ? undefined : handleFragmentReplace}
            />
          )}

          {/* Interleaved Fragments (reasoning + content in temporal order) */}
          <ContentFragments
            contentFragments={renderInterleavedFragments}
            showEmptyNotice={!messageFragments.length && !messagePendingIncomplete}

            contentScaling={adjContentScaling}
            uiComplexityMode={uiComplexityMode}
            fitScreen={props.fitScreen}
            isMobile={props.isMobile}
            messageRole={messageRole}
            messageGeneratorLlmId={messageGenerator?.mgt === 'aix' ? messageGenerator.aix?.mId : undefined}
            messagePendingIncomplete={messagePendingIncomplete}
            optiAllowSubBlocksMemo={!messagePendingIncomplete}
            disableMarkdownText={disableMarkdown || fromUser /* User messages are edited as text. Try to have them in plain text. NOTE: This may bite. */}
            showUnsafeHtmlCode={props.showUnsafeHtmlCode}
            enhanceCodeBlocks={labsEnhanceCodeBlocks}

            textEditsState={textContentEditState}
            setEditedText={(!props.onMessageFragmentReplace || messagePendingIncomplete) ? undefined : handleEditSetText}
            onEditsApply={handleApplyAllEdits}
            onEditsCancel={handleEditsCancel}

            onFragmentAddBlank={!props.onMessageFragmentAppend ? undefined : handleFragmentNew}
            onFragmentDelete={!props.onMessageFragmentDelete ? undefined : handleFragmentDelete}
            onFragmentReplace={!props.onMessageFragmentReplace ? undefined : handleFragmentReplace}
            onMessageDelete={!props.onMessageDelete ? undefined : handleOpsDelete}

            onContextMenu={(props.onMessageFragmentReplace && ENABLE_CONTEXT_MENU) ? handleBlocksContextMenu : undefined}
            onDoubleClick={(props.onMessageFragmentReplace /*&& doubleClickToEdit disabled, as we may have shift too */) ? handleBlocksDoubleClick : undefined}
          />

          {/* Document Fragments */}
          {nonImageAttachments.length >= 1 && (
            <DocumentAttachmentFragments
              attachmentFragments={nonImageAttachments}
              messageRole={messageRole}
              contentScaling={adjContentScaling}
              isMobile={props.isMobile}
              zenMode={zenMode}
              allowSelection={!isEditingText}
              disableMarkdownText={disableMarkdown}
              onFragmentDelete={!props.onMessageFragmentDelete ? undefined : handleFragmentDelete}
              onFragmentReplace={!props.onMessageFragmentReplace ? undefined : handleFragmentReplace}
            />
          )}

          {/* [SYSTEM, REAL] Image Attachment Fragments - just for a realistic display below the system instruction text/docs */}
          {fromSystem && imageAttachments.length >= 1 && (
            <ImageAttachmentFragments
              imageAttachments={imageAttachments}
              contentScaling={adjContentScaling}
              messageRole={messageRole}
              disabled={isEditingText}
              onFragmentDelete={!props.onMessageFragmentDelete ? undefined : handleFragmentDelete}
            />
          )}

          {/* Continue... */}
          {props.isBottom && fromAssistant && messageGenerator?.tokenStopReason === 'out-of-tokens' && !!props.onMessageContinue && (
            <BlockOpContinue
              contentScaling={adjContentScaling}
              messageRole={messageRole}
              onContinue={handleMessageContinue}
            />
          )}

          {/* Upstream Resume... */}
          {props.isBottom && fromAssistant && lastFragmentIsError && messageGenerator?.upstreamHandle?.responseId && (
            <BlockOpUpstreamResume
              upstreamHandle={messageGenerator.upstreamHandle}
              onResume={console.error}
              onCancel={console.error}
              onDelete={console.error}
            />
          )}

          {/* Continue Options... */}
          {continuationOptions.length >= 1 && !!props.onMessageContinue && (
            <BlockOpOptions
              contentScaling={adjContentScaling}
              options={continuationOptions}
              onContinue={handleMessageContinue}
            />
          )}

        </Box>


        {/* [end-Edit] Fragments Edit: Cancel */}
        {isEditingText && (
          <Box sx={messageAsideColumnSx} className='msg-edit-button'>
            <Tooltip arrow disableInteractive title='舍弃更改'>
              <IconButton size='sm' variant='solid' onClick={handleEditsCancel}>
                <CloseRoundedIcon />
              </IconButton>
            </Tooltip>
            <Typography level='body-xs' sx={editButtonWrapSx}>
              取消
            </Typography>
          </Box>
        )}

      </Box>


      {/* Overlay copy icon */}
      {/*{ENABLE_COPY_MESSAGE_OVERLAY && !fromSystem && !isEditingText && (*/}
      {/*  <Tooltip title={messagePendingIncomplete ? null : (fromAssistant ? 'Copy message' : 'Copy input')} variant='solid'>*/}
      {/*    <IconButton*/}
      {/*      variant='outlined' onClick={handleOpsCopy}*/}
      {/*      sx={{*/}
      {/*        position: 'absolute', ...(fromAssistant ? { right: { xs: 12, md: 28 } } : { left: { xs: 12, md: 28 } }), zIndex: 10,*/}
      {/*        opacity: 0, transition: 'opacity 0.16s cubic-bezier(.17,.84,.44,1)',*/}
      {/*      }}>*/}
      {/*      <ContentCopyIcon />*/}
      {/*    </IconButton>*/}
      {/*  </Tooltip>*/}
      {/*)}*/}


      {/* Message Operations Menu (3 dots) */}
      {!!opsMenuAnchor && (
        <CloseablePopup
          menu anchorEl={opsMenuAnchor} onClose={handleCloseOpsMenu}
          dense
          minWidth={280}
          placement={fromAssistant ? 'auto-start' : 'auto-end'}
        >

          {fromSystem && (
            <ListItem>
              <Typography level='body-sm'>
                系统消息
              </Typography>
            </ListItem>
          )}

          {/* Edit / Copy */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Edit */}
            {!!props.onMessageFragmentReplace && (
              <MenuItem variant='plain' disabled={!!messagePendingIncomplete} onClick={handleOpsEditToggle} sx={{ flex: 1 }}>
                <ListItemDecorator>{isEditingText ? <CloseRoundedIcon /> : <EditRoundedIcon />}</ListItemDecorator>
                {isEditingText ? '舍弃' : '编辑'}
              </MenuItem>
            )}
            {/* Copy */}
            <MenuItem onClick={handleOpsCopy} sx={{ flex: 1 }}>
              <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
              复制
            </MenuItem>
            {/* Starred */}
            {!!onMessageToggleUserFlag && (
              <MenuItem onClick={handleOpsToggleStarred} sx={{ flexGrow: 0, px: 1 }}>
                <Tooltip disableInteractive title={!isUserStarred ? '链接消息 - 使用 @ 在其他聊天中引用' : '移除链接'}>
                  {isUserStarred
                    ? <AlternateEmailIcon color='primary' sx={{ fontSize: 'xl' }} />
                    : <InsertLinkIcon sx={{ rotate: '45deg' }} />
                  }
                </Tooltip>
              </MenuItem>
            )}
          </Box>

          {/* Notify Complete */}
          {messagePendingIncomplete && !!onMessageToggleUserFlag && <ListDivider />}
          {messagePendingIncomplete && !!onMessageToggleUserFlag && (
            <MenuItem onClick={handleOpsToggleNotifyComplete}>
              <ListItemDecorator>{isUserNotifyComplete ? <NotificationsActiveIcon /> : <NotificationsOutlinedIcon />}</ListItemDecorator>
              回复时通知
            </MenuItem>
          )}

          {/* Anthropic Breakpoint Toggle */}
          {!messagePendingIncomplete && <ListDivider />}
          {!messagePendingIncomplete && !isUserMessageSkipped && !!props.showAntPromptCaching && (
            <MenuItem onClick={handleOpsToggleAntCacheUser}>
              <ListItemDecorator><AnthropicIcon sx={isVndAndCacheUser ? antCachePromptOnSx : antCachePromptOffSx} /></ListItemDecorator>
              {isVndAndCacheUser ? '不缓存' : <>缓存 <span style={{ opacity: 0.5 }}>至此</span></>}
            </MenuItem>
          )}
          {!messagePendingIncomplete && !isUserMessageSkipped && !!props.showAntPromptCaching && isVndAndCacheAuto && !isVndAndCacheUser && (
            <MenuItem disabled>
              <ListItemDecorator><TextureIcon sx={{ color: ModelVendorAnthropic.brandColor }} /></ListItemDecorator>
              自动缓存 <span style={{ opacity: 0.5 }}>5 分钟</span>
            </MenuItem>
          )}
          {/* Aix Skip Message */}
          {!messagePendingIncomplete && !!props.onMessageToggleUserFlag && (
            <MenuItem onClick={handleOpsToggleSkipMessage}>
              <ListItemDecorator>{isUserMessageSkipped ? <VisibilityOffIcon sx={{ color: 'danger.plainColor' }} /> : <VisibilityIcon />}</ListItemDecorator>
              {isUserMessageSkipped ? '取消跳过' : '跳过 AI 处理'}
            </MenuItem>
          )}

          {/* Delete / Branch / Truncate */}
          {!!props.onMessageBranch && <ListDivider />}
          {!!props.onMessageBranch && (
            <MenuItem onClick={handleOpsBranch} disabled={fromSystem}>
              <ListItemDecorator>
                <ForkRightIcon />
              </ListItemDecorator>
              分支
              {!props.isBottom && <span style={{ opacity: 0.5 }}>从这里开始</span>}
            </MenuItem>
          )}
          {!!props.onMessageDelete && (
            <MenuItem onClick={handleOpsDelete} disabled={false /*fromSystem*/}>
              <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
              删除
              <span style={{ opacity: 0.5 }}>消息</span>
            </MenuItem>
          )}
          {!!props.onMessageTruncate && (
            <MenuItem onClick={handleOpsTruncate} disabled={props.isBottom}>
              <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
              截断
              <span style={{ opacity: 0.5 }}>在此之后</span>
            </MenuItem>
          )}

          {/* Diff Viewer */}
          {!!props.diffPreviousText && <ListDivider />}
          {!!props.diffPreviousText && (
            <MenuItem onClick={handleOpsToggleShowDiff}>
              <ListItemDecorator><DifferenceIcon /></ListItemDecorator>
              显示差异
              <Switch checked={showDiff} onChange={handleOpsToggleShowDiff} sx={{ ml: 'auto' }} />
            </MenuItem>
          )}
          {/* Beam/Restart */}
          {(!!props.onMessageAssistantFrom || !!props.onMessageBeam) && <ListDivider />}
          {!!props.onMessageAssistantFrom && (
            <MenuItem disabled={fromSystem} onClick={handleOpsAssistantFrom}>
              <ListItemDecorator>{fromAssistant ? <ReplayIcon color='primary' /> : <TelegramIcon color='primary' />}</ListItemDecorator>
              {!fromAssistant
                ? <>重启 <span style={{ opacity: 0.5 }}>从这里开始</span></>
                : !props.isBottom
                  ? <>重试 <span style={{ opacity: 0.5 }}>从这里开始</span></>
                  : <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>重试<KeyStroke variant='outlined' combo='Ctrl + Shift + Z' /></Box>}
            </MenuItem>
          )}
          {!!props.onMessageBeam && (
            <MenuItem disabled={fromSystem} onClick={handleOpsBeamFrom}>
              <ListItemDecorator>
                <ChatBeamIcon color={fromSystem ? undefined : 'primary'} />
              </ListItemDecorator>
              {!fromAssistant
                ? <>在此开启多模型融合</>
                : !props.isBottom
                  ? <>融合编辑</>
                  : <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>多模型融合<KeyStroke variant='outlined' combo='Ctrl + Shift + B' /></Box>}
            </MenuItem>
          )}
        </CloseablePopup>
      )}


      {/* Bubble Over Toolbar */}
      {ENABLE_BUBBLE && !!bubbleAnchor && (
        <Popper placement='top-start' open={true} anchorEl={bubbleAnchor} slotProps={{
          root: { style: { zIndex: themeZIndexChatBubble } },
        }}>
          <ClickAwayListener onClickAway={handleBubbleClickAway}>
            <ButtonGroup
              variant='plain'
              sx={{
                '--ButtonGroup-separatorColor': 'none !important',
                '--ButtonGroup-separatorSize': 0,
                borderRadius: '0',
                backgroundColor: 'background.popup',
                border: '1px solid',
                borderColor: 'primary.outlinedBorder',
                boxShadow: '0px 4px 24px -8px rgb(var(--joy-palette-neutral-darkChannel) / 50%)',
                mb: 1.5,
                ml: -1.5,
                alignItems: 'center',
                '& > button': {
                  '--Icon-fontSize': 'var(--joy-fontSize-lg, 1.125rem)',
                  minHeight: '2.5rem',
                  minWidth: '2.75rem',
                },
              }}
            >
              {/* Bubble Add Reference */}
              {!!onAddInReferenceTo && <Tooltip disableInteractive arrow placement='top' title={props.hasInReferenceTo ? '也回复此条' : fromAssistant ? '回复' : '引用'}>
                <IconButton color='primary' onClick={handleOpsAddInReferenceTo}>
                  {props.hasInReferenceTo ? <ReplyAllRoundedIcon sx={{ fontSize: 'xl' }} /> : <ReplyRoundedIcon sx={{ fontSize: 'xl' }} />}
                </IconButton>
              </Tooltip>}
              {/*{!!props.onMessageBeam && fromAssistant && <Tooltip disableInteractive arrow placement='top' title='Beam'>*/}
              {/*  <IconButton color='primary'>*/}
              {/*    <ChatBeamIcon sx={{ fontSize: 'xl' }} />*/}
              {/*  </IconButton>*/}
              {/*</Tooltip>}*/}
              {!!onAddInReferenceTo && <Divider />}

              {/* Text Tools (edits fragment, only for assistant messages) */}
              {fromAssistant && <Tooltip disableInteractive arrow placement='top' title='亮显文本'>
                <IconButton disabled={!handleHighlightSelText} onClick={!handleHighlightSelText ? undefined : () => {
                  handleHighlightSelText('highlight');
                  closeBubble();
                }}>
                  <MarkHighlightIcon hcolor={handleHighlightSelText ? 'yellow' : undefined} />
                </IconButton>
              </Tooltip>}
              {fromAssistant && <Tooltip disableInteractive arrow placement='top' title='删除线'>
                <IconButton disabled={!handleHighlightSelText} onClick={!handleHighlightSelText ? undefined : () => {
                  handleHighlightSelText('strike');
                  closeBubble();
                }}>
                  <StrikethroughSIcon />
                </IconButton>
              </Tooltip>}
              {fromAssistant && <Tooltip disableInteractive arrow placement='top' title='粗体'>
                <IconButton disabled={!handleHighlightSelText} onClick={!handleHighlightSelText ? undefined : () => {
                  handleHighlightSelText('strong');
                  closeBubble();
                }}>
                  <FormatBoldIcon />
                </IconButton>
              </Tooltip>}
              {fromAssistant && <Tooltip disableInteractive arrow placement='top' title='剪切文本'>
                <IconButton disabled={!handleHighlightSelText} onClick={!handleHighlightSelText ? undefined : () => {
                  handleHighlightSelText('cut');
                  closeBubble();
                }}>
                  <ContentCutIcon />
                </IconButton>
              </Tooltip>}
              {fromAssistant && <Divider />}


              {/* Bubble Copy */}
              <Tooltip disableInteractive arrow placement='top' title='复制选中内容'>
                <IconButton onClick={handleOpsCopy}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>

            </ButtonGroup>
          </ClickAwayListener>
        </Popper>
      )}


      {/* Context (Right-click) Menu */}
      {!!contextMenuAnchor && (
        <CloseablePopup
          menu anchorEl={contextMenuAnchor} onClose={closeContextMenu}
          dense
          minWidth={220}
          placement='bottom-start'
        >
          <MenuItem onClick={handleOpsCopy} sx={{ flex: 1, alignItems: 'center' }}>
            <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
            复制
          </MenuItem>

        </CloseablePopup>
      )}

    </Box>
  );
}
