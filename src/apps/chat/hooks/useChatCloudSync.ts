import * as React from 'react';

import type { DConversation } from '~/common/stores/chat/chat.conversation';
import { mergeConversationsById, useChatStore } from '~/common/stores/chat/store-chats';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';
import { apiAsync } from '~/common/util/trpc.client';

const SYNC_DEBOUNCE_MS = 1500;
const PULL_INTERVAL_MS = 10000;

type ChatCloudSyncPhase = 'idle' | 'syncing' | 'synced' | 'error';

export interface ChatCloudSyncState {
  enabled: boolean;
  phase: ChatCloudSyncPhase;
  label: string;
  lastSyncedAt: number | null;
}

function toPersistableConversations(conversations: DConversation[]): DConversation[] {
  return (conversations || [])
    .filter(c => !c?._isIncognito)
    .map(c => {
      const { _abortController, ...rest } = c;
      return { ...rest, _abortController: null };
    });
}

function serializeSnapshot(conversations: DConversation[]): string {
  return JSON.stringify(toPersistableConversations(conversations));
}

function parseSnapshot(snapshot: string): DConversation[] {
  try {
    const data = JSON.parse(snapshot);
    return Array.isArray(data) ? data as DConversation[] : [];
  } catch {
    return [];
  }
}

function hasMeaningfulContent(conversations: DConversation[]): boolean {
  return (conversations || []).some(c =>
    !!c?.userTitle
    || !!c?.autoTitle
    || !!(Array.isArray(c?.messages) && c.messages.length > 0),
  );
}

export function useChatCloudSync() {
  const userId = useAuthStore(state => state.user?.id ?? null);
  const accessToken = useAuthStore(state => state.accessToken);
  const enabled = !!userId && !!accessToken;

  const [phase, setPhase] = React.useState<ChatCloudSyncPhase>('idle');
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setPhase('idle');
      return;
    }

    let alive = true;
    let initialized = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    let pullTimer: ReturnType<typeof setInterval> | null = null;
    let lastUploadedSnapshot = '';

    const setPhaseSafe = (next: ChatCloudSyncPhase) => {
      if (!alive) return;
      setPhase(next);
    };

    const markSynced = (at?: number | null) => {
      if (!alive) return;
      setPhase('synced');
      setLastSyncedAt(at || Date.now());
    };

    const clearPushTimer = () => {
      if (!pushTimer) return;
      clearTimeout(pushTimer);
      pushTimer = null;
    };

    const clearPullTimer = () => {
      if (!pullTimer) return;
      clearInterval(pullTimer);
      pullTimer = null;
    };

    const pushSnapshot = async (snapshot: string, force = false) => {
      if (!alive || !snapshot) return;
      if (!force && snapshot === lastUploadedSnapshot) return;

      const parsed = parseSnapshot(snapshot);
      if (!force && !hasMeaningfulContent(parsed))
        return;

      setPhaseSafe('syncing');
      try {
        await apiAsync.chatSync.push.mutate({
          snapshot,
          clientUpdatedAt: Date.now(),
        });
        lastUploadedSnapshot = snapshot;
        markSynced();
      } catch (error) {
        setPhaseSafe('error');
        console.warn('[chat-sync] push failed', error);
      }
    };

    const schedulePush = (snapshot: string, force = false) => {
      clearPushTimer();
      pushTimer = setTimeout(() => {
        void pushSnapshot(snapshot, force);
      }, SYNC_DEBOUNCE_MS);
    };

    const pullAndMerge = async (bootstrap = false) => {
      if (!bootstrap)
        setPhaseSafe('syncing');

      try {
        const pull = await apiAsync.chatSync.pull.query();
        if (!alive) return;

        const localConversations = useChatStore.getState().conversations;
        const remoteConversations = pull.snapshot ? parseSnapshot(pull.snapshot) : [];

        if (remoteConversations.length) {
          const merged = mergeConversationsById(localConversations, remoteConversations);
          useChatStore.getState().syncMergeConversations(merged);
        }

        const mergedConversations = useChatStore.getState().conversations;
        const mergedSnapshot = serializeSnapshot(mergedConversations);
        const pulledSnapshot = pull.snapshot || '';
        const snapshotsDiffer = !pulledSnapshot || pulledSnapshot !== mergedSnapshot;

        const mergedHasMeaningfulContent = hasMeaningfulContent(mergedConversations);
        const remoteHasMeaningfulContent = hasMeaningfulContent(remoteConversations);

        if (pulledSnapshot)
          lastUploadedSnapshot = pulledSnapshot;

        // Prevent empty local state from overwriting a meaningful remote snapshot.
        if (snapshotsDiffer && (mergedHasMeaningfulContent || !remoteHasMeaningfulContent))
          schedulePush(mergedSnapshot, true);
        else
          markSynced(pull.serverUpdatedAt || Date.now());
      } catch (error) {
        setPhaseSafe('error');
        console.warn('[chat-sync] pull failed', error);
      } finally {
        if (bootstrap)
          initialized = true;
      }
    };

    void pullAndMerge(true);
    pullTimer = setInterval(() => {
      void pullAndMerge(false);
    }, PULL_INTERVAL_MS);

    const unsubscribe = useChatStore.subscribe((state) => {
      if (!initialized || !alive) return;

      if (!hasMeaningfulContent(state.conversations))
        return;

      const snapshot = serializeSnapshot(state.conversations);
      if (!snapshot || snapshot === lastUploadedSnapshot) return;
      schedulePush(snapshot);
    });

    return () => {
      alive = false;
      clearPushTimer();
      clearPullTimer();
      unsubscribe();
    };
  }, [enabled, userId, accessToken]);

  return React.useMemo<ChatCloudSyncState>(() => {
    const label = phase === 'syncing'
      ? '同步中...'
      : phase === 'synced'
        ? '已同步'
        : phase === 'error'
          ? '同步失败'
          : '未同步';

    return {
      enabled,
      phase,
      label,
      lastSyncedAt,
    };
  }, [enabled, phase, lastSyncedAt]);
}
