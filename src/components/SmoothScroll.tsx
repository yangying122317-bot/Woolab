import { useEffect, useRef, type RefObject } from "react";
import Lenis, { type LenisOptions } from "lenis";
import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";

/**
 * 全站丝滑滚动（Lenis）。
 *
 * 原理：不接管渲染，只接管鼠标滚轮——把滚轮的每一跳按 lerp 缓出去再写给原生 scrollTop，
 * 所以 framer 的 useScroll、position: sticky 这些照常工作，只是滚动位置变得连续了。
 * 触摸屏保持原生（syncTouch 关掉，手机上原生已经够顺）。
 * 系统开了"减少动态"时 Lenis 自己会退回原生滚动。
 *
 * 某块区域要走原生滚动 / 不想被外层接管：给它加 data-lenis-prevent。
 */
const SMOOTH: LenisOptions = {
  lerp: 0.1,
  smoothWheel: true,
  syncTouch: false,
  wheelMultiplier: 1,
  autoRaf: true,
};

/** 挂在整个应用外面：接管 window 的滚动 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={SMOOTH}>
      {children}
    </ReactLenis>
  );
}

/**
 * 给一个自己带滚动条的容器（overflow-y: auto）也套上丝滑滚动。
 * wrapper 是滚动容器，content 是它唯一的子元素（Lenis 靠它量总高）。
 * 返回的 ref 里是 Lenis 实例，要程序化滚动时用 lenis.scrollTo 而不是直接改 scrollTop。
 */
export function useSmoothContainer(
  wrapper: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const lenis = useRef<Lenis | null>(null);
  useEffect(() => {
    const w = wrapper.current;
    const c = content.current;
    if (!enabled || !w || !c) return;
    const inst = new Lenis({ ...SMOOTH, wrapper: w, content: c });
    lenis.current = inst;
    return () => {
      inst.destroy();
      lenis.current = null;
    };
  }, [wrapper, content, enabled]);
  return lenis;
}
