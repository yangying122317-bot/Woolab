import { useEffect } from "react";

/** 手机判定：触屏 + 短边不到 768（iPad 横屏、桌面窄窗口都放行）。?gate=1 / ?gate=0 可强制 */
export function isPhone(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("gate");
  if (q === "1") return true;
  if (q === "0") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const short = Math.min(window.innerWidth, window.innerHeight) < 768;
  return coarse && short;
}

/** 是否强制锁定在手机竖屏信封页（?gate=1） */
export function isForcedGate(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("gate") === "1";
}

/**
 * 仅在手机端（isPhone() === true）生效的横向触屏划动转页面纵向滚动桥接：
 * Life 房间和 Lab 画廊靠 window.scrollY 驱动横移/前进；手机横屏下用户习惯左右划屏幕，
 * 这里把非拖拽区域上的水平手指划动（带松手惯性）映射为 window.scrollBy，电脑端直接跳过不挂载。
 */
export function usePhoneHorizontalScroll(enabled = true): void {
  useEffect(() => {
    if (!enabled || !isPhone()) return;

    let active = false;
    let lockedAxis: "x" | "y" | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let raf = 0;

    const isInteractiveTouchTarget = (target: EventTarget | null): boolean => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        if (el.hasAttribute("data-lenis-prevent")) return true;
        const style = window.getComputedStyle(el);
        if (style.touchAction === "none") return true;
        el = el.parentElement;
      }
      return false;
    };

    const stopMomentum = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      stopMomentum();
      if (e.touches.length !== 1 || isInteractiveTouchTarget(e.target)) {
        active = false;
        return;
      }
      const t = e.touches[0];
      active = true;
      lockedAxis = null;
      startX = lastX = t.clientX;
      startY = t.clientY;
      lastTime = performance.now();
      velocity = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!lockedAxis) {
        if (Math.hypot(dx, dy) < 6) return;
        lockedAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }

      if (lockedAxis !== "x") return;
      if (e.cancelable) e.preventDefault();

      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const stepX = t.clientX - lastX;
      const deltaScroll = -stepX * 1.35;
      window.scrollBy(0, deltaScroll);
      velocity = velocity * 0.35 + (deltaScroll / dt) * 16 * 0.65;
      lastX = t.clientX;
      lastTime = now;
    };

    const onTouchEnd = () => {
      if (!active) return;
      active = false;
      if (lockedAxis !== "x" || Math.abs(velocity) < 0.8) return;
      const tick = () => {
        if (Math.abs(velocity) < 0.4) {
          raf = 0;
          return;
        }
        window.scrollBy(0, velocity);
        velocity *= 0.92;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      stopMomentum();
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled]);
}
