import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useSpring, useTransform, useVelocity } from "framer-motion";
import { useLocation } from "react-router-dom";
import { config } from "../config";
import { MU, NavLogo, navBarStyle } from "./NavBar";
import { noiseBg } from "./about/geom";
import { INTRO_DISMISSED_EVENT, INTRO_PREVIEW_PATH, INTRO_REPLAY_EVENT, INTRO_SESSION_KEY } from "../state/intro";

export { INTRO_DISMISSED_EVENT, INTRO_PREVIEW_PATH, INTRO_SESSION_KEY };

/**
 * 开场加载页（每个会话一次，`config.introEnabled` 总开关）。
 *
 * 首页（和 /intro 预览）不在这里做：那里的开屏是压在首页场景里的一块蓝布，小羊小鸟一直站在布上面，
 * 布拉走房子才露出来——见 HeroScene / HeroCurtain。
 * 这里只管别的页面直达的情况（比如直接打开 /about）：一块简单的品牌蓝 + 左上 logo + LOADING，
 * 等字体就绪 + 最短停留后整块向上拉走。手机端先不做。
 */

const BLUE = "#44A4D3";
const MIN_SHOW = 1.6;
const MAX_WAIT = 6;
const SLIDE_T = 0.7;
const SAG_MAX = 0.14;
const SAG_K = 0.1;
/** 手机端（首页会切成"插画 + 列表"布局）先不播开屏 */
const isMobile = () => window.innerWidth < 768;

export default function IntroLoader() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(
    () => config.introEnabled && !isMobile() && !sessionStorage.getItem(INTRO_SESSION_KEY),
  );
  if (!visible || pathname === "/" || pathname === INTRO_PREVIEW_PATH) return null;
  return <PlainLoader onDone={() => setVisible(false)} />;
}

/**
 * 加载动画的单独入口（/intro）：底下是首页，首页场景自己会把蓝布盖上（不看、不写会话标记）；
 * 播完右下角给一个 REPLAY，点了广播一声让首页重新盖上再播。
 */
export function IntroPreview() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const on = () => setDone(true);
    window.addEventListener(INTRO_DISMISSED_EVENT, on);
    return () => window.removeEventListener(INTRO_DISMISSED_EVENT, on);
  }, []);
  if (!done) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setDone(false);
        window.dispatchEvent(new Event(INTRO_REPLAY_EVENT));
      }}
      className="font-nav fixed z-50 cursor-pointer rounded-full border border-neutral-800/40 bg-white/70 px-4 py-1.5 text-xs font-bold tracking-widest text-neutral-800 uppercase backdrop-blur hover:bg-white"
      style={{ right: 24, bottom: 24 }}
    >
      Replay
    </button>
  );
}

function PlainLoader({ onDone }: { onDone: () => void }) {
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

  const leaving = useRef(false);
  useEffect(() => {
    let alive = true;
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const minShow = new Promise<void>((r) => window.setTimeout(r, MIN_SHOW * 1000));
    const maxWait = new Promise<void>((r) => window.setTimeout(r, MAX_WAIT * 1000));
    Promise.race([Promise.all([fonts, minShow]), maxWait]).then(() => {
      if (!alive || leaving.current) return;
      leaving.current = true;
      animate(y, -(vh + pad), { duration: SLIDE_T, ease: [0.55, 0, 0.75, 0.55] }).then(() => {
        sessionStorage.setItem(INTRO_SESSION_KEY, "1");
        window.dispatchEvent(new Event(INTRO_DISMISSED_EVENT));
        onDone();
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-50 overflow-hidden select-none"
      style={{ height: vh + pad, y, clipPath: clip, backgroundColor: BLUE, ...noiseBg("blue", unit) }}
    >
      {/* 左上 logo：和顶栏同一个盒子、同一个位置，拉走后正好接上 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center" style={navBarStyle("#FFFFFF")}>
        <NavLogo />
      </div>
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
