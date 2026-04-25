import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Avatar, Box, Button, Card, CardContent, Checkbox, IconButton, Input, List, ListItem, ListItemButton, Textarea, Tooltip, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import DoneIcon from '@mui/icons-material/Done';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SearchIcon from '@mui/icons-material/Search';
import TelegramIcon from '@mui/icons-material/Telegram';

import { SystemPurposeData, SystemPurposeExample, SystemPurposeId, SystemPurposes } from '../../../../data';

import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { createDMessageTextContent } from '~/common/stores/chat/chat.message';
import { lineHeightTextareaMd } from '~/common/app.theme';
import { navigateToPersonas } from '~/common/app.routes';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useChipBoolean } from '~/common/components/useChipBoolean';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { usePurposeStore } from './store-purposes';


// 'special' purpose IDs, for tile hiding purposes
const PURPOSE_ID_PERSONA_CREATOR = '__persona-creator__';
const TILE_ACTIVE_COLOR = 'primary' as const;

// defined looks
const tileSize = 7; // rem
const tileGap = 0.5; // rem


function Tile(props: {
  text?: string,
  imageUrl?: string,
  symbol?: string,
  isActive: boolean,
  isEditMode: boolean,
  isHidden?: boolean,
  isHighlighted?: boolean,
  onClick: () => void,
  sx?: SxProps,
}) {
  return (
    <Button
      variant={(!props.isEditMode && props.isActive) ? 'solid' : props.isHighlighted ? 'soft' : 'soft'}
      color={(!props.isEditMode && props.isActive) ? 'primary' : props.isHighlighted ? 'primary' : TILE_ACTIVE_COLOR}
      onClick={props.onClick}
      sx={{
        aspectRatio: 1,
        height: `${tileSize}rem`,
        fontWeight: 'md',
        lineHeight: 'xs',
        paddingInline: 0.5,
        borderRadius: '2px', // Sharper corners for Blueprint theme
        border: props.isActive ? '2px solid' : '1px solid',
        borderColor: props.isActive ? 'primary.solidBg' : 'divider',
        ...((props.isEditMode || !props.isActive) ? {
          boxShadow: props.isActive 
            ? `0 0 12px 0px var(--joy-palette-primary-mainChannel, 0.5)`
            : `0 2px 8px -3px rgb(var(--joy-palette-${TILE_ACTIVE_COLOR}-darkChannel) / 30%)`,
          backgroundColor: props.isHighlighted ? undefined : 'background.surface',
        } : {}),
        flexDirection: 'column', gap: props.symbol === '🎭' ? 0.5 : 1.25, pt: 1.25,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 'md',
          borderColor: 'primary.plainColor',
        },
        ...props.sx,
      }}
    >
      {/* [Edit mode checkbox] */}
      {props.isEditMode && (
        <Checkbox
          variant='soft' color={TILE_ACTIVE_COLOR}
          checked={!props.isHidden}
          sx={{ position: 'absolute', left: `${tileGap}rem`, top: `${tileGap}rem` }}
        />
      )}

      <Avatar
        variant='plain'
        src={props.imageUrl}
        sx={{
          '--Avatar-size': '3rem',
          fontSize: '2rem',
          borderRadius: props.imageUrl ? '2px' : 0,
          boxShadow: (props.imageUrl && !props.isActive) ? 'sm' : undefined,
        }}
      >
        {props.symbol}
      </Avatar>
      <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
        {props.text}
      </div>
    </Button>
  );
}


/**
 * Purpose selector for the current chat. Clicking on any item activates it for the current chat.
 */
export function PersonaSelector(props: {
  conversationId: DConversationId,
  isMobile: boolean,
  runExample: (example: SystemPurposeExample) => void,
}) {

  // state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filteredIDs, setFilteredIDs] = React.useState<SystemPurposeId[] | null>(null);
  const [editMode, setEditMode] = React.useState(false);


  // external state
  const { complexityMode, showPersonaFinder } = useUIPreferencesStore(useShallow(state => ({
    complexityMode: state.complexityMode,
    showPersonaFinder: state.showPersonaFinder,
  })));
  const [showExamples, showExamplescomponent] = useChipBoolean('示例', complexityMode === 'extra' && !props.isMobile);
  const [showPrompt, showPromptComponent] = useChipBoolean('提示词', false);
  const { systemPurposeId, setSystemPurposeId } = useChatStore(useShallow(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      systemPurposeId: conversation ? conversation.systemPurposeId : null,
      setSystemPurposeId: conversation ? state.setSystemPurposeId : null,
    };
  }));
  const { hiddenPurposeIDs, toggleHiddenPurposeId } = usePurposeStore(useShallow(state => ({
    hiddenPurposeIDs: state.hiddenPurposeIDs,
    toggleHiddenPurposeId: state.toggleHiddenPurposeId,
  })));
  const { domainModelId: chatLLMId } = useModelDomain('primaryChat');
  const chatLLM = { id: chatLLMId ?? undefined }; // adapter for porting


  // derived state

  const isCustomPurpose = systemPurposeId === 'Custom';

  const { selectedPurpose, fourExamples } = React.useMemo(() => {
    const selectedPurpose: SystemPurposeData | null = systemPurposeId ? (SystemPurposes[systemPurposeId] ?? null) : null;
    // const selectedExample = selectedPurpose?.examples?.length
    //   ? selectedPurpose.examples[Math.floor(Math.random() * selectedPurpose.examples.length)]
    //   : null;
    const fourExamples = selectedPurpose?.examples?.slice(0, 4) ?? null;
    return { selectedPurpose, fourExamples };
  }, [systemPurposeId]);


  const unfilteredPurposeIDs = (filteredIDs && showPersonaFinder) ? filteredIDs : Object.keys(SystemPurposes) as SystemPurposeId[];
  const visiblePurposeIDs = editMode ? unfilteredPurposeIDs : unfilteredPurposeIDs.filter(id => !hiddenPurposeIDs.includes(id));
  const hidePersonaCreator = hiddenPurposeIDs.includes(PURPOSE_ID_PERSONA_CREATOR);


  // Handlers

  const handlePurposeChanged = React.useCallback((purposeId: SystemPurposeId | null) => {
    if (purposeId && setSystemPurposeId)
      setSystemPurposeId(props.conversationId, purposeId);
  }, [props.conversationId, setSystemPurposeId]);


  const handleCustomSystemMessageChange = React.useCallback((v: React.ChangeEvent<HTMLTextAreaElement>): void => {
    // TODO: persist this change? Right now it's reset every time.
    //       maybe we shall have a "save" button just save on a state to persist between sessions
    SystemPurposes['Custom'].systemMessage = v.target.value;
  }, []);

  const handleSwitchToCustom = React.useCallback((customText: string) => {
    if (setSystemPurposeId) {
      SystemPurposes['Custom'].systemMessage = customText;
      setSystemPurposeId(props.conversationId, 'Custom');
    }
  }, [props.conversationId, setSystemPurposeId]);

  const toggleEditMode = React.useCallback(() => setEditMode(on => !on), []);


  // Search (filtering)

  const handleSearchClear = React.useCallback(() => {
    setSearchQuery('');
    setFilteredIDs(null);
  }, []);

  const handleSearchOnChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    if (!query)
      return handleSearchClear();

    // Filter results based on search term (title and description)
    const lcQuery = query.toLowerCase();
    const ids = (Object.keys(SystemPurposes) as SystemPurposeId[])
      .filter(key => SystemPurposes.hasOwnProperty(key))
      .filter(key => {
        const purpose = SystemPurposes[key as SystemPurposeId];
        return purpose.title.toLowerCase().includes(lcQuery)
          || (typeof purpose.description === 'string' && purpose.description.toLowerCase().includes(lcQuery));
      });

    setSearchQuery(query);
    setFilteredIDs(ids);

    // If there's a search term, activate the first item
    // if (ids.length && systemPurposeId && !ids.includes(systemPurposeId))
    //   handlePurposeChanged(ids[0] as SystemPurposeId);
  }, [handleSearchClear]);

  const handleSearchOnKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key == 'Escape')
      handleSearchClear();
  }, [handleSearchClear]);


  // safety check - shouldn't happen - this is set to null when the conversation is not found
  if (!setSystemPurposeId)
    return null;


  return (
    <Box sx={{
      maxWidth: 'md',
      minWidth: `${2 + 1 + tileSize * 2}rem`, // accomodate at least 2 columns (scroll-x in case)
      mx: 'auto',
      minHeight: '90%', // was 60svh - looked too big on desktop stacked
      display: 'grid',
      px: { xs: 0.5, sm: 1, md: 2 },
      py: 2,
    }}>

      {showPersonaFinder && <Box>
        <Input
          fullWidth
          variant='outlined' color='neutral'
          value={searchQuery} onChange={handleSearchOnChange}
          onKeyDown={handleSearchOnKeyDown}
          placeholder='搜索...'
          startDecorator={<SearchIcon />}
          endDecorator={searchQuery && (
            <IconButton onClick={handleSearchClear}>
              <ClearIcon />
            </IconButton>
          )}
          sx={{
            boxShadow: 'sm',
          }}
        />
      </Box>}


      <Box sx={{
        my: 'auto',
        // layout
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${tileSize}rem, ${tileSize}rem))`,
        justifyContent: 'center', gap: `${tileGap}rem`,
      }}>

        {/* [row 0] ...  Edit mode [ ] */}
        <Box sx={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Typography level='title-sm'>
            AI 角色
          </Typography>
          <Tooltip disableInteractive title={editMode ? '完成编辑' : '编辑布局'}>
            <IconButton size='sm' onClick={toggleEditMode} sx={{ my: '-0.25rem' /* absorb the button padding */ }}>
              {editMode ? <DoneIcon /> : <EditRoundedIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Personas Tiles */}
        {visiblePurposeIDs.map((spId: SystemPurposeId) => {
          const isActive = systemPurposeId === spId;
          const systemPurpose = SystemPurposes[spId];
          return (
            <Tile
              key={'tile-' + spId}
              text={systemPurpose?.title}
              imageUrl={systemPurpose?.imageUri}
              symbol={systemPurpose?.symbol}
              isActive={isActive}
              isEditMode={editMode}
              isHidden={hiddenPurposeIDs.includes(spId)}
              isHighlighted={systemPurpose?.highlighted}
              onClick={() => editMode ? toggleHiddenPurposeId(spId) : handlePurposeChanged(spId)}
            />
          );
        })}

        {/* Persona Creator Tile */}
        {(editMode || !hidePersonaCreator) && (
          <Tile
            text='角色创建'
            symbol='🎭'
            isActive={false}
            isEditMode={editMode}
            isHidden={hidePersonaCreator}
            onClick={() => editMode ? toggleHiddenPurposeId(PURPOSE_ID_PERSONA_CREATOR) : void navigateToPersonas()}
            sx={{
              fontSize: 'xs',
              boxShadow: 'xs',
              backgroundColor: 'neutral.softDisabledBg',
            }}
          />
        )}


        {/* [row -3] Description */}
        <Box sx={{ gridColumn: '1 / -1', mt: 3, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>

          {/* Description*/}
          <Typography level='body-sm' sx={{ color: 'text.primary' }}>
            {!selectedPurpose
              ? '无法找到以前的角色' + (systemPurposeId ? ` "${systemPurposeId}"` : '')
              : selectedPurpose?.description || '暂无描述'}
          </Typography>

          {/* Examples/Prompt Toggles */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {fourExamples && showExamplescomponent}
            {!isCustomPurpose && showPromptComponent}
          </Box>

        </Box>

        {/* [row -3] Example incipits */}
        {systemPurposeId !== 'Custom' && (
          <ExpanderControlledBox expanded={showExamples || (!isCustomPurpose && showPrompt)} sx={{ gridColumn: '1 / -1', pt: 1 }}>
            {showExamples && (
              <List
                aria-label='Persona Conversation Starters'
                sx={{
                  // example items 2-col layout
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${tileSize * 3 + 1}rem, 1fr))`,
                  gap: 1,
                }}
              >
                {fourExamples?.map((example, idx) => (
                  <ListItem
                    key={idx}
                    variant='outlined'
                    sx={{
                      // padding: '0.25rem 0.5rem',
                      backgroundColor: 'background.popup',
                      borderRadius: 'md',
                      boxShadow: 'xs',
                      '& svg': { opacity: 0.1, transition: 'opacity 0.2s' },
                      '&:hover svg': { opacity: 1 },
                    }}
                  >
                    <ListItemButton onClick={() => props.runExample(example)} sx={{ justifyContent: 'space-between', borderRadius: 'md' }}>
                      <Typography level='body-sm'>
                        {/* Icon 📁 when the .action is 'require-data-attachment' */}
                        {(typeof example === 'object' && example.action === 'require-data-attachment') ? '📁 ' : ''}
                        {(typeof example === 'string') ? example : example.prompt}
                      </Typography>
                      <TelegramIcon color='primary' sx={{}} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
            {(!isCustomPurpose && showPrompt) && (
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography level='title-sm'>
                      系统提示词
                    </Typography>
                    <Button
                      variant='plain' color='neutral' size='sm'
                      endDecorator={<EditNoteIcon />}
                      onClick={() => handleSwitchToCustom(bareBonesPromptMixer(selectedPurpose?.systemMessage || 'No system message available', chatLLM?.id))}
                      sx={{ ml: 'auto', my: '-0.25rem' /* absorb the button padding */ }}
                    >
                      自定义
                    </Button>
                  </Box>
                  <Typography level='body-sm' sx={{ whiteSpace: 'break-spaces' }}>
                    {bareBonesPromptMixer(selectedPurpose?.systemMessage || '无可用系统消息', chatLLM?.id)}
                  </Typography>
                  {!!selectedPurpose?.systemMessageNotes && (
                    <Alert sx={{ m: -1, mt: 1, p: 1 }}>
                      <Typography level='body-xs'>
                        Prompt 备注: {selectedPurpose.systemMessageNotes}
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </ExpanderControlledBox>
        )}

        {/* [row -1] Custom Prompt box */}
        {systemPurposeId === 'Custom' && (
          <Textarea
            autoFocus
            variant='outlined'
            placeholder='在此编写自定义系统消息...'
            minRows={3}
            defaultValue={SystemPurposes['Custom']?.systemMessage}
            onChange={handleCustomSystemMessageChange}
            endDecorator={
              <Alert sx={{ flex: 1, p: 1 }}>
                <Typography level='body-xs'>
                  完成后直接开始聊天。
                </Typography>
              </Alert>
            }
            sx={{
              gridColumn: '1 / -1',
              backgroundColor: 'background.surface',
              '&:focus-within': {
                backgroundColor: 'background.popup',
              },
              lineHeight: lineHeightTextareaMd,
            }}
          />
        )}

      </Box>

    </Box>
  );
}