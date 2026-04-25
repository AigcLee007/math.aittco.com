import * as React from 'react';

/**
 * A hook that smooths out a target text by outputting it character by character.
 * This creates a "typing" effect for LLM responses.
 *
 * @param targetText The full text received so far (potentially incomplete)
 * @param active Whether the source is still actively streaming
 * @param speedCharsPerSec Average characters per second
 */
export function useSmoothTypewriter(targetText: string, active: boolean, speedCharsPerSec: number = 35) {
  // Use the targetText immediately if the effect is not supposed to run
  const [displayedText, setDisplayedText] = React.useState(active ? '' : targetText);

  // Internal state to track progress independently of React render cycles
  const progressRef = React.useRef({
    currentLength: active ? 0 : targetText.length,
    lastTickTime: 0,
    targetText: targetText,
    isActive: active,
  });

  // Keep internal state in sync with external changes
  React.useEffect(() => {
    progressRef.current.targetText = targetText;

    // Handle deactivation (streaming ended)
    if (progressRef.current.isActive && !active) {
      // 移除原先的 300 字强行截断蹦出逻辑。
      // 因为遇到代理缓冲返回时，几千字的返回可能也是瞬间的，必须使用快速追赶而非突然破坏演出。
    }
    progressRef.current.isActive = active;

    // If never active or already reached the end, stay in sync
    if (!active && (progressRef.current.currentLength >= progressRef.current.targetText.length)) {
      setDisplayedText(targetText);
    }
  }, [targetText, active]);

  React.useEffect(() => {
    let rafId: number;

    const tick = (now: number) => {
      const state = progressRef.current;

      if (state.lastTickTime === 0) {
        state.lastTickTime = now;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - state.lastTickTime;
      state.lastTickTime = now;

      const targetLen = state.targetText.length;

      if (state.currentLength < targetLen) {
        const distance = targetLen - state.currentLength;

        // Adaptive speed logic:
        // Adjust threshold and multiplier to be even smoother
        const backlogFactor = Math.max(0, (distance - 100) / 400);
        
        // 如果后台已经停止了输出，但前台还落后很多，为了用户不产生死机错觉，应该加速滚落完
        // 修改为倍速 3（原 10 容易导致用户感觉突然飞快）
        const sprintMultiplier = !state.isActive ? 3 : 1; 

        const adaptiveSpeed = speedCharsPerSec * (1 + backlogFactor) * sprintMultiplier;

        const charsToAdd = (adaptiveSpeed * elapsed) / 1000;
        const newLength = Math.min(targetLen, state.currentLength + charsToAdd);

        // Update state only when a new whole character is available
        if (Math.floor(newLength) !== Math.floor(state.currentLength)) {
           // 特殊冲刺阶段：若距离已经十分接近（甚至直接跨线），且属于收尾状态，一次性给足
          if (!state.isActive && targetLen - newLength < 3) {
            setDisplayedText(state.targetText);
            state.currentLength = targetLen;
          } else {
            setDisplayedText(state.targetText.substring(0, Math.floor(newLength)));
          }
        }
        state.currentLength = newLength;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [speedCharsPerSec]);

  return displayedText;
}
