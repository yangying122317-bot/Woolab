import { createContext, useContext, type ReactNode } from "react";
import { motion, useMotionValue, type MotionValue } from "framer-motion";

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
  return (
    <motion.div className="min-h-full" style={{ y: y ?? 0 }}>
      {children}
    </motion.div>
  );
}

/** 拿到那个位移量，目录用它把新页面从底下推上来 */
export function usePageShift(): MotionValue<number> | null {
  return useContext(Ctx);
}
