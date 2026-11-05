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
 * 采用与刷新率无关（60Hz/120Hz 自适应）的指数衰减惯性与速度上限，既保证丝滑跟手与自然滑行，又避免单次快划直接冲到底。
 */
export function useMobileHorizontalDrag(enabled = true, maxVel = 36): void {
  useEffect(() => {
    if (!enabled || !isMobileView()) return;

    let active = false;
    let lockedAxis: "x" | "y" | null = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocity = 0;
    let raf = 0;

    const clampVel = (v: number) => Math.max(-maxVel, Math.min(maxVel, v));

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
      startY = lastY = y;
      lastTime = performance.now();
      velocity = 0;
    };

    const move = (x: number, y: number, mult: number, prevent?: () => void) => {
      if (!active) return;
      const dx = x - startX;
      const dy = y - startY;
      if (!lockedAxis) {
        if (Math.hypot(dx, dy) < 6) return;
        lockedAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        lastX = x;
        lastY = y;
        lastTime = performance.now();
        prevent?.();
        return;
      }
      prevent?.();
      const now = performance.now();
      const dt = Math.max(8, now - lastTime);
      const step = lockedAxis === "x" ? x - lastX : y - lastY;
      lastX = x;
      lastY = y;
      const deltaScroll = -step * mult;
      if (Math.abs(deltaScroll) > 0.1) {
        window.scrollBy(0, deltaScroll);
      }
      const instVel = (deltaScroll / dt) * 16.67;
      velocity = clampVel(velocity * 0.45 + instVel * 0.55);
      lastTime = now;
    };

    const end = () => {
      if (!active) return;
      active = false;
      // 如果手指停住超过 65ms 再松手，不触发余速惯性
      if (!lockedAxis || performance.now() - lastTime > 65 || Math.abs(velocity) < 0.6) {
        velocity = 0;
        return;
      }
      let prevTime = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(34, Math.max(1, now - prevTime));
        prevTime = now;
        if (Math.abs(velocity) < 0.35) {
          raf = 0;
          return;
        }
        const frameStep = velocity * (dt / 16.67);
        window.scrollBy(0, frameStep);
        // 0.94^(dt/16.67) 丝滑指数衰减：滑行约 0.65s 平滑停稳，不会突兀急刹
        velocity *= Math.pow(0.94, dt / 16.67);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      // 预留屏幕左右边缘 24px 给 iOS/Android 浏览器原生的侧滑返回手势
      if (x < 24 || x > window.innerWidth - 24) {
        active = false;
        return;
      }
      start(x, e.touches[0].clientY, e.target);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !active) return;
      move(e.touches[0].clientX, e.touches[0].clientY, 1.85, () => {
        if (e.cancelable) e.preventDefault();
      });
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) start(e.clientX, e.clientY, e.target);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (active) move(e.clientX, e.clientY, 1.45, () => e.preventDefault());
    };

    const prevOverscroll = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = "none";
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", end);
    return () => {
      stopMomentum();
      document.documentElement.style.overscrollBehavior = prevOverscroll;
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", end);
    };
  }, [enabled, maxVel]);
}
