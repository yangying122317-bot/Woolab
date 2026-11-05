import { useEffect } from "react";

/** 是否处于手机版首页/全站预览模式（?mobile=1 开启，?mobile=0 关闭；开启后记在当前标签页 sessionStorage，方便跳页测试） */
export function isMobilePreview(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("mobile");
  if (q === "1") {
    try {
      sessionStorage.setItem("woolab-mobile-preview", "1");
    } catch {
      /* ignore */
    }
    return true;
  }
  if (q === "0") {
    try {
      sessionStorage.removeItem("woolab-mobile-preview");
    } catch {
      /* ignore */
    }
    return false;
  }
  try {
    if (sessionStorage.getItem("woolab-mobile-preview") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** 当前有效舞台宽度（兼容电脑上的 390px 手机预览壳与真实手机屏幕） */
export function getViewWidth(): number {
  if (typeof window === "undefined") return 390;
  if (isMobilePreview() && window.innerWidth >= 768) return 390;
  return document.body?.clientWidth || window.innerWidth;
}

/** 是否为手机竖屏视图（真实手机窄屏或 ?mobile=1 预览模式） */
export function isMobileView(): boolean {
  return getViewWidth() < 768;
}

/** 手机拦截页开关：手机竖版现已正式全量上线，默认所有手机直接进入完整 App；仅 ?gate=1 时展示旧版拦截页 */
export function isPhone(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("gate") === "1";
}

/**
 * 手机竖屏视图下支持手指/鼠标左右或上下划动直接推进横向长卷（Life 房间 / Lab 画廊）：
 * 电脑正常大屏（!isMobileView()）直接跳过，100% 不影响桌面端滚轮手感。
 * maxStepPx 限制单次滑动手势（含松手惯性）的最大推进距离，防止快速一划直接滑到底。
 */
export function useMobileHorizontalDrag(enabled = true, maxStepPx = 950): void {
  useEffect(() => {
    if (!enabled || !isMobileView()) return;

    let active = false;
    let lockedAxis: "x" | "y" | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let startScrollY = 0;
    let raf = 0;

    const clampVel = (v: number) => Math.max(-22, Math.min(22, v));
    const scrollClamped = (delta: number) => {
      const cur = window.scrollY;
      const target = Math.max(
        startScrollY - maxStepPx,
        Math.min(startScrollY + maxStepPx, cur + delta),
      );
      const actual = target - cur;
      if (Math.abs(actual) > 0.2) window.scrollBy(0, actual);
      return actual;
    };

    const isInteractiveTarget = (target: EventTarget | null): boolean => {
      let el = target instanceof Element ? target : (target as Node | null)?.parentElement ?? null;
      while (el && el !== document.body && el !== document.documentElement) {
        if (
          el.hasAttribute("data-lenis-prevent") ||
          el.classList.contains("cursor-grab") ||
          el.classList.contains("cursor-grabbing")
        ) {
          return true;
        }
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

    const start = (x: number, y: number, target: EventTarget | null) => {
      stopMomentum();
      if (isInteractiveTarget(target)) {
        active = false;
        return;
      }
      active = true;
      lockedAxis = null;
      startX = lastX = x;
      startY = y;
      startScrollY = window.scrollY;
      lastTime = performance.now();
      velocity = 0;
    };

    const move = (x: number, y: number, prevent?: () => void) => {
      if (!active) return;
      const dx = x - startX;
      const dy = y - startY;
      if (!lockedAxis) {
        if (Math.hypot(dx, dy) < 7) return;
        lockedAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }
      prevent?.();
      const now = performance.now();
      const dt = Math.max(8, now - lastTime);
      const step = lockedAxis === "x" ? x - lastX : y - startY;
      if (lockedAxis === "y") startY = y;
      else lastX = x;
      const deltaScroll = -step * 1.3;
      const actual = scrollClamped(deltaScroll);
      velocity = clampVel(velocity * 0.4 + (actual / dt) * 16 * 0.6);
      lastTime = now;
    };

    const end = () => {
      if (!active) return;
      active = false;
      if (!lockedAxis || Math.abs(velocity) < 0.8) return;
      const tick = () => {
        if (Math.abs(velocity) < 0.4) {
          raf = 0;
          return;
        }
        const actual = scrollClamped(velocity);
        if (Math.abs(actual) < 0.2) {
          raf = 0;
          return;
        }
        velocity *= 0.88;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY, e.target);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !active) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - startX;
      const dy = y - startY;
      if (!lockedAxis) {
        if (Math.hypot(dx, dy) < 7) return;
        lockedAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      const dt = Math.max(8, now - lastTime);
      const step = lockedAxis === "x" ? x - lastX : y - startY;
      if (lockedAxis === "y") startY = y;
      else lastX = x;
      const deltaScroll = -step * 1.35;
      const actual = scrollClamped(deltaScroll);
      velocity = clampVel(velocity * 0.4 + (actual / dt) * 16 * 0.6);
      lastTime = now;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) start(e.clientX, e.clientY, e.target);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (active) move(e.clientX, e.clientY, () => e.preventDefault());
    };

    const prevTouchAction = document.documentElement.style.touchAction;
    document.documentElement.style.touchAction = "none";
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", end);
    return () => {
      stopMomentum();
      document.documentElement.style.touchAction = prevTouchAction;
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", end);
    };
  }, [enabled, maxStepPx]);
}
