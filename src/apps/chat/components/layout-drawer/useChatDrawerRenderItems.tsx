import * as React from 'react';

import { useModuleBeamStore } from '~/modules/beam/store-module-beam';

import type { DFolder } from '~/common/stores/folders/store-chat-folders';
import { DMessage, DMessageUserFlag, MESSAGE_FLAG_STARRED, messageFragmentsReduceText, messageHasUserFlag, messageUserFlagToEmoji } from '~/common/stores/chat/chat.message';
import { conversationTitle, DConversationId } from '~/common/stores/chat/chat.conversation';
import { createTimeBucketClassifierEn } from '~/common/util/timeUtils';
import { isAttachmentFragment, isContentOrAttachmentFragment, isDocPart, isImageRefPart, isZyncAssetImageReferencePart } from '~/common/stores/chat/chat.fragments';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';
import { hasConversationMeaningfulContent, useChatStore } from '~/common/stores/chat/store-chats';

import type { ChatNavigationItemData } from './ChatDrawerItem';


// configuration
const SEARCH_MIN_CHARS = 3;


interface ChatDrawerRenderItems {
  renderNavItems: (ChatNavigationItemData | ChatNavigationGroupData | ChatNavigationInfoMessage)[];
  filteredChatIDs: DConversationId[];
  filteredChatsCount: number;
  filteredChatsAreEmpty: boolean;
  filteredChatsBarBasis: number;
  filteredChatsIncludeActive: boolean;
}

interface ChatNavigationGroupData {
  type: 'nav-item-group',
  title: string,
}

interface ChatNavigationInfoMessage {
  type: 'nav-item-info-message',
  message: string,
}

export type ChatNavGrouping = false | 'date' | 'persona' | 'dimension';

export type ChatSearchSorting = 'frequency' | 'date';

export type ChatSearchDepth = 'titles' | 'content' | 'attachments';


function messageHasDocAttachmentFragments(message: DMessage): boolean {
  return message.fragments.some(fragment => isAttachmentFragment(fragment) && isDocPart(fragment.part));
}

function messageHasImageFragments(message: DMessage): boolean {
  return message.fragments.some(fragment => isContentOrAttachmentFragment(fragment) && (
    isZyncAssetImageReferencePart(fragment.part) || isImageRefPart(fragment.part)
  ));
}

function messageHasStarredFragments(message: DMessage): boolean {
  return messageHasUserFlag(message, MESSAGE_FLAG_STARRED);
}

// Returns a string with the pane indices where the conversation is also open, or false if it's not
function findOpenInViewIndices(chatPanesConversationIds: DConversationId[], ourId: DConversationId): string | false {
  if (chatPanesConversationIds.length <= 1) return false;
  return chatPanesConversationIds.reduce((acc: string[], id, idx) => {
    if (id === ourId)
      acc.push((idx + 1).toString());
    return acc;
  }, []).join(', ') || false;
}

export function isDrawerSearching(filterByQuery: string): { isSearching: boolean, lcTextQuery: string } {
  const lcTextQuery = filterByQuery.trim().toLowerCase();
  return {
    isSearching: lcTextQuery.length >= SEARCH_MIN_CHARS,
    lcTextQuery,
  };
}


/*
 * Optimization: return a reduced version of the DConversation object for 'Drawer Items' purposes,
 * to avoid unnecessary re-renders on each new character typed by the assistant
 */
export function useChatDrawerRenderItems(
  activeConversationId: DConversationId | null,
  chatPanesConversationIds: DConversationId[],
  filterByQuery: string,
  activeFolder: DFolder | null,
  allFolders: DFolder[],
  filterHasStars: boolean,
  filterHasImageAssets: boolean,
  filterHasDocFragments: boolean,
  filterIsArchived: boolean,
  grouping: ChatNavGrouping,
  searchSorting: ChatSearchSorting,
  showRelativeSize: boolean,
  searchDepth: ChatSearchDepth,
  all?: boolean,
): ChatDrawerRenderItems {

  // state
  const [_, setJustAMinuteCounter] = React.useState(0);

  // external state
  const openBeamConversationIds = useModuleBeamStore(state => state.openBeamConversationIds);


  // [effect] Refresh every minute because the `getTimeBucketEn` function uses the current time
  React.useEffect(() => {
    const interval = setInterval(() => setJustAMinuteCounter(c => c + 1), 60 * 1000);
    return () => clearInterval(interval);
  }, []);


  const stabilizeRenderItems = React.useRef<ChatDrawerRenderItems>(undefined);

  return useChatStore(({ conversations: convPreFilter }) => {

      // filter 0: archival status
      const conversations = filterIsArchived ? convPreFilter.filter(c => !!c.isArchived)
        : convPreFilter.filter(c => !c.isArchived);

      // filter 0.5: hide blank conversations in recents/history lists
      const meaningfulConversations = conversations.filter(c => hasConversationMeaningfulContent(c));

      // filter 1: select all conversations or just the ones in the active folder
      const conversationsInFolder = !activeFolder ? meaningfulConversations
        : meaningfulConversations.filter(_c => activeFolder.conversationIds.includes(_c.id));

      // filter 2: preparation: lowercase the query
      const { isSearching, lcTextQuery } = isDrawerSearching(filterByQuery);

      // transform (the conversations into ChatNavigationItemData) + filter2 (if searching)
      const chatNavItems = conversationsInFolder
        .map((_c): ChatNavigationItemData | null => {

          // optimized reduction to find stars/images/docs/and lowercased text for search
          const messageCount = _c.messages.length;
          const messageFlags = new Set<DMessageUserFlag>();
          let lcMessageSearchText = '';
          let hasStars = false, hasImages = false, hasDocs = false;
          for (const _m of _c.messages) {
            _m.userFlags?.forEach(flag => messageFlags.add(flag));
            if (isSearching && searchDepth !== 'titles') {
              const messageText = messageFragmentsReduceText(_m.fragments, '\n', searchDepth !== 'attachments');
              if (messageText) lcMessageSearchText += messageText.toLowerCase() + '\n';
            }
            if (!hasStars && messageHasStarredFragments(_m)) hasStars = true;
            if (!hasImages && messageHasImageFragments(_m)) hasImages = true;
            if (!hasDocs && messageHasDocAttachmentFragments(_m)) hasDocs = true;
          }

          // filter for required attributes
          if ((filterHasStars && !hasStars) || (filterHasImageAssets && !hasImages) || (filterHasDocFragments && !hasDocs))
            return null;

          // rich properties
          const title = conversationTitle(_c);
          const isAlsoOpen = findOpenInViewIndices(chatPanesConversationIds, _c.id);

          // set the frequency counters if filtering is enabled
          let searchFrequency: number = 0;
          if (isSearching) {
            const titleFrequency = title.toLowerCase().split(lcTextQuery).length - 1;
            const messageFrequency = lcMessageSearchText.split(lcTextQuery).length - 1;
            searchFrequency = titleFrequency + messageFrequency;
            if (searchFrequency === 0) return null;
          }

          // union of message flags -> emoji string
          const userFlagsUnique = !messageFlags.size ? undefined
            : Array.from(messageFlags).map(messageUserFlagToEmoji).join('');

          // create the ChatNavigationData
          return {
            type: 'nav-item-chat-data',
            conversationId: _c.id,
            isActive: _c.id === activeConversationId,
            isAlsoOpen,
            isIncognito: !!_c._isIncognito,
            isEmpty: !messageCount && !_c.userTitle,
            title,
            isArchived: !!_c.isArchived,
            userSymbol: _c.userSymbol || undefined,
            userFlagsSummary: userFlagsUnique,
            containsDocAttachments: hasDocs && filterHasDocFragments, // special case: only show this icon when filtering - too many icons otherwise
            containsImageAssets: hasImages,
            folder: !allFolders.length
              ? undefined                             // don't show folder select if folders are disabled
              : _c.id === activeConversationId        // only show the folder for active conversation(s)
                ? allFolders.find(folder => folder.conversationIds.includes(_c.id)) ?? null
                : null,
            updatedAt: _c.updated || _c.created || 0,
            hasBeamOpen: !!openBeamConversationIds?.[_c.id],
            messageCount,
            beingGenerated: !!_c._abortController, // FIXME: when the AbortController is moved at the message level, derive the state in the conv
            systemPurposeId: _c.systemPurposeId,
            searchFrequency,
            lastMessageSummary: (() => {
              const lastMsg = _c.messages[_c.messages.length - 1];
              if (!lastMsg) return undefined;
              const text = messageFragmentsReduceText(lastMsg.fragments, ' ', true) || '';
              const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
              return cleanText.length > 25 ? cleanText.substring(0, 25) + '...' : cleanText;
            })() || undefined,
          };
        })
        .filter(item => !!item) as ChatNavigationItemData[];

      // check if the active conversation has an item in the list
      const filteredChatsIncludeActive = chatNavItems.some(_c => _c.conversationId === activeConversationId);


      // [sort by frequency, don't group] if there's a search query
      if (isSearching && searchSorting === 'frequency') {
        chatNavItems.sort((a, b) => b.searchFrequency - a.searchFrequency);
      } else if (!isSearching) {
        // limit to 6 recent chats as requested by the user, unless 'all' is requested
        chatNavItems.sort((a, b) => b.updatedAt - a.updatedAt);
        if (!all && chatNavItems.length > 6) {
          chatNavItems.length = 6;
        }
      }

      // Render List
      let renderNavItems: ChatDrawerRenderItems['renderNavItems'];

      // [search] add a header if searching
      if (isSearching) {

        // start growing the render array from the nav array
        renderNavItems = [...chatNavItems];

        // only prepend a 'Results' group if there are results
        if (chatNavItems.length)
          renderNavItems.unshift({
            type: 'nav-item-group',
            title: chatNavItems.length >= 10 ? `搜索结果 (${chatNavItems.length})` : chatNavItems.length > 1 ? '搜索结果' : '搜索结果',
          });

      }
      // [grouping] group by date or persona
      else if (grouping) {

        switch (grouping) {
          // [grouping/date or persona]: sort by last updated
          case 'date':
          case 'persona':
            chatNavItems.sort((a, b) => b.updatedAt - a.updatedAt);
            break;
          // [grouping/dimension]: sort by message count
          case 'dimension':
            chatNavItems.sort((a, b) => b.messageCount - a.messageCount);
            break;
        }

        const getTimeBucket = createTimeBucketClassifierEn();
        const grouped = chatNavItems.reduce((acc, item) => {

          // derive the bucket name
          let bucket: string;
          switch (grouping) {
            case 'date':
              bucket = getTimeBucket(item.updatedAt || Date.now());
              break;
            case 'persona':
              bucket = item.systemPurposeId;
              break;
            case 'dimension':
              if (item.messageCount > 20)
                bucket = '大型对话';
              else if (item.messageCount > 10)
                bucket = '中型对话';
              else if (item.messageCount > 5)
                bucket = '小型对话';
              else if (item.messageCount > 1)
                bucket = '微型对话';
              else if (item.messageCount === 1)
                bucket = '单条消息';
              else
                bucket = '空对话';
              break;
          }

          if (!acc[bucket])
            acc[bucket] = [];
          acc[bucket].push(item);
          return acc;
        }, {} as { [groupName: string]: ChatNavigationItemData[] });

        // prepend group names as special items
        renderNavItems = Object.entries(grouped).flatMap(([groupName, items]) => [
          { type: 'nav-item-group', title: groupName },
          ...items,
        ]);
      } else {

        // [no grouping & no searching] just render the chatNavItems
        // Note: we don't want to modify the original array, as we're including spurious objects for subsequent reduction functions
        renderNavItems = [...chatNavItems];

      }

      // [zero state] searching & filtering
      if (!renderNavItems.length) {
        renderNavItems.push({
          type: 'nav-item-info-message',
          message: (filterHasStars && (filterHasImageAssets || filterHasDocFragments)) ? '无结果'
            : filterHasDocFragments ? '无附件结果'
              : filterHasImageAssets ? '无图片结果'
                : filterHasStars ? '无加星结果'
                  : filterIsArchived ? '无归档对话'
                    : isSearching ? '未找到文本'
                      : '文件夹中无对话',
        });
      } else {
        // filtering reminder (will be rendered with a clear button too)
        if (filterHasStars || filterHasImageAssets || filterHasDocFragments || filterIsArchived) {
          renderNavItems.unshift({
            type: 'nav-item-info-message',
            message: `${filterIsArchived ? '显示' : '筛选条件'} ${[
              filterHasStars && '加星',
              filterHasImageAssets && '图片',
              filterHasDocFragments && '附件',
              filterIsArchived && '已归档',
            ].filter(Boolean).join(', ')}`,
          });
        }
      }

      // other derived state
      const filteredChatIDs = chatNavItems.map(_c => _c.conversationId);
      const filteredChatsCount = chatNavItems.length;
      const filteredChatsAreEmpty = !filteredChatsCount || (filteredChatsCount === 1 && chatNavItems[0].isEmpty);
      const filteredChatsBarBasis = !isSearching && (!showRelativeSize || filteredChatsCount < 2) ? 0
        : chatNavItems.reduce((longest, _c) => Math.max(longest, isSearching ? _c.searchFrequency : _c.messageCount), 1);

      // stabilize individual renderNavItems (only if in the same place)
      const prev = stabilizeRenderItems.current;
      // Update: we don't need this as <ChatDrawerItem> is already memoed
      // if (prev && renderNavItems.length === prev.renderNavItems.length)
      //   renderNavItems = renderNavItems.map((item, index) => {
      //     if (index < prev.renderNavItems.length && shallowEquals(item, prev.renderNavItems[index]))
      //       return prev.renderNavItems[index];
      //     return item;
      //   });

      // next state
      const next: ChatDrawerRenderItems = {
        renderNavItems,
        filteredChatIDs,
        filteredChatsCount,
        filteredChatsAreEmpty,
        filteredChatsBarBasis,
        filteredChatsIncludeActive,
      };

      // stabilize the render items
      if (prev
        && prev.renderNavItems.length === next.renderNavItems.length
        && prev.renderNavItems.every((_a, i) => shallowEquals(_a, next.renderNavItems[i]))
        && shallowEquals(prev.filteredChatIDs, next.filteredChatIDs)
        && prev.filteredChatsCount === next.filteredChatsCount
        && prev.filteredChatsAreEmpty === next.filteredChatsAreEmpty
        && prev.filteredChatsBarBasis === next.filteredChatsBarBasis
        && prev.filteredChatsIncludeActive === next.filteredChatsIncludeActive
      ) return prev;
      return stabilizeRenderItems.current = next;
    },
  );
}
