import * as React from 'react';
import { useRouter } from 'next/router';

import { getChatTokenCountingMethod } from '../../apps/chat/store-app-chat';

import { logger } from '~/common/logger/logger.client';
import { markNewsAsSeen, shallRedirectToNews, sherpaReconfigureBackendModels, sherpaStorageMaintenanceNoChats_delayed } from '~/common/logic/store-logic-sherpa';
import { navigateToNews, ROUTE_APP_CHAT } from '~/common/app.routes';
import { preloadTiktokenLibrary } from '~/common/tokens/tokens.text';
import { useClientLoggerInterception } from '~/common/logger/hooks/useClientLoggerInterception';
import { useNextLoadProgress } from '~/common/components/useNextLoadProgress';
import { reactQueryClientSingleton } from '~/common/app.queryclient';
import { apiQuery } from '~/common/util/trpc.client';
import { useAuthStore } from '~/common/stores/auth/useAuthStore';


export function ProviderBootstrapLogic(props: { children: React.ReactNode }) {

  // external state
  const { route, events } = useRouter();
  const { accessToken, refreshToken, user, setAccessToken, setUser, logout } = useAuthStore();
  const [authReady, setAuthReady] = React.useState(() => !accessToken && !refreshToken && !user);
  const refreshedForTokenRef = React.useRef<string | null>(null);
  const refreshInFlightRef = React.useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = React.useRef(0);
  const queryClient = React.useMemo(() => reactQueryClientSingleton(), []);

  const refreshMutation = apiQuery.auth.refresh.useMutation();

  const refreshSession = React.useCallback(async (reason: 'bootstrap' | 'resume') => {
    if (!refreshToken) {
      if (accessToken || user)
        logout();
      setAuthReady(true);
      return;
    }

    if (refreshInFlightRef.current)
      return refreshInFlightRef.current;

    if (reason === 'bootstrap')
      setAuthReady(false);

    const refreshPromise = (async () => {
      try {
        const refreshed = await refreshMutation.mutateAsync({ refreshToken });
        setAccessToken(refreshed.accessToken);
        lastRefreshAtRef.current = Date.now();
        await queryClient.invalidateQueries();
      } catch (error) {
        console.warn('Session refresh failed, logging out.', error);
        logout();
      } finally {
        refreshInFlightRef.current = null;
        if (reason === 'bootstrap')
          setAuthReady(true);
      }
    })();

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [accessToken, logout, queryClient, refreshMutation, refreshToken, setAccessToken, user]);

  const meQuery = apiQuery.auth.me.useQuery(undefined, {
    enabled: !!accessToken && authReady,
    staleTime: 60_000,
    retry: false,
  });

  // AUTO-LOG events from this scope on; note that we are past the Sherpas
  useClientLoggerInterception(true, false);

  // wire-up the NextJS router to a loading bar to be displayed while routes change
  useNextLoadProgress(route, events);


  // [boot-up] logic
  const isOnChat = route === ROUTE_APP_CHAT;
  const doRedirectToNews = isOnChat && shallRedirectToNews();


  // redirect Chat -> News if fresh news
  const isRedirectingToNews = React.useMemo(() => {
    if (doRedirectToNews) {
      navigateToNews().then(() => markNewsAsSeen()).catch(console.error);
      return true;
    }
    return false;
  }, [doRedirectToNews]);


  // decide what to launch
  const launchPreload = isOnChat && !isRedirectingToNews && getChatTokenCountingMethod() === 'accurate'; // only preload if using TikToken by default
  const launchAutoConf = isOnChat && !isRedirectingToNews;
  const launchStorageGC = true;

  // [auth bootstrap] restore persisted sessions before protected pages/query trees mount.
  React.useEffect(() => {
    if (!refreshToken) {
      refreshedForTokenRef.current = null;
      if (accessToken || user)
        logout();
      setAuthReady(true);
      return;
    }

    if (refreshedForTokenRef.current === refreshToken)
      return;

    refreshedForTokenRef.current = refreshToken;
    void refreshSession('bootstrap');
  }, [accessToken, logout, refreshSession, refreshToken, user]);

  // [auth resume] when a dormant tab wakes up, refresh once again so balance/models do not render empty.
  React.useEffect(() => {
    if (!refreshToken)
      return;

    const maybeRefreshOnResume = () => {
      if (document.visibilityState === 'hidden')
        return;
      if (Date.now() - lastRefreshAtRef.current < 5 * 60 * 1000)
        return;
      void refreshSession('resume');
    };

    window.addEventListener('focus', maybeRefreshOnResume);
    document.addEventListener('visibilitychange', maybeRefreshOnResume);
    return () => {
      window.removeEventListener('focus', maybeRefreshOnResume);
      document.removeEventListener('visibilitychange', maybeRefreshOnResume);
    };
  }, [refreshSession, refreshToken]);


  // [preload] kick-off a preload of the Tiktoken library right when proceeding to the UI
  React.useEffect(() => {
    if (!launchPreload) return;

    void preloadTiktokenLibrary() // fire/forget (large WASM payload)
      .catch(err => {
        // Suppress WebAssembly loading errors - app will fall back to approximate counting
        // These commonly occur when users navigate away or have slow connections
        logger.debug('Tiktoken preload failed (expected on slow/interrupted loads)', err, 'client', {
          skipReporting: true, // Don't send to PostHog - this is a benign error
        });
      });

  }, [launchPreload]);

  // [autoconf] initiate the llm auto-configuration process if on the chat
  React.useEffect(() => {
    if (!launchAutoConf) return;

    void sherpaReconfigureBackendModels(); // fire/forget (background server-driven model reconfiguration)

  }, [launchAutoConf]);

  // storage maintenance and garbage collection
  React.useEffect(() => {
    if (!launchStorageGC) return;

    const timeout = setTimeout(sherpaStorageMaintenanceNoChats_delayed, 1000);
    return () => clearTimeout(timeout);

  }, [launchStorageGC]);

  // Keep local auth state aligned with server-side profile fields across devices.
  React.useEffect(() => {
    if (!meQuery.data) return;

    const nextUser = meQuery.data;
    if (
      user?.id === nextUser.id
      && user?.shortId === nextUser.shortId
      && user?.email === nextUser.email
      && user?.nickname === nextUser.nickname
      && user?.avatar === nextUser.avatar
      && user?.role === nextUser.role
    )
      return;

    setUser({
      id: nextUser.id,
      shortId: nextUser.shortId,
      email: nextUser.email,
      nickname: nextUser.nickname,
      avatar: nextUser.avatar,
      role: nextUser.role,
    });
  }, [meQuery.data, setUser, user]);

  React.useEffect(() => {
    if (!meQuery.error || !authReady || !accessToken)
      return;

    const code = (meQuery.error as any)?.data?.code;
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || code === 'NOT_FOUND') {
      console.warn('Session profile lookup failed, logging out.', meQuery.error);
      logout();
    }
  }, [accessToken, authReady, logout, meQuery.error]);

  //
  // Render Gates
  //

  if (isRedirectingToNews)
    return null;

  if (!authReady)
    return null;

  return props.children;
}
