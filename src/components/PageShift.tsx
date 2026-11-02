import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "framer-motion";
import { useLenis } from "lenis/react";
import { INTRO_PREVIEW_PATH, INTRO_SESSION_KEY } from "../state/intro";

/**
 * 整页位移与向上掀页回首页：
 * 1. 目录点牌子跳页时，新页面从屏幕底下跟着蓝底一起被拉上来；
 * 2. 在内页点左上角 WOOLAB logo 回首页时，当前页面直接底边带弧度向上抽走，底下原地露出首页。
 * 平时 y = 0、peeling = false，framer 输出 transform: none，页面里的 position: fixed / sticky 不受影响。
 */
const SAG_MAX = 0.16;
const SAG_K = 0.11;
const PEEL_T = 0.75;

type PageShiftContextValue = {
  y: MotionValue<number>;
  peeling: boolean;
  sy: number;
  peelToHome: () => void;
};

const Ctx = createContext<PageShiftContextValue | null>(null);

export function PageShiftProvider({
  backdrop,
  introPreview,
  children,
}: {
  backdrop?: ReactNode;
  introPreview?: ReactNode;
  children: ReactNode;
}) {
  const y = useMotionValue(0);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lenis = useLenis();
  const [peeling, setPeeling] = useState(false);
  const [sy, setSy] = useState(0);
  const peelingRef = useRef(false);

  const peelToHome = useCallback(() => {
    if (peelingRef.current) return;
    peelingRef.current = true;
    const currentScrollY = window.scrollY;
    const vh = window.innerHeight;
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    sessionStorage.setItem("heroIntroPlayed", "1");
    lenis?.stop();
    setSy(currentScrollY);
    setPeeling(true);

    requestAnimationFrame(() => {
      animate(y, -vh, {
        duration: PEEL_T,
        ease: [0.55, 0, 0.75, 0.55],
      }).then(() => {
        navigate("/");
        window.scrollTo(0, 0);
        setPeeling(false);
        peelingRef.current = false;
        y.jump(0);
        lenis?.start();
      });
    });
  }, [lenis, navigate, y]);

  const isHome = pathname === "/" || pathname === INTRO_PREVIEW_PATH;
  const showHome = isHome || peeling;
  const location = useLocation();
  const fromLabDoor = isHome && (location.state as { from?: string } | null)?.from === "lab-door";

  /* 切回首页时强制把原生滚动与 Lenis 位置立即归零，避免停留在上一页（如 Lab 7000px 处）的滚动位置 */
  useEffect(() => {
    if (!isHome) return;
    window.scrollTo(0, 0);
    lenis?.scrollTo(0, { immediate: true, force: true });
    lenis?.resize();
  }, [isHome, lenis]);

  return (
    <Ctx.Provider value={{ y, peeling, sy, peelToHome }}>
      {/* 首页持久层：从掀页开始（peeling=true）到切回 "/"（isHome=true）始终是同一个 <Home /> 实例，不卸载不重挂 */}
      {showHome && (
        <div className={peeling ? "fixed inset-0 z-0 overflow-hidden" : "relative z-0 h-screen overflow-hidden"}>
          {backdrop}
          {pathname === INTRO_PREVIEW_PATH && introPreview}
          {fromLabDoor && (
            <motion.div
              className="pointer-events-none fixed inset-0 z-50"
              style={{
                background: "radial-gradient(circle at 50% 50%, #FFE9B8 0%, #FBE3AC 55%, #F2EDE3 100%)",
              }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            />
          )}
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}

/** 包住 <Routes>：真正会动的那层 */
export function PageShiftFrame({ children }: { children: ReactNode }) {
  const ctx = useContext(Ctx);
  const { pathname } = useLocation();
  const isHome = pathname === "/" || pathname === INTRO_PREVIEW_PATH;
  const y = ctx?.y;
  const peeling = ctx?.peeling ?? false;
  const sy = ctx?.sy ?? 0;
  const ref = useRef<HTMLDivElement | null>(null);

  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const fallbackY = useMotionValue(0);
  const activeY = y ?? fallbackY;
  const vel = useVelocity(activeY);
  const sagRaw = useTransform(vel, (v) =>
    peeling ? Math.min(Math.abs(v) * SAG_K, SAG_MAX * vp.h) : 0,
  );
  const sag = useSpring(sagRaw, { stiffness: 140, damping: 16 });
  const clip = useTransform(sag, (d) => {
    if (!peeling || d <= 0.5) return "none";
    const top = sy;
    const bottom = sy + vp.h;
    const corner = bottom - d;
    /* 二次贝塞尔两端在 bottom - d、控制点在 bottom + d 时，曲线中点恒在 bottom，整条弧严格落在视口内 */
    return `path("M0 ${top} H${vp.w} V${corner} Q${vp.w / 2} ${bottom + d} 0 ${corner} Z")`;
  });

  useEffect(() => {
    if (!peeling) {
      sag.jump(0);
      if (ref.current) ref.current.style.clipPath = "";
    }
  }, [peeling, sag]);

  /*
   * 顺便当 Lenis 的"内容高度探针"。
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
    <motion.div
      ref={ref}
      className={`${isHome && !peeling ? "hidden" : "min-h-full"} ${peeling ? "is-peeling relative z-10" : ""}`}
      style={{
        y: activeY,
        clipPath: clip,
        willChange: peeling ? "transform, clip-path" : undefined,
        ["--peel-sy" as string]: peeling ? `${sy}px` : undefined,
      }}
    >
      {children}
    </motion.div>
  );
}

/** 拿到那个位移量，目录用它把新页面从底下推上来 */
export function usePageShift(): MotionValue<number> | null {
  return useContext(Ctx)?.y ?? null;
}

/** 触发当前页面直接带弧度向上抽走并揭开首页 */
export function usePeelToHome(): { peeling: boolean; peelToHome: () => void } {
  const ctx = useContext(Ctx);
  return {
    peeling: ctx?.peeling ?? false,
    peelToHome: ctx?.peelToHome ?? (() => {}),
  };
}
