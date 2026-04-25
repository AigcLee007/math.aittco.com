/**
 * Copyright (c) 2023-2024 Enrico Ros
 *
 * This subsystem is responsible for 'snap-to-bottom' and 'scroll-to-bottom' features,
 * with an animated, gradual scroll.
 *
 * See the `ScrollToBottomButton` component for the button that triggers the scroll.
 *
 * Example usage:
 *   <ScrollToBottom bootToBottom stickToBottom sx={{ overflowY: 'auto', height: '100%' }}>
 *     <LongMessagesList />
 *     <ScrollToBottomButton />
 *   </ScrollToBottom>
 *
 * Within the Context (children components), functions are made available by using:
 *  const { notifyBooting, setStickToBottom } = useScrollToBottom();
 *
 */
import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { isBrowser } from '~/common/util/pwaUtils';

import { ScrollToBottomState, UseScrollToBottomProvider } from './useScrollToBottom';


// set this to true to debug this component
const DEBUG_SCROLL_TO_BOTTOM = false;

// NOTE: in Chrome a wheel scroll event is 100px
// If you make this too small, the button may show when jumping lines on mobile
// if you make it too large, the user would need a very large flick to unlock the view
const USER_STICKY_MARGIN = 100;

// during the 'booting' timeout, scrolls happen instantly instead of smoothly
const BOOTING_TIMEOUT = 400;


function DebugBorderBox(props: { heightPx: number, color: string }) {
  return (
    <Box sx={{
      position: 'absolute', bottom: 0, right: 0, left: 0,
      height: `${props.heightPx}px`,
      border: `1px solid ${props.color}`,
      pointerEvents: 'none',
    }} />
  );
}

const scrollableBoxSx: SxProps = {
  // allows the content to be scrolled (all browsers)
  overflowY: 'auto',
  // actually make sure this scrolls & fills
  height: '100%',
  // prevents pull-to-refresh on mobile when scrolling up in the chat
  overscrollBehaviorY: 'none',
} as const;


/**
 * This scroller works best with a single oversized child component.
 * The scrollbar (overflowY: 'auto') is handled here.
 *
 * NOTE: the first (possibly only) child shall have { minHeight: '100%' } to auto-fill
 */
export function ScrollToBottom(props: {
  bootToBottom?: boolean,
  bootSmoothly?: boolean,
  stickToBottomInitial?: boolean,
  disableAutoStick?: boolean, // disables auto-sticking when at the bottom - only the button will make it stick
  sx?: SxProps,
  children: React.ReactNode,
}) {

  // state

  const [state, setState] = React.useState<ScrollToBottomState>({
    stickToBottom: props.stickToBottomInitial || false,
    booting: props.bootToBottom || false,
    atBottom: undefined,
  });

  // track scrollable (for events and to scroll it)
  const scrollableElementRef = React.useRef<HTMLDivElement>(null);

  // track children container (for resize observer)
  const childrenContainerRef = React.useRef<HTMLDivElement>(null);

  // track programmatic scrolls
  const isProgrammaticScrollCounter = React.useRef(0);

  // skip the next scroll event (when we want to stay where we are)
  const skipNextScrollCounter = React.useRef(0);
  const skipResetTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);


  // derived state

  const bootToBottom = props.bootToBottom || false;
  // NOTE: using 'auto' for stability; 'smooth' can cause event flooding
  const scrollBehavior: ScrollBehavior = 'auto';

  const stateRef = React.useRef(state);
  stateRef.current = state;


  // [Debugging]
  if (DEBUG_SCROLL_TO_BOTTOM)
    console.log('ScrollToBottom', { ...state });


  // main programmatic scroll to bottom function

  const doScrollToBottom = React.useCallback(() => {
    const scrollable = scrollableElementRef.current;
    if (scrollable) {
      if (DEBUG_SCROLL_TO_BOTTOM)
        console.log('  -> doScrollToBottom()', { scrollHeight: scrollable.scrollHeight, offsetHeight: scrollable.offsetHeight });

      // skip if we were asked to
      if (skipNextScrollCounter.current > 0) {
        skipNextScrollCounter.current--;
        return;
      }

      // Mark the next N scroll events as programmatic to avoid unsticking
      // 'auto' behavior usually triggers 1-2 events. we use a small buffer for safety so it restores control to user fast
      isProgrammaticScrollCounter.current = 2;

      // Actual scroll execution, wrapped in RAF to ensure layout is updated
      window.requestAnimationFrame(() => {
        if (scrollable) {
          scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: scrollBehavior });
        }
      });
    }
  }, [scrollBehavior]);


  /**
   * Booting state reset (after BOOTING_TIMEOUT ms)
   */
  React.useEffect(() => {
    if (!state.booting || !isBrowser) return;

    const _clearBootingHandler = () => {
      setState(state => ({ ...state, booting: false }));
      if (bootToBottom) doScrollToBottom();
    };

    const timeout = window.setTimeout(_clearBootingHandler, BOOTING_TIMEOUT);
    return () => clearTimeout(timeout);
  }, [bootToBottom, doScrollToBottom, state.booting]);

  /**
   * Children elements resize AND mutation event listener
   */
  React.useEffect(() => {
    const scrollable = scrollableElementRef.current;
    if (!scrollable) return;

    const _handleContentChange = () => {
      if (stateRef.current.stickToBottom)
        doScrollToBottom();
      
      // Update atBottom state based on current geometry
      const atBottom = scrollable.scrollHeight - scrollable.scrollTop <= scrollable.offsetHeight + 2;
      if (atBottom !== stateRef.current.atBottom)
        setState(state => ({ ...state, atBottom }));
    };

    // ResizeObserver for layout changes
    const _containerResizeObserver = new ResizeObserver(_handleContentChange);

    // MutationObserver for content (streaming text) changes
    const _containerMutationObserver = new MutationObserver(_handleContentChange);

    const childrenContainer = childrenContainerRef.current;
    if (childrenContainer) {
      _containerResizeObserver.observe(childrenContainer);
      _containerMutationObserver.observe(childrenContainer, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => {
      _containerResizeObserver.disconnect();
      _containerMutationObserver.disconnect();
    };

  }, [doScrollToBottom]);

  /**
   * (User) Scroll events listener
   */
  const lastScrollTopRef = React.useRef(0);

  React.useEffect(() => {
    if (state.booting) return;

    const scrollable = scrollableElementRef.current;
    if (!scrollable) return;

    const _scrollEventsListener = () => {
      const currentScrollTop = scrollable.scrollTop;
      const prevScrollTop = lastScrollTopRef.current;
      lastScrollTopRef.current = currentScrollTop;

      // ignore scroll events during programmatic scrolls
      if (isProgrammaticScrollCounter.current > 0) {
        isProgrammaticScrollCounter.current--;
        return;
      }

      // compute intersections
      const atBottom = scrollable.scrollHeight - currentScrollTop <= scrollable.offsetHeight + USER_STICKY_MARGIN;

      // Unstick logic: only if moving UP significantly and NOT near the bottom
      // 增加灵敏度：如果用户的实际滚动位置往上拉升了（且脱离了粘性能容忍的安全区域）
      // 即便只有 2px 的差值也代表用户正在尝试查看上面的内容。
      const movedUpSignificantly = currentScrollTop < prevScrollTop - 2;

      // update state using functional update to ensure consistency
      setState(prevState => {
        // 如果我们处于触底追踪状态（stickToBottom），而且用户试图上翻查看历史（movedUpSignificantly），
        // 那就立刻取消锁定（变为 false）。否则只有当又被拖到最底（atBottom）时才重新锁定追踪。
        const nextStickToBottom = movedUpSignificantly ? false : (atBottom || prevState.stickToBottom);
        
        if (prevState.stickToBottom !== nextStickToBottom || prevState.atBottom !== atBottom) {
          return {
            ...prevState,
            stickToBottom: props.disableAutoStick ? (prevState.stickToBottom && nextStickToBottom) : nextStickToBottom,
            atBottom,
          };
        }
        return prevState;
      });
    };

    // Explicit User Intervention Handlers
    // If during a high-frequency streaming event the user explicitly triggers a wheel or touch move upwards,
    // we urgently break the stickToBottom state regardless of the programmatic scroll counters masking it.
    const _userInterventionListener = (e: WheelEvent | TouchEvent) => {
      // 仅当用户向上翻（脱离底部）时我们才强行干预，而不是乱点乱划都干预
      let isMovingUp = false;
      if (e.type === 'wheel') {
        const we = e as WheelEvent;
        // deltaY < 0 means scrolling up
        isMovingUp = we.deltaY < 0;
      } else if (e.type === 'touchmove') {
        // We could track touchstart, but simpler heuristic: if touchmove, we usually have a robust scroll loop handling the rest.
        // We'll trust the main scrollEventsListener better once the counter finishes, or forcefully break it here if needed.
        // Just as a blanket fail-safe, any touch movement during auto-scroll could unstick if not at bottom.
        const atBottom = scrollable.scrollHeight - scrollable.scrollTop <= scrollable.offsetHeight + USER_STICKY_MARGIN;
        if (!atBottom) isMovingUp = true;
      }

      if (isMovingUp) {
        setState(prevState => {
          if (prevState.stickToBottom) {
            return { ...prevState, stickToBottom: false };
          }
          return prevState;
        });
      }
    };

    scrollable.addEventListener('scroll', _scrollEventsListener, { passive: true });
    scrollable.addEventListener('wheel', _userInterventionListener as EventListener, { passive: true });
    scrollable.addEventListener('touchmove', _userInterventionListener as EventListener, { passive: true });
    return () => {
      scrollable.removeEventListener('scroll', _scrollEventsListener);
      scrollable.removeEventListener('wheel', _userInterventionListener as EventListener);
      scrollable.removeEventListener('touchmove', _userInterventionListener as EventListener);
    };
  }, [props.disableAutoStick, state.booting]);

  /**
   * Cleanup the skipNextScrollCounter
   */
  React.useEffect(() => {
    return () => {
      if (skipResetTimeoutRef.current) {
        clearTimeout(skipResetTimeoutRef.current);
        skipResetTimeoutRef.current = null;
      }
    };
  }, []);


  // actions for this context

  const notifyBooting = React.useCallback(() => {
    if (bootToBottom)
      setState(state => state.booting ? state : ({ ...state, booting: true }));
  }, [bootToBottom]);

  /*const notifyContentUpdated = React.useCallback(() => {
    if (DEBUG_SCROLL_TO_BOTTOM)
      console.log('-= notifyContentUpdated');

    if (state.stickToBottom)
      doScrollToBottom();
  }, [doScrollToBottom, state.stickToBottom]);*/

  const setStickToBottom = React.useCallback((stickToBottom: boolean) => {
    if (DEBUG_SCROLL_TO_BOTTOM)
      console.log('-= setStickToBottom', stickToBottom);

    setState(state => state.stickToBottom !== stickToBottom
      ? ({ ...state, stickToBottom })
      : state,
    );

    if (stickToBottom)
      doScrollToBottom();
  }, [doScrollToBottom]);

  const skipNextAutoScroll = React.useCallback(() => {
    skipNextScrollCounter.current += 2;
    if (DEBUG_SCROLL_TO_BOTTOM)
      console.log('  -> Skip next scroll requested, counter now:', skipNextScrollCounter.current);

    // Clear any existing timeout
    if (skipResetTimeoutRef.current)
      clearTimeout(skipResetTimeoutRef.current);

    // Set a new timeout to reset the counter if not used
    skipResetTimeoutRef.current = setTimeout(() => {
      if (skipNextScrollCounter.current > 0) {
        if (DEBUG_SCROLL_TO_BOTTOM)
          console.log('  -> Resetting unused skip counter');
        skipNextScrollCounter.current = 0;
      }
    }, 200); // Reset after 0.25 seconds if not used
  }, []);


  return (
    <UseScrollToBottomProvider value={{
      ...state,
      notifyBooting,
      setStickToBottom,
      skipNextAutoScroll,
    }}>
      {/* Scrollable v-maxed */}
      <Box ref={scrollableElementRef} role={'scrollable' /* hardcoded, important */} sx={!props.sx ? scrollableBoxSx : ({
        ...scrollableBoxSx,
        ...props.sx,
      } as SxProps)}>
        <Box ref={childrenContainerRef} sx={{ minHeight: '100%' }}>
          {props.children}
        </Box>
        {DEBUG_SCROLL_TO_BOTTOM && <DebugBorderBox heightPx={USER_STICKY_MARGIN} color='red' />}
        {DEBUG_SCROLL_TO_BOTTOM && <DebugBorderBox heightPx={100} color='blue' />}
      </Box>
    </UseScrollToBottomProvider>
  );
}