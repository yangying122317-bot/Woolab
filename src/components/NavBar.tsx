import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "../i18n/LanguageContext";
import { isMuted, onMutedChange, playNavClick, setMuted } from "../audio/sfx";

/**
 * 顶栏本体：左 logo，右 MENU / CN · EN / 喇叭。
 *
 * 尺寸全按设计稿（720 宽的 0.5x 稿）等比放：1 个稿单位 = --mu，取 100vw/720 与 100vh/450 里小的那个，
 * 1440×900 上正好 2px。颜色走 currentColor，logo / 喇叭 / 画圈都是白色 svg 拿来当 mask 再上色，
 * 所以浅色页给深字、深色页 / 目录黑底上给白字，改一个 color 就行。
 *
 * 同一份在两处用：平时贴在页面上；目录打开时黑底那层里再画一份白的（MENU 上多一圈手绘圈）。
 */
export const MU = "min(0.138889vw, 0.222222vh)";

/** 稿单位换算：mu(25) → calc(var(--mu) * 25) */
export const mu = (n: number) => `calc(var(--mu) * ${n})`;

function maskStyle(url: string): CSSProperties {
  return {
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    background: "currentColor",
  };
}

/* 手绘涂鸦的两个状态：画满 / 收在最左边（从左往右"画"出来） */
const DOODLE_ON = "inset(-10% 0% -10% 0%)";
const DOODLE_OFF = "inset(-10% 100% -10% 0%)";

/**
 * 两种手绘涂鸦轮着来：画圈 → 划线。每次 hover 到一个词就换下一种，
 * 三个词之间共用一个计数，所以来回扫过去看到的花样不重样。
 * 位置都是相对被套住的那个词（百分比），svg 很扁，按框拉伸。
 */
type Doodle = "circle" | "underline";
const DOODLES: Doodle[] = ["circle", "underline"];
let doodleTurn = 0;
const DOODLE_BOX: Record<Doodle, CSSProperties> = {
  circle: {
    left: "-42%",
    right: "-42%",
    top: "-38%",
    bottom: "-38%",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
  },
  underline: {
    left: "-6%",
    right: "-8%",
    top: "92%",
    height: "38%",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
  },
};

/**
 * 顶栏上 MENU / CN / EN 各套这一层：
 * - hover：外面画出一笔涂鸦（圈 / 线轮着来），移开就淡掉；
 * - 点击：涂鸦再留半拍（触屏没有 hover，靠这个看到反馈）；`held` 为真时一直留着（MENU 打开期间）。
 * 涂鸦是在 onClickCapture 里触发的，里面的按钮该干嘛照干嘛。
 */
export function NavHit({
  held = false,
  children,
  className = "",
}: {
  held?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [flash, setFlash] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [hover, setHover] = useState(false);
  const [doodle, setDoodle] = useState<Doodle>("circle");
  useEffect(() => {
    if (!flash) return;
    setDrawing(true);
    const id = window.setTimeout(() => setDrawing(false), 700);
    return () => window.clearTimeout(id);
  }, [flash]);
  const on = held || hover || drawing;
  /* 从"没画"到"要画"的那一刻换花样；画着的时候不换，免得半路变形 */
  const next = () => {
    if (on) return;
    setDoodle(DOODLES[doodleTurn++ % DOODLES.length]);
  };

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      onClickCapture={() => {
        next();
        setFlash((f) => f + 1);
        playNavClick();
      }}
      onPointerEnter={() => {
        next();
        setHover(true);
      }}
      onPointerLeave={() => setHover(false)}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute block"
        style={{ ...maskStyle(`/assets/menu/${doodle}.svg`), ...DOODLE_BOX[doodle] }}
        initial={{ clipPath: DOODLE_OFF, opacity: 0 }}
        animate={on ? { clipPath: DOODLE_ON, opacity: 1 } : { clipPath: DOODLE_OFF, opacity: 0 }}
        transition={
          on
            ? { clipPath: { duration: 0.4, ease: "easeInOut" }, opacity: { duration: 0.01 } }
            : { clipPath: { duration: 0.01, delay: 0.25 }, opacity: { duration: 0.25 } }
        }
      />
      {children}
    </span>
  );
}

/** 左上角的 WOOLAB logo（点回首页）。单独导出：需要把它从混合模式里拎出来单画一份时用（见 TopNav） */
export function NavLogo({ disabled = false }: { disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <Link to="/" className={`block ${disabled ? "pointer-events-none" : "pointer-events-auto"}`} aria-label={t("siteName")}>
      <span className="block" style={{ ...maskStyle("/assets/menu/logo.svg"), width: mu(73), height: mu(23) }} />
    </Link>
  );
}

/** 顶栏那一条的盒子样式（高度 / 左右留白 / 稿单位），logo 单画一份时要和顶栏对齐 */
export const navBarStyle = (color: string): CSSProperties => ({
  ["--mu" as string]: MU,
  /* 稿上是 72，等比放到大屏上顶部空得太多，收到 52（文字中心 ≈ 26 个稿单位） */
  height: mu(52),
  paddingLeft: mu(25),
  paddingRight: mu(25),
  color,
});

export default function NavBar({
  color,
  menuOpen,
  onMenu,
  extra,
  hideLogo = false,
  logoOnly = false,
  hidden = false,
  className = "",
}: {
  /** 文字 / 图标颜色 */
  color: string;
  /** 目录是否打开：打开时 MENU 外面画一圈 */
  menuOpen: boolean;
  onMenu: () => void;
  /** 塞在喇叭前面的额外按钮（首页的场景开关：时段 + 天气） */
  extra?: ReactNode;
  /** 不画左边的 logo（Lab 详情页那里左上角是"回画廊"） */
  hideLogo?: boolean;
  /** 只留 logo，右边那组先藏着（内页加载页盖着的时候），放开后淡进来 */
  logoOnly?: boolean;
  /** 整条都藏着、不接鼠标（首页开场白布盖着的时候），放开后整条淡进来 */
  hidden?: boolean;
  className?: string;
}) {
  const { t, lang, setLang } = useLanguage();
  const [muted, setMutedState] = useState(isMuted());
  useEffect(() => onMutedChange(setMutedState), []);
  const rightOff = logoOnly || hidden;

  return (
    <motion.div
      className={`pointer-events-none flex items-center justify-between ${className}`}
      style={{ ...navBarStyle(color), transition: "color 0.35s ease" }}
      initial={false}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: hidden ? 0 : 0.6, ease: "easeOut" }}
    >
      {/* 左：logo，点回首页 */}
      {hideLogo ? <span aria-hidden /> : <NavLogo disabled={hidden} />}

      {/* 右：MENU / CN · EN / 喇叭 */}
      <motion.div
        className={`font-nav flex items-center font-bold uppercase leading-[1.2] ${rightOff ? "pointer-events-none" : "pointer-events-auto"}`}
        style={{ fontSize: mu(12), letterSpacing: mu(0.6), gap: mu(26) }}
        initial={false}
        animate={{ opacity: rightOff ? 0 : 1 }}
        transition={{ duration: rightOff ? 0 : 0.6, ease: "easeOut" }}
      >
        {/* MENU：目录打开期间圈一直留着 */}
        <NavHit held={menuOpen}>
          <button
            type="button"
            onClick={onMenu}
            aria-label={menuOpen ? t("menu.close") : t("menu.open")}
            aria-expanded={menuOpen}
            className="cursor-pointer"
          >
            {menuOpen ? t("menu.closeLabel") : t("menu.label")}
          </button>
        </NavHit>

        <div className="flex items-center" style={{ gap: mu(9) }}>
          <NavHit>
            <button
              type="button"
              onClick={() => setLang("zh")}
              className="cursor-pointer transition-opacity hover:opacity-100"
              style={{ opacity: lang === "zh" ? 1 : 0.5 }}
              aria-pressed={lang === "zh"}
            >
              {/* 英文界面下这个入口写成「中」，让不认识 CN 的人也知道它是切中文 */}
              {lang === "en" ? "中" : "CN"}
            </button>
          </NavHit>
          <span aria-hidden>/</span>
          <NavHit>
            <button
              type="button"
              onClick={() => setLang("en")}
              className="cursor-pointer transition-opacity hover:opacity-100"
              style={{ opacity: lang === "en" ? 1 : 0.5 }}
              aria-pressed={lang === "en"}
            >
              EN
            </button>
          </NavHit>
        </div>

        {extra}

        <button
          type="button"
          onClick={() => {
            /* 先切状态再响：静音→开声时这一下就能听见，开声→静音时自然是安静的 */
            setMuted(!muted);
            playNavClick();
          }}
          aria-label={muted ? t("menu.sound.on") : t("menu.sound.off")}
          title={muted ? t("menu.sound.on") : t("menu.sound.off")}
          className="relative flex cursor-pointer items-center justify-center transition-opacity"
          style={{ width: mu(20), height: mu(20), opacity: muted ? 0.5 : 1 }}
        >
          <span className="block" style={{ ...maskStyle("/assets/menu/sound.svg"), width: mu(15.5), height: mu(13) }} />
          {/* 静音：斜着划一道 */}
          {muted && (
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rotate-45"
              style={{ width: mu(1.6), height: mu(22), background: "currentColor", borderRadius: mu(1) }}
            />
          )}
        </button>
      </motion.div>
    </motion.div>
  );
}
