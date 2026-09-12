import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, type MotionValue } from "framer-motion";
import { useLenis } from "lenis/react";

/**
 * 整页位移：目录点牌子跳页时，新页面要从屏幕底下跟着黑底一起被拉上来，
 * 所以路由那一层包在一个能被外面推着走的 motion.div 里。
 * 平时 y = 0，framer 会输出 transform: none，页面里的 position: fixed 不受影响；
 * 只在那 0.8 秒里有 transform。
 */
const Ctx = createContext<MotionValue<number> | null>(null);

export function PageShiftProvider({ children }: { children: ReactNode }) {
  const y = useMotionValue(0);
  return <Ctx.Provider value={y}>{children}</Ctx.Provider>;
}

/** 包住 <Routes>：真正会动的那层 */
export function PageShiftFrame({ children }: { children: ReactNode }) {
  const y = useContext(Ctx);
  const ref = useRef<HTMLDivElement | null>(null);
  /*
   * 顺便当 Lenis 的"内容高度探针"。
   * Lenis 接管 window 时拿 <html> 当 content，用 ResizeObserver 盯它的尺寸；但全站 html/body/#root 都是
   * height: 100%，换路由后页面再长 <html> 的盒子也还是一屏高，观察器不触发，Lenis 记的总高就停在上一页
   * （首页正好是一屏 → 可滚距离 0），滚轮怎么转都被夹在 0——首页推门进 Life 滚不动、刷新又好了就是这个。
   * 这一层 min-h-full 会跟着页面内容长，盯它的高度变化去叫 lenis.resize() 就准了。
   */
  const lenis = useLenis();
  useEffect(() => {
    const el = ref.current;
    if (!el || !lenis) return;
    const ro = new ResizeObserver(() => lenis.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [lenis]);
  return (
    <motion.div ref={ref} className="min-h-full" style={{ y: y ?? 0 }}>
      {children}
    </motion.div>
  );
}

/** 拿到那个位移量，目录用它把新页面从底下推上来 */
export function usePageShift(): MotionValue<number> | null {
  return useContext(Ctx);
}
