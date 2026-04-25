import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { FileWithHandle } from 'browser-fs-access';

import { Box, Button, ButtonGroup, Card, Dropdown, Grid, IconButton, Menu, MenuButton, MenuItem, Textarea, Typography, useColorScheme } from '@mui/joy';
import { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SendIcon from '@mui/icons-material/Send';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AddIcon from '@mui/icons-material/Add';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TuneIcon from '@mui/icons-material/Tune';

import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import type { AppChatIntent } from '../../AppChat';
import { useChatAutoSuggestAttachmentPrompts } from '../../store-app-chat';

import { useAgiAttachmentPrompts } from '~/modules/aifn/agiattachmentprompts/useAgiAttachmentPrompts';


import { DLLM, getLLMContextTokens, getLLMPricing, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { AudioGenerator } from '~/common/util/audio/AudioGenerator';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { ButtonAttachFilesMemo, openFileForAttaching } from '~/common/components/ButtonAttachFiles';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { DMessageId, DMessageMetadata, DMetaReferenceItem, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { ShortcutKey, ShortcutObject, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { animationEnterBelow } from '~/common/util/animUtils';
import { asValidURL } from '~/common/util/urlUtils';
import { DConversationId } from '~/common/stores/chat/chat.conversation';
import { copyToClipboard, supportsClipboardRead } from '~/common/util/clipboardUtils';
import { createTextContentFragment, DMessageAttachmentFragment, DMessageContentFragment, duplicateDMessageFragments } from '~/common/stores/chat/chat.fragments';
import { glueForMessageTokens, marshallWrapDocFragments } from '~/common/stores/chat/chat.tokens';
import { isValidConversation, useChatStore } from '~/common/stores/chat/store-chats';
import { getModelParameterValueOrThrow } from '~/common/stores/llms/llms.parameters';
import { removeQueryParam, useRouterQuery } from '~/common/app.routes';
import { lineHeightTextareaMd, themeBgAppChatComposer } from '~/common/app.theme';
import { optimaOpenModels, optimaOpenPreferences } from '~/common/layout/optima/useOptima';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';
import { supportsScreenCapture } from '~/common/util/screenCaptureUtils';
import { useChatComposerOverlayStore } from '~/common/chat-overlay/store-perchat_vanilla';
import { useComposerStartupText, useLogicSherpaStore } from '~/common/logic/store-logic-sherpa';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { useUICounter, useUIPreferencesStore } from '~/common/stores/store-ui';
import { useUXLabsStore } from '~/common/stores/store-ux-labs';

import type { ActileItem } from './actile/ActileProvider';
import { providerAttachmentLabels } from './actile/providerAttachmentLabels';
import { providerCommands } from './actile/providerCommands';
import { providerStarredMessages, StarredMessageItem } from './actile/providerStarredMessage';
import { useActileManager } from './actile/useActileManager';

import type { AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';
import { LLMAttachmentDraftsAction, LLMAttachmentsList } from './llmattachments/LLMAttachmentsList';
import { PhPaintBrush } from '~/common/components/icons/phosphor/PhPaintBrush';
import { useAttachmentDrafts } from '~/common/attachment-drafts/useAttachmentDrafts';
import { useLLMAttachmentDrafts } from './llmattachments/useLLMAttachmentDrafts';

import type { ChatExecuteMode } from '../../execute-mode/execute-mode.types';
import { chatExecuteModeCanAttach, useChatExecuteMode } from '../../execute-mode/useChatExecuteMode';

import { ButtonAttachCameraMemo, useCameraCaptureModalDialog } from './buttons/ButtonAttachCamera';
import { ButtonAttachClipboardMemo } from './buttons/ButtonAttachClipboard';
import { ButtonAttachGoogleDriveMemo } from './buttons/ButtonAttachGoogleDrive';
import { ButtonAttachScreenCaptureMemo } from './buttons/ButtonAttachScreenCapture';

import { hasGoogleDriveCapability, useGoogleDrivePicker } from '~/common/attachment-drafts/useGoogleDrivePicker';
import { ButtonBeamMemo } from './buttons/ButtonBeam';

import { ButtonGroupDrawRepeat } from './buttons/ButtonGroupDrawRepeat';

import { ButtonMultiChatMemo } from './buttons/ButtonMultiChat';
import { ButtonOptionsDraw } from './buttons/ButtonOptionsDraw';
import { ComposerTextAreaActions } from './textarea/ComposerTextAreaActions';
import { ComposerTextAreaDrawActions } from './textarea/ComposerTextAreaDrawActions';
import { StatusBarMemo } from '../StatusBar';
import { TokenBadgeMemo } from './tokens/TokenBadge';
import { TokenProgressbarMemo } from './tokens/TokenProgressbar';
import { useComposerDragDrop } from './useComposerDragDrop';
import { useTextTokenCount } from './tokens/useTextTokenCounter';
import { usePersonaIdDropdown } from '../layout-bar/usePersonaDropdown';



// configuration
const SHOW_TIPS_AFTER_RELOADS = 25;


const paddingBoxSx: SxProps = {
  p: { xs: 1, md: 2 },
};


const minimizedSx: SxProps = {
  ...paddingBoxSx,
  display: 'none',
};


/**
 * A React component for composing messages, with attachments and different modes.
 */
export function Composer(props: {
  isMobile: boolean;
  chatLLM: DLLM | null;
  composerTextAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  targetConversationId: DConversationId | null;
  capabilityHasT2I: boolean;
  capabilityHasT2IEdit: boolean;
  isMulticast: boolean | null;
  isDeveloperMode: boolean;
  onAction: (conversationId: DConversationId, chatExecuteMode: ChatExecuteMode, fragments: (DMessageContentFragment | DMessageAttachmentFragment)[], metadata?: DMessageMetadata) => boolean;
  onConversationBeamEdit: (conversationId: DConversationId, editMessageId?: DMessageId) => Promise<void>;
  onConversationsImportFromFiles: (files: File[]) => Promise<void>;
  onTextImagine: (conversationId: DConversationId, text: string) => void;
  setIsMulticast: (on: boolean) => void;
  onComposerHasContent: (hasContent: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sx?: SxProps;
}) {

  // state
  const [composeText, setComposeText] = React.useState('');
  const [drawRepeat, setDrawRepeat] = React.useState(1);
  const [sendStarted, setSendStarted] = React.useState(false);
  const {
    chatExecuteMode,
    chatExecuteModeSendColor, chatExecuteModeSendLabel,
    chatExecuteMenuComponent, chatExecuteMenuShown, showChatExecuteMenu,
    setChatExecuteMode,
  } = useChatExecuteMode(props.capabilityHasT2I, props.isMobile);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const personaDropdownRef = React.useRef<OptimaBarControlMethods>(null);
  const { personaDropdown } = usePersonaIdDropdown(props.targetConversationId, personaDropdownRef);


  // external state
  const { showPromisedOverlay } = useOverlayComponents();
  const { newChat: appChatNewChatIntent } = useRouterQuery<Partial<AppChatIntent>>();
  const { labsAttachScreenCapture, labsCameraDesktop, labsShowCost, labsShowShortcutBar } = useUXLabsStore(useShallow(state => ({
    labsAttachScreenCapture: state.labsAttachScreenCapture,
    labsCameraDesktop: state.labsCameraDesktop,
    labsShowCost: state.labsShowCost,
    labsShowShortcutBar: state.labsShowShortcutBar,
  })));
  const timeToShowTips = useLogicSherpaStore(state => state.usageCount >= SHOW_TIPS_AFTER_RELOADS);
  const { novel: explainShiftEnter, touch: touchShiftEnter } = useUICounter('composer-shift-enter');
  const { novel: explainAltEnter, touch: touchAltEnter } = useUICounter('composer-alt-enter');
  const { novel: explainCtrlEnter, touch: touchCtrlEnter } = useUICounter('composer-ctrl-enter');
  const [startupText, setStartupText] = useComposerStartupText();
  const { enterIsNewline, composerQuickButton } = useUIPreferencesStore(useShallow(state => ({
    enterIsNewline: state.enterIsNewline,
    composerQuickButton: state.composerQuickButton,
  })));

  const { assistantAbortible, systemPurposeId, tokenCount: _historyTokenCount, abortConversationTemp, isChatEmpty } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(_c => _c.id === props.targetConversationId);
    return {
      assistantAbortible: conversation ? !!conversation._abortController : false,
      systemPurposeId: conversation?.systemPurposeId ?? null,
      tokenCount: conversation ? conversation.tokenCount : 0,
      abortConversationTemp: state.abortConversationTemp,
      isChatEmpty: conversation ? conversation.messages.length === 0 : true,
    };
  }));

  // external overlay state (extra conversationId-dependent state)
  const conversationOverlayStore = props.targetConversationId
    ? ConversationsManager.getHandler(props.targetConversationId)?.conversationOverlayStore ?? null
    : null;

  // composer-overlay: for the in-reference-to state, comes from the conversation overlay
  const allowInReferenceTo = chatExecuteMode === 'generate-content';
  const inReferenceTo = useChatComposerOverlayStore(conversationOverlayStore, store => allowInReferenceTo ? store.inReferenceTo : null);

  // LLM-derived
  const noLLM = !props.chatLLM;
  const chatLLMSupportsImages = !!props.chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);

  // don't load URLs if the user is typing a command or there's no capability
  const hasComposerBrowseCapability = false;
  const enableLoadURLsInComposer = hasComposerBrowseCapability && !composeText.startsWith('/');

  // user message for attachments
  const { onConversationBeamEdit, onConversationsImportFromFiles } = props;
  const handleFilterAGIFile = React.useCallback(async (file: File): Promise<boolean> =>
    await showPromisedOverlay('composer-open-or-attach', { rejectWithValue: false }, ({ onResolve, onUserReject }) => (
      <ConfirmationModal
        open onClose={onUserReject}
        onPositive={() => {
          onConversationsImportFromFiles([file]);
          onResolve(true);
        }}
        title='打开对话还是作为附件？'
        positiveActionText='打开' negativeActionText='作为附件'
        confirmationText={`您想打开对话 "${file.name}" 还是将其作为附件添加到此消息中？`}
      />
    )), [onConversationsImportFromFiles, showPromisedOverlay]);

  // attachments-overlay: comes from the attachments slice of the conversation overlay
  const showChatAttachments = chatExecuteModeCanAttach(chatExecuteMode, props.capabilityHasT2IEdit);
  const {
    /* items */ attachmentDrafts,
    /* append */ attachAppendClipboardItems, attachAppendCloudFile, attachAppendDataTransfer, attachAppendEgoFragments, attachAppendFile, attachAppendUrl,
    /* take */ attachmentsRemoveAll, attachmentsTakeAllFragments, attachmentsTakeFragmentsByType,
  } = useAttachmentDrafts(conversationOverlayStore, enableLoadURLsInComposer, chatLLMSupportsImages, handleFilterAGIFile, showChatAttachments === 'only-images');

  // attachments derived state
  const llmAttachmentDraftsCollection = useLLMAttachmentDrafts(attachmentDrafts, props.chatLLM, chatLLMSupportsImages);

  // drag/drop
  const { dragContainerSx, dropComponent, handleContainerDragEnter, handleContainerDragStart } = useComposerDragDrop(!props.isMobile, attachAppendDataTransfer);

  // ai functions
  const agiAttachmentPrompts = useAgiAttachmentPrompts(useChatAutoSuggestAttachmentPrompts(), attachmentDrafts);


  // derived state

  const { composerTextAreaRef, targetConversationId, onAction, onTextImagine } = props;
  const isMobile = props.isMobile;
  const isDesktop = !props.isMobile;
  const noConversation = !targetConversationId;

  const composerTextSuffix = (composeText.startsWith('/draw') || composeText.startsWith('/imagine')) && isDesktop && drawRepeat > 1 ? ` x${drawRepeat}` : '';




  // tokens derived state

  const tokensComposerTextDebounced = useTextTokenCount(composeText, props.chatLLM, 800, 1600);
  let tokensComposer = (tokensComposerTextDebounced ?? 0) + (llmAttachmentDraftsCollection.llmTokenCountApprox || 0);
  if (props.chatLLM && tokensComposer > 0)
    tokensComposer += glueForMessageTokens(props.chatLLM);
  const tokensHistory = _historyTokenCount;
  const tokensResponseMax = getModelParameterValueOrThrow('llmResponseTokens', props.chatLLM?.initialParameters, props.chatLLM?.userParameters, 0) ?? 0;
  const tokenLimit = getLLMContextTokens(props.chatLLM) ?? 0;
  const tokenChatPricing = getLLMPricing(props.chatLLM)?.chat;


  // Effect: load initial text if queued up (e.g. by /link/share_targetF)
  React.useEffect(() => {
    if (startupText) {
      setStartupText(null);
      setComposeText(startupText);
    }
  }, [setComposeText, setStartupText, startupText]);

  // Effect: notify the parent of presence/absence of content
  const isContentful = composeText.length > 0 || !!attachmentDrafts.length;
  const { onComposerHasContent } = props;
  React.useEffect(() => {
    onComposerHasContent?.(isContentful);
  }, [isContentful, onComposerHasContent]);


  // Overlay actions

  const handleRemoveInReferenceTo = React.useCallback((item: DMetaReferenceItem) => {
    conversationOverlayStore?.getState().removeInReferenceTo(item);
  }, [conversationOverlayStore]);

  const handleInReferenceToClear = React.useCallback(() => {
    conversationOverlayStore?.getState().clearInReferenceTo();
  }, [conversationOverlayStore]);

  React.useEffect(() => {
    if (inReferenceTo?.length)
      setTimeout(() => composerTextAreaRef.current?.focus(), 1 /* prevent focus theft */);
  }, [composerTextAreaRef, inReferenceTo]);


  // Confirmation Modals

  const confirmProceedIfAttachmentsNotSupported = React.useCallback(async (): Promise<boolean> => {
    if (llmAttachmentDraftsCollection.canAttachAllFragments) return true;
    return await showPromisedOverlay('composer-unsupported-attachments', { rejectWithValue: false }, ({ onResolve, onUserReject }) => (
      <ConfirmationModal
        open
        onClose={onUserReject}
        onPositive={() => onResolve(true)}
        confirmationText='某些附件可能与当前的 AI 模型不完全兼容。这可能会影响处理。您想检查一下还是继续？'
        positiveActionText='继续'
        negativeActionText='检查附件'
        title='附件兼容性提示'
      />
    ));
  }, [llmAttachmentDraftsCollection.canAttachAllFragments, showPromisedOverlay]);


  // Primary button

  const _handleClearText = React.useCallback(() => {
    setComposeText('');
    attachmentsRemoveAll();
    handleInReferenceToClear();
  }, [attachmentsRemoveAll, handleInReferenceToClear, setComposeText]);

  const _handleSendActionUnguarded = React.useCallback(async (_chatExecuteMode: ChatExecuteMode, composerText: string): Promise<boolean> => {
    // Basic validation
    if (!props.targetConversationId || !isValidConversation(props.targetConversationId)) {
      // If the passed ID is invalid, we still try to proceed as AppChat.tsx has a fallback mechanism,
      // but we log it if it's totally missing.
      if (!props.targetConversationId && !isValidConversation(props.targetConversationId)) {
        addSnackbar({ key: 'chat-invalid-id', message: '对话状态同步中，请稍后...', type: 'info' });
        // return false; // We don't return false here to let AppChat try its fallback
      }
    }

    // await user confirmation (or rejection) if attachments are not supported
    if (!await confirmProceedIfAttachmentsNotSupported()) return false;

    // validate some chat mode inputs
    const isDraw = composerText.startsWith('/draw') || composerText.startsWith('/imagine');
    const isBlank = !composerText.trim();
    if (isDraw && isBlank) {
      addSnackbar({ key: 'chat-draw-empty', message: '请输入描述以生成图像。', type: 'info' });
      return false;
    }

    // prepare the fragments: content (if any) and attachments (if allowed, and any)
    const fragments: (DMessageContentFragment | DMessageAttachmentFragment)[] = [];
    if (composerText)
      fragments.push(createTextContentFragment(composerText + composerTextSuffix));

    const canAttach = chatExecuteModeCanAttach(_chatExecuteMode, props.capabilityHasT2IEdit);
    if (canAttach) {
      const attachmentFragments = await attachmentsTakeAllFragments('global', 'app-chat');
      fragments.push(...attachmentFragments);
    }

    if (!fragments.length) {
      // addSnackbar({ key: 'chat-composer-empty', message: 'Please enter a message or attach files.', type: 'info' });
      return false;
    }

    // prepare the metadata
    const metadata = inReferenceTo?.length ? { inReferenceTo: inReferenceTo } : undefined;

    // send the message - NOTE: if successful, the ownership of the fragments is transferred to the receiver, so we just clear them
    const enqueued = onAction(props.targetConversationId!, _chatExecuteMode, fragments, metadata);
    if (enqueued)
      _handleClearText();
    return enqueued;
  }, [props.targetConversationId, confirmProceedIfAttachmentsNotSupported, composerTextSuffix, props.capabilityHasT2IEdit, inReferenceTo, onAction, _handleClearText, attachmentsTakeAllFragments]);

  const handleSendAction = React.useCallback(async (chatExecuteMode: ChatExecuteMode, composerText: string): Promise<boolean> => {
    setSendStarted(true);
    const enqueued = await _handleSendActionUnguarded(chatExecuteMode, composerText);
    setSendStarted(false);
    return enqueued;
  }, [_handleSendActionUnguarded, setSendStarted]);




  // Other send actins

  const handleAppendTextAndSend = React.useCallback(async (appendText: string) => {
    const newText = composeText ? `${composeText} ${appendText}` : appendText;
    setComposeText(newText);
    await handleSendAction(chatExecuteMode, newText);
  }, [chatExecuteMode, composeText, handleSendAction, setComposeText]);


  const handleSendClicked = React.useCallback(async () => {
    await handleSendAction(chatExecuteMode, composeText); // 'chat/write/...' button
  }, [chatExecuteMode, composeText, handleSendAction]);

  const handleSendReActClicked = React.useCallback(async () => {
    if (composeText) {
      await handleSendAction('react-content', composeText); // 'ReAct' quick button
    }
  }, [composeText, handleSendAction]);

  const handleSendTextBeamClicked = React.useCallback(async () => {
    if (composeText) {
      await handleSendAction('beam-content', composeText); // 'beam' button
    } else {
      if (targetConversationId)
        void onConversationBeamEdit(targetConversationId); // beam-edit conversation
    }
  }, [composeText, handleSendAction, onConversationBeamEdit, targetConversationId]);

  const handleStopClicked = React.useCallback(() => {
    targetConversationId && abortConversationTemp(targetConversationId);
  }, [abortConversationTemp, targetConversationId]);


  // Secondary buttons


  const handleDrawOptionsClicked = React.useCallback(() => optimaOpenPreferences('draw'), []);

  const handleTextImagineClicked = React.useCallback(() => {
    if (!composeText || !targetConversationId) return;
    onTextImagine(targetConversationId, composeText);
    setComposeText('');
  }, [composeText, onTextImagine, setComposeText, targetConversationId]);


  // Actiles

  const onActileCommandPaste = React.useCallback(({ label }: ActileItem, searchPrefix: string) => {
    if (composerTextAreaRef.current) {
      const textArea = composerTextAreaRef.current;
      const currentText = textArea.value;
      const cursorPos = textArea.selectionStart;

      // Find the position where the command starts
      const commandStart = currentText.lastIndexOf(searchPrefix, cursorPos);

      // Construct the new text with the autocompleted command
      setComposeText((prevText) => prevText.substring(0, commandStart) + label + ' ' + prevText.substring(cursorPos));

      // Schedule setting the cursor position after the state update
      const newCursorPos = commandStart + label.length + 1;
      setTimeout(() => composerTextAreaRef.current?.setSelectionRange(newCursorPos, newCursorPos), 0);
    }
  }, [composerTextAreaRef, setComposeText]);

  const onActileEmbedMessage = React.useCallback(async ({ conversationId, messageId }: StarredMessageItem) => {
    // get the message
    const cHandler = ConversationsManager.getHandler(conversationId);
    const messageToEmbed = cHandler.historyFindMessageOrThrow(messageId);
    if (messageToEmbed) {
      const fragmentsCopy = duplicateDMessageFragments(messageToEmbed.fragments, true); // [attach] deep copy a message's fragments to attach to ego
      if (fragmentsCopy.length) {
        const chatTitle = cHandler.title() ?? '';
        const messageText = messageFragmentsReduceText(fragmentsCopy);
        const label = `${chatTitle} > ${messageText.slice(0, 10)}...`;
        await attachAppendEgoFragments(fragmentsCopy, label, chatTitle, conversationId, messageId);
      }
    }
  }, [attachAppendEgoFragments]);


  const actileProviders = React.useMemo(() => [
    providerAttachmentLabels(conversationOverlayStore, onActileCommandPaste),
    providerCommands(onActileCommandPaste),
    providerStarredMessages(onActileEmbedMessage),
  ], [conversationOverlayStore, onActileCommandPaste, onActileEmbedMessage]);

  const { actileComponent, actileInterceptKeydown, actileInterceptTextChange } = useActileManager(actileProviders, composerTextAreaRef);


  // Type...

  const handleTextareaTextChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setComposeText(e.target.value);
    isMobile && actileInterceptTextChange(e.target.value);
  }, [actileInterceptTextChange, isMobile, setComposeText]);

  const handleTextareaKeyDown = React.useCallback(async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // disable keyboard handling if the actile is visible
    if (actileInterceptKeydown(e))
      return;

    // Enter: primary action
    if (e.key === 'Enter') {
      // Skip if composing (e.g., CJK input methods) - issue #784
      if (e.nativeEvent.isComposing)
        return;

      // Alt (Windows) or Option (Mac) + Enter: append the message instead of sending it
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        if (await handleSendAction('append-user', composeText)) // 'alt+enter' -> write
          touchAltEnter();
        return e.preventDefault();
      }

      // Ctrl (Windows) or Command (Mac) + Enter: send for beaming
      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        if (await handleSendAction('beam-content', composeText)) { // 'ctrl+enter' -> beam
          touchCtrlEnter();
          e.stopPropagation();
        }
        return e.preventDefault();
      }

      // Shift: toggles the 'enter is newline'
      if (e.shiftKey)
        touchShiftEnter();
      if (enterIsNewline ? e.shiftKey : !e.shiftKey) {
        if (!assistantAbortible)
          await handleSendAction('generate-content', composeText); // Always normal send on Enter
        return e.preventDefault();
      }
    }

  }, [actileInterceptKeydown, assistantAbortible, composeText, enterIsNewline, handleSendAction, touchAltEnter, touchCtrlEnter, touchShiftEnter]);


  // Focus mode

  // const handleFocusModeOn = React.useCallback(() => setIsFocusedMode(true), [setIsFocusedMode]);

  // const handleFocusModeOff = React.useCallback(() => setIsFocusedMode(false), [setIsFocusedMode]);

  // useMediaSessionCallbacks({ play: toggleRecognition, pause: toggleRecognition });


  // Minimize

  const handleToggleMinimized = React.useCallback(() => setIsMinimized(hide => !hide), []);


  // Attachment Up

  const handleAttachCtrlV = React.useCallback(async (event: React.ClipboardEvent) => {
    if (await attachAppendDataTransfer(event.clipboardData, 'paste', false) === 'as_files')
      event.preventDefault();
  }, [attachAppendDataTransfer]);

  const handleAttachCameraImage = React.useCallback((file: FileWithHandle) => {
    void attachAppendFile('camera', file);
  }, [attachAppendFile]);

  const { openCamera, cameraCaptureComponent } = useCameraCaptureModalDialog(handleAttachCameraImage);

  const handleAttachScreenCapture = React.useCallback((file: File) => {
    void attachAppendFile('screencapture', file);
  }, [attachAppendFile]);

  const handleAttachFiles = React.useCallback(async (files: FileWithHandle[], errorMessage: string | null) => {
    if (errorMessage)
      addSnackbar({ key: 'attach-files-open-fail', message: `无法打开文件：${errorMessage}`, type: 'issue' });
    for (let file of files)
      await attachAppendFile('file-open', file)
        .catch((error: any) => addSnackbar({ key: 'attach-file-open-fail', message: `无法添加文件 "${file.name}" (${error?.message || error?.toString() || '未知错误'})`, type: 'issue' }));
  }, [attachAppendFile]);


  const { openGoogleDrivePicker, googleDrivePickerComponent } = useGoogleDrivePicker(attachAppendCloudFile, isMobile);


  // Attachments Down

  const handleAttachmentDraftsAction = React.useCallback((attachmentDraftIdOrAll: AttachmentDraftId | null, action: LLMAttachmentDraftsAction) => {
    switch (action) {
      case 'copy-text':
        const copyFragments = attachmentsTakeFragmentsByType('doc', attachmentDraftIdOrAll, false);
        const copyString = marshallWrapDocFragments(null, copyFragments, false, '\n\n---\n\n');
        copyToClipboard(copyString, attachmentDraftIdOrAll ? 'Attachment Text' : 'Attachments Text');
        break;
      case 'inline-text':
        const inlineFragments = attachmentsTakeFragmentsByType('doc', attachmentDraftIdOrAll, true);
        setComposeText(currentText => marshallWrapDocFragments(currentText, inlineFragments, 'markdown-code', '\n\n'));
        break;
    }
  }, [attachmentsTakeFragmentsByType, setComposeText]);


  // Keyboard Shortcuts

  useGlobalShortcuts('ChatComposer.Gen', React.useMemo(() => [
    ...(assistantAbortible ? [{ key: ShortcutKey.Esc, action: handleStopClicked, description: 'Stop response', level: 2 }] : []),
  ], [assistantAbortible, handleStopClicked]));

  useGlobalShortcuts('ChatComposer', React.useMemo(() => {
    const composerShortcuts: ShortcutObject[] = [];
    if (showChatAttachments) {
      composerShortcuts.push({ key: 'f', ctrl: true, shift: true, action: () => openFileForAttaching(true, handleAttachFiles), description: '添加文件' });
      if (supportsClipboardRead())
        composerShortcuts.push({ key: 'v', ctrl: true, shift: true, action: attachAppendClipboardItems, description: '添加剪贴板内容' });
      // Future: keep reactive state here to support Live Screen Capture and more
      // if (labsAttachScreenCapture && supportsScreenCapture)
      //   composerShortcuts.push({ key: 's', ctrl: true, shift: true, action: openScreenCaptureDialog, description: 'Attach Screen Capture' });
    }

    return composerShortcuts;
  }, [attachAppendClipboardItems, handleAttachFiles, showChatAttachments]));


  // ...

  const isText = chatExecuteMode === 'generate-content';
  const isTextBeam = chatExecuteMode === 'beam-content';
  const isAppend = chatExecuteMode === 'append-user';
  const isReAct = chatExecuteMode === 'react-content';
  const isDraw = composeText.startsWith('/draw') || composeText.startsWith('/imagine');

  const showChatInReferenceTo = !!inReferenceTo?.length;
  const showChatExtras = isText && !showChatInReferenceTo && !assistantAbortible && composerQuickButton !== 'off';

  const sendButtonVariant: VariantProp = (isAppend || (isMobile && isTextBeam)) ? 'outlined' : 'solid';

  const sendButtonColor: ColorPaletteProp =
    assistantAbortible ? 'warning'
      : !llmAttachmentDraftsCollection.canAttachAllFragments ? 'warning'
        : chatExecuteModeSendColor;

  const sendButtonLabel = chatExecuteModeSendLabel;

  const sendButtonIcon =
    isAppend ? <SendIcon sx={{ fontSize: 18 }} />
      : isReAct ? <PsychologyIcon />
        : isTextBeam ? <ChatBeamIcon /> /* <GavelIcon /> */
          : isDraw ? <PhPaintBrush />
            : <TelegramIcon />;

  const beamButtonColor: ColorPaletteProp | undefined =
    !llmAttachmentDraftsCollection.canAttachAllFragments ? 'warning'
      : undefined;

  const showTint: ColorPaletteProp | undefined = isDraw ? 'warning' : isReAct ? 'success' : undefined;

  // stable randomization of the /verb, between '/draw', '/react'
  const placeholderAction = React.useMemo(() => {
    const actions: string[] = ['/react'];
    if (props.capabilityHasT2I) actions.push('/draw');
    return actions[Math.floor(Math.random() * actions.length)];
  }, [props.capabilityHasT2I]);

  let textPlaceholder: string =
    isDraw ? '描述你想看到的内容...'
      : isReAct ? '提问多步推理问题...'
        : isTextBeam ? '结合多个 AI 模型的见解...'
          : showChatInReferenceTo ? '关于此内容聊天...'
              : '有什么可以帮您的？';

  if (isDesktop && timeToShowTips && !isDraw) {
    if (explainShiftEnter)
      textPlaceholder += !enterIsNewline ? '\n\n⏎ Shift + Enter 换行' : '\n\n➤ Shift + Enter 发送';
    else if (explainCtrlEnter)
      textPlaceholder += platformAwareKeystrokes('\n\n⫷ 提示: Ctrl + Enter 启动多模型融合');
  }

  return (
    <Box
      aria-label='New Message'
      component='section'
      bgcolor={showTint ? `var(--joy-palette-${showTint}-softBg)` : themeBgAppChatComposer}
      sx={[...(props.sx ? (Array.isArray(props.sx) ? props.sx : [props.sx]) : []), { 
        position: 'relative',
        backgroundColor: 'transparent',
        backdropFilter: 'blur(12px)',
        zIndex: 10,
        // (Moved transform to inner container for button persistence)
      }]}
    >

      {/* Main Content Area: Fades out and disables interaction when collapsed */}
      <Box sx={{
        // Animation
        transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        transform: props.isCollapsed ? 'translateY(calc(100% + 1.5rem))' : 'translateY(0)',
        opacity: props.isCollapsed ? 0 : 1,
        pointerEvents: props.isCollapsed ? 'none' : 'auto',
      }}>
          
        {/* Padding container of the whole composer */}
        <Box sx={{
          maxWidth: { xs: '100%', md: '60vw' },
          mx: 'auto',
          px: { xs: 0.5, md: 2 },
          pb: { xs: 1.5, md: 2.5 }, // Consistent with bottom: 2.5rem for handle
        }}>
          <Box sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: mode === 'dark' ? 'background.level2' : '#ffffff',
            borderRadius: { xs: '1.25rem', md: '2rem' },
            border: '1px solid',
            borderColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)',
            boxShadow: mode === 'dark' ? '0 4px 20px -4px rgba(0,0,0,0.5)' : '0 8px 32px -8px rgba(0,0,0,0.08)',
            p: { xs: 0.75, md: 2 },
            transition: 'all 0.2s ease',
            '&:focus-within': {
              borderColor: mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              boxShadow: mode === 'dark' ? '0 8px 32px -8px rgba(0,0,0,0.6)' : '0 12px 48px -12px rgba(0,0,0,0.12)',
              outline: 'none !important',
            },
            '&:focus, &:active, &:focus-visible': {
              outline: 'none !important',
              boxShadow: 'none !important',
            },
            ...dragContainerSx,
          }}>
            
            {/* Top Row: Attachment Drafts */}
            {!!conversationOverlayStore && showChatAttachments && (
                <LLMAttachmentsList
                  agiAttachmentPrompts={agiAttachmentPrompts}
                  attachmentDraftsStoreApi={conversationOverlayStore}
                  canInlineSomeFragments={llmAttachmentDraftsCollection.canInlineSomeFragments}
                  llmAttachmentDrafts={llmAttachmentDraftsCollection.llmAttachmentDrafts}
                  onAttachmentDraftsAction={handleAttachmentDraftsAction}
                />
            )}

            {/* Main Input Area */}
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              
              <Textarea
                variant='plain'
                autoFocus={isDesktop}
                minRows={1}
                maxRows={isMobile ? 8 : 12}
                placeholder={textPlaceholder}
                value={composeText}
                onChange={handleTextareaTextChange}
                onKeyDown={handleTextareaKeyDown}
                onPasteCapture={handleAttachCtrlV}
                slotProps={{
                  textarea: {
                    ref: composerTextAreaRef,
                    sx: {
                      p: 1,
                      lineHeight: 1.5,
                      fontSize: '1.1rem',
                    }
                  }
                }}
                sx={{
                  '--Textarea-focusedHighlight': 'transparent !important',
                  backgroundColor: 'transparent',
                  '&:focus-within': {
                    outline: 'none !important',
                    boxShadow: 'none !important',
                  },
                  '& textarea:focus': {
                     outline: 'none !important',
                     boxShadow: 'none !important',
                  }
                }}
              />

              {/* Bottom Controls Row (Internal) */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                   {showChatAttachments && (
                      <IconButton variant="plain" color="neutral" sx={{ borderRadius: '50%' }} onClick={() => openFileForAttaching(true, handleAttachFiles)}>
                          <AddIcon />
                      </IconButton>
                   )}

                   {/* Persona Selector — subtle icon button next to attachment button */}
                   <Box sx={{ position: 'relative' }}>
                     <IconButton
                       variant="plain"
                       color="neutral"
                       size="sm"
                       onClick={() => personaDropdownRef.current?.openListbox()}
                       sx={{
                         borderRadius: '50%',
                         opacity: 0.55,
                         '&:hover': { opacity: 1 },
                         transition: 'opacity 0.2s',
                       }}
                     >
                       <TuneIcon sx={{ fontSize: '1rem' }} />
                     </IconButton>
                     {/* Hidden Dropdown Anchor — portal-like, opens from this position */}
                     <Box sx={{ width: 0, height: 0, overflow: 'hidden', visibility: 'hidden', position: 'absolute' }}>
                       {personaDropdown}
                     </Box>
                   </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

                    {!composeText && !attachmentDrafts.length ? null : (
                      !assistantAbortible ? (
                        <Dropdown>
                          <ButtonGroup variant="solid" color={chatExecuteModeSendColor} sx={{ borderRadius: '1.25rem', overflow: 'hidden', minHeight: 40 }}>
                            <IconButton
                              disabled={noConversation}
                              loading={sendStarted}
                              onClick={() => handleSendAction(chatExecuteMode, composeText)}
                              sx={{ px: 2, minWidth: 54 }}
                            >
                              <ArrowUpwardIcon sx={{ fontSize: '1.7rem' }} />
                            </IconButton>
                            <MenuButton
                              slots={{ root: IconButton }}
                              slotProps={{ root: { variant: 'solid', color: chatExecuteModeSendColor, sx: { borderRadius: 0, minWidth: 20, px: 0.25, borderLeft: '1px solid rgba(255,255,255,0.2)' } } }}
                            >
                              <KeyboardArrowDownIcon sx={{ fontSize: '0.85rem' }} />
                            </MenuButton>
                          </ButtonGroup>
                          <Menu placement="top-end" sx={{ minWidth: 180 }}>
                            <MenuItem onClick={() => { setChatExecuteMode('generate-content'); handleSendAction('generate-content', composeText); }}>
                              <ArrowUpwardIcon /> 发送 (普通)
                            </MenuItem>
                            <MenuItem onClick={() => { setChatExecuteMode('react-content'); handleSendAction('react-content', composeText); }}>
                              <PsychologyIcon /> 深度思考 (ReAct)
                            </MenuItem>
                            <MenuItem onClick={() => { setChatExecuteMode('beam-content'); handleSendAction('beam-content', composeText); }}>
                              <GraphicEqIcon /> 多模型聚合 (Beam)
                            </MenuItem>
                          </Menu>
                        </Dropdown>
                      ) : (
                        <IconButton
                          variant="solid"
                          color="warning"
                          onClick={handleStopClicked}
                          sx={{ 
                            borderRadius: '50%',
                            width: 34,
                            height: 34,
                            minHeight: 34,
                          }}
                        >
                          <StopOutlinedIcon sx={{ fontSize: '1.2rem' }} />
                        </IconButton>
                      )
                    )}
                </Box>
              </Box>
            </Box>

            {/* In-Reference-To Overlay */}
            <Box sx={{ px: 1 }}>
              {isDraw
                ? <ComposerTextAreaDrawActions
                  composerText={composeText}
                  onReplaceText={setComposeText}
                />
                : <ComposerTextAreaActions
                  agiAttachmentPrompts={agiAttachmentPrompts}
                  inReferenceTo={inReferenceTo}
                  onAppendAndSend={handleAppendTextAndSend}
                  onRemoveReferenceTo={handleRemoveInReferenceTo}
                />
              }
            </Box>

            {dropComponent}
          </Box>

          {/* Footer actions like Draw options */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1, opacity: 0.6, height: props.isCollapsed ? 0 : 'auto', overflow: 'hidden' }}>
             {isDraw && (
               <ButtonOptionsDraw onClick={handleDrawOptionsClicked} />
             )}
          </Box>
        </Box>
      </Box>

      {/* Collapse/Expand Toggle Handle (Pill style) - Persistent relative to root */}
      {!isChatEmpty && (
        <IconButton
          size="sm"
          variant="soft"
          color="neutral"
          onClick={() => props.setIsCollapsed(!props.isCollapsed)}
          sx={{
            position: 'absolute',
            bottom: '0.25rem', // Fixed position at bottom of the root Box
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            borderRadius: '2rem',
            width: 44,
            height: 12,
            minHeight: 12,
            backgroundColor: mode === 'dark' ? 'background.level3' : '#ffffff',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            opacity: props.isCollapsed ? 1 : 0.6,
            '&:hover': {
              backgroundColor: 'neutral.softBg',
              opacity: 1,
              height: 16,
            },
            transition: 'all 0.3s',
            p: 0,
            pointerEvents: 'auto', 
          }}
        >
          {props.isCollapsed 
            ? <KeyboardArrowUpIcon sx={{ fontSize: '1rem', opacity: 0.8 }} /> 
            : <Box sx={{ width: 16, height: 2, borderRadius: '2px', bgcolor: 'neutral.softColor', opacity: 0.4 }} />
          }
        </IconButton>
      )}

      {/* Portals and overlays */}
      {chatExecuteMenuComponent}
      {cameraCaptureComponent}
      {googleDrivePickerComponent}
      {actileComponent}

    </Box>
  );
}