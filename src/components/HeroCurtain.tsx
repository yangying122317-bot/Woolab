import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useSpring, useTransform, useVelocity } from "framer-motion";
import { MU } from "./NavBar";
import { noiseBg } from "./about/geom";
import { INTRO_DISMISSED_EVENT, INTRO_SESSION_KEY } from "../state/intro";
import { useReportLogoOnlyNav } from "../state/chrome";

/**
 * 首页开场的那块蓝布：压在首页场景里、小羊和小鸟的底下（它俩由 HeroScene 抬到布上面）。
 * 布上只有左上 logo 底下一行 LOADING（logo 就是真顶栏的 logo，右边那组暂时藏起来）。
 * 这里只管：等首页第一屏的图 + 字体 + 最短停留（最长兜底）→ 报 onLoaded；
 * 外面（HeroScene）安排好小鸟归位、小羊探身之后把 slide 置真 → 布整块向上拉走、底边拖一个弧 →
 * 写会话标记（预览不写）、广播离场事件、报 onDone。
 */

export const CURTAIN_BLUE = "#44A4D3";
/** 至少停这么久，小鸟起码飞满一个来回 */
const MIN_SHOW = 2.4;
/** 图再没下完也走，别把人卡在开屏 */
const MAX_WAIT = 7;
/** 拉走的时长 */
export const CURTAIN_SLIDE_T = 0.7;
/** 底边拖弧：最多鼓多少（占屏高）、速度→弧深的系数 */
const SAG_MAX = 0.14;
const SAG_K = 0.1;

const loaded = (src: string) =>
  new Promise<void>((res) => {
    const im = new Image();
    im.onload = () => im.decode().then(res, res);
    im.onerror = () => res();
    im.src = src;
  });

export default function HeroCurtain({
  preload,
  preview,
  slide,
  onLoaded,
  onDone,
}: {
  /** 要等的图 */
  preload: string[];
  /** 预览入口：不写会话标记 */
  preview: boolean;
  /** 置真就拉走 */
  slide: boolean;
  onLoaded: () => void;
  onDone: () => void;
}) {
  useReportLogoOnlyNav(true);

  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const { w: vw, h: vh } = vp;
  const unit = Math.min(vw / 720, vh / 450);

  const pad = SAG_MAX * vh;
  const y = useMotionValue(0);
  const vel = useVelocity(y);
  const sagRaw = useTransform(vel, (v) => Math.min(Math.abs(v) * SAG_K, pad));
  const sag = useSpring(sagRaw, { stiffness: 140, damping: 16 });
  const clip = useTransform(sag, (d) => `path("M0 0 H${vw} V${vh} Q${vw / 2} ${vh + d} 0 ${vh} Z")`);

  /* 加载判定 */
  useEffect(() => {
    let alive = true;
    const assets = Promise.all(preload.map(loaded));
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const minShow = new Promise<void>((r) => window.setTimeout(r, MIN_SHOW * 1000));
    const maxWait = new Promise<void>((r) => window.setTimeout(r, MAX_WAIT * 1000));
    Promise.race([Promise.all([assets, fonts, minShow]), maxWait]).then(() => {
      if (alive) onLoaded();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 拉走 */
  const sliding = useRef(false);
  useEffect(() => {
    if (!slide || sliding.current) return;
    sliding.current = true;
    animate(y, -(vh + pad), { duration: CURTAIN_SLIDE_T, ease: [0.55, 0, 0.75, 0.55] }).then(() => {
      if (!preview) sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      window.dispatchEvent(new Event(INTRO_DISMISSED_EVENT));
      onDone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  return (
    <motion.div
      className="pointer-events-auto absolute inset-x-0 top-0 select-none"
      style={{
        height: vh + pad,
        y,
        clipPath: clip,
        backgroundColor: CURTAIN_BLUE,
        ...noiseBg("blue", unit),
        zIndex: 20,
      }}
    >
      {/* LOADING：挂在顶栏 logo 底下（顶栏本身在这层上面，logo 就是它的） */}
      <div
        className="font-nav absolute flex items-baseline font-bold text-white uppercase"
        style={{
          ["--mu" as string]: MU,
          left: `calc(var(--mu) * 25)`,
          top: `calc(var(--mu) * 52)`,
          fontSize: `calc(var(--mu) * 10)`,
          letterSpacing: `calc(var(--mu) * 0.8)`,
          opacity: 0.85,
        }}
      >
        Loading
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.15, 1, 0.15] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
          >
            .
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}
