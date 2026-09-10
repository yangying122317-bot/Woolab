import { useEffect, useState } from "react";

/**
 * 用户"停下来了"：连续 ms 毫秒没有滚动 / 点按 / 敲键盘就算空闲。
 * 只动鼠标不算——很多人手一直在晃，按 mousemove 算的话提示会一直闪。
 * 引导都挂在这个状态上：停下来才出来，动起来就让路。
 */
export function useIdle(ms: number, enabled = true): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return;
    }
    let timer = window.setTimeout(() => setIdle(true), ms);
    const reset = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), ms);
    };
    const evs = ["wheel", "scroll", "pointerdown", "touchstart", "keydown"] as const;
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [ms, enabled]);
  return enabled && idle;
}
