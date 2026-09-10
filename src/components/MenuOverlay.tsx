import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { useLanguage } from "../i18n/LanguageContext";
import type { DictKey } from "../i18n/dict";
import NavBar from "./NavBar";
import { usePageShift } from "./PageShift";
import { seg01Layers } from "../data/seg01Layers";

/* ---------------- 设计稿坐标（720 × 450 的 0.5x 稿，下面全按 s 倍放） ---------------- */

const FRAME_W = 720;
const FRAME_H = 450;
const A = "/assets/menu";

type Box = { x: number; y: number; w: number; h: number };

type TagDef = {
  id: "about" | "lab" | "life" | "contact";
  path: string;
  title: string;
  sub: DictKey;
  /** 绳子（从画面顶上垂下来） */
  string: Box;
  /** 夹子；big 是 life 那只稍大的 */
  clip: Box & { big?: boolean };
  /** 夹子中心 = 整块牌子摆动的轴 */
  pivot: { x: number; y: number };
  /** 牛皮纸牌身（也是点击热区） */
  body: Box;
  sticker: Box;
  tape: { cx: number; cy: number; w: number; h: number; rotate: number; flip: boolean };
  mark: Box & { rotate: number };
  head: { cx: number; top: number };
  note: { cx: number; top: number; w: number; rotate: number };
  /** 掉落 / 收回的先后（秒） */
  delay: number;
};

const TAGS: TagDef[] = [
  {
    id: "about",
    path: "/about",
    title: "About",
    sub: "menu.about.sub",
    string: { x: 129.58, y: -36.66, w: 11.83, h: 221.74 },
    clip: { x: 122.77, y: 180.83, w: 16.54, h: 16.4 },
    pivot: { x: 131, y: 189 },
    body: { x: 79.35, y: 187.49, w: 101.65, h: 165.18 },
    sticker: { x: 83, y: 182, w: 80, h: 100.25 },
    tape: { cx: 143.02, cy: 215.05, w: 12.73, h: 20.04, rotate: 82.77, flip: true },
    mark: { x: 92, y: 283, w: 84.06, h: 26.83, rotate: 0 },
    head: { cx: 131, top: 288 },
    note: { cx: 131.24, top: 315, w: 91, rotate: 1.21 },
    delay: 0.08,
  },
  {
    id: "lab",
    path: "/lab",
    title: "Lab",
    sub: "menu.lab.sub",
    string: { x: 272.6, y: -61.81, w: 7.52, h: 220.53 },
    clip: { x: 270.44, y: 155.83, w: 16.54, h: 16.4 },
    pivot: { x: 278.67, y: 164 },
    body: { x: 221.32, y: 162.01, w: 114.33, h: 141.48 },
    sticker: { x: 226, y: 160, w: 91.75, h: 83.25 },
    tape: { cx: 326.08, cy: 206, w: 13.6, h: 28.12, rotate: 127.75, flip: false },
    mark: { x: 236, y: 239, w: 84.06, h: 26.83, rotate: 2.15 },
    head: { cx: 278.5, top: 241 },
    note: { cx: 281, top: 265.94, w: 84, rotate: -2.83 },
    delay: 0.22,
  },
  {
    id: "life",
    path: "/life",
    title: "Life",
    sub: "menu.life.sub",
    string: { x: 422.57, y: -3.75, w: 7.28, h: 139.45 },
    clip: { x: 412.58, y: 131.9, w: 20.59, h: 20.39, big: true },
    pivot: { x: 422.88, y: 142.17 },
    body: { x: 364.48, y: 141.62, w: 110.16, h: 181.07 },
    sticker: { x: 377, y: 136.92, w: 86.75, h: 91.75 },
    tape: { cx: 375.05, cy: 246.15, w: 12.91, h: 22.83, rotate: 52.25, flip: true },
    mark: { x: 377.6, y: 249, w: 84.06, h: 26.83, rotate: 2.15 },
    head: { cx: 420, top: 252 },
    note: { cx: 418.74, top: 276, w: 60, rotate: -3.85 },
    delay: 0,
  },
  {
    id: "contact",
    path: "/contact",
    title: "Contact",
    sub: "menu.contact.sub",
    string: { x: 566.71, y: -35.83, w: 9.7, h: 220.55 },
    clip: { x: 566.77, y: 181.83, w: 16.54, h: 16.4 },
    pivot: { x: 575, y: 190 },
    body: { x: 510.5, y: 187.94, w: 130.16, h: 141.61 },
    sticker: { x: 544, y: 185, w: 62, h: 88 },
    tape: { cx: 522.15, cy: 253.66, w: 13.15, h: 22.32, rotate: 139.37, flip: true },
    mark: { x: 529, y: 276, w: 84.06, h: 26.83, rotate: 2.15 },
    head: { cx: 575.5, top: 281 },
    note: { cx: 575.5, top: 307, w: 120, rotate: 0 },
    delay: 0.3,
  },
];

/* ---------------- 节拍 ---------------- */

/** 牌子整个抬到画面外要走多远（稿单位）：最长的牌到 y≈352，加余量 */
const DROP = 380;
/** hover：牌子往下沉一点（稿单位） */
const HOVER_SINK = 6;
/**
 * 点中：往下拽一下，绳子绷紧（稿单位）；拽到底直接接着整体上飞，不停。
 * 拽的这段时间也是给新页面在黑底下面把图解码完的窗口（Life 的整面墙是张 5672×1800 的大图，
 * 低清 + 高清两轮光栅要 250ms 上下），别再往短了调。
 */
const DIP = 18;
/** 目录页的底色 */
const MENU_BG = "#44A4D3";
const DIP_T = 0.3;
/** 整页往上带走：起步慢、中段匀、收尾缓 */
const GO_T = 1.05;
const GO_EASE = [0.7, 0, 0.15, 1] as const;
/** 绳子顶端统一钉到屏幕外多高（视口高度的比例）：摆、拽、起势都别露出绳头 */
const ROPE_TOP = 0.3;
/** 蓝底动的时候底边往下坠的弧：按速度算，最深不超过视口的这个比例 */
const SAG_MAX = 0.2;
const SAG_K = 0.12;
/** 打开：蓝底像块布从上面盖下来（弹簧，0.9s 上下），牌子等布扫过再往下掉 */
const TAG_WAIT = 0.5;
/** 收回：牌子抬走 */
const LIFT_T = 0.5;
/** 收回：蓝底抽回屏幕上边 */
const PULL_T = 0.55;

type Phase = "in" | "out" | "go";

const MAX_DELAY = Math.max(...TAGS.map((tg) => tg.delay));
/** 收回按掉下来的反序：最后掉的最先走 */
const liftDelay = (tag: TagDef) => (MAX_DELAY - tag.delay) * 0.6;
const OUT_TOTAL = LIFT_T + MAX_DELAY * 0.6;
/** 收回：最后一块牌快出屏时蓝底就开始往上抽 */
const PULL_DELAY = Math.max(0, OUT_TOTAL - 0.15);

/**
 * 目录：蓝底像块布从上面盖下来（底边带弧，落地收平），四块牛皮纸吊牌跟着被绳子放下来，晃两下停住。
 * 绳子顶端钉在屏幕上边不动，牌子掉多深绳子就放多长，摆动也是绕绳子顶端摆。
 * - hover：这块牌往下沉一点、放大一点，其他三块变淡；
 * - 点：牌子往下拽一下（绳子绷紧），拽到底蓝底、牌子、顶栏一起往上带走，蓝底底边坠成一道弧，
 *   新页面从屏幕底下贴着一起上来（点下去那一刻就切了路由，目标页收到 from: "menu" 会跳过自己的开场）；
 * - 再点 MENU / 点蓝底 / Esc：牌子按掉下来的反序收回去，蓝底再抽回屏幕上边。
 */
export default function MenuOverlay({
  navColor,
  extra,
  onClosed,
}: {
  /** 黑底上那份顶栏的颜色（就是白） */
  navColor: string;
  extra?: ReactNode;
  /** 完全收起 / 跳转完成后通知外面卸载 */
  onClosed: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const pageY = usePageShift();
  const [phase, setPhase] = useState<Phase>("in");
  const [picked, setPicked] = useState<TagDef["id"] | null>(null);
  const [hovered, setHovered] = useState<TagDef["id"] | null>(null);
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const alive = useRef(true);
  /* 整块目录（黑底 + 牌 + 顶栏）的位移，跳页时和新页面一起动 */
  const rootY = useMotionValue(0);
  /* 蓝底自己的盒子：上面多 12vh 保险，下面多 SAG_MAX，弧才有地方坠 */
  const padTop = vp.h * 0.12;
  const line = padTop + vp.h;
  /* 蓝底自己的竖向位移：藏起来时整块布刚好在屏幕上边外面，0 是盖满 */
  const hidden = -(vp.h + padTop + SAG_MAX * vp.h);
  const dropY = useMotionValue(hidden);
  /*
   * 蓝底底边的弧：布动得越快中间坠得越深——盖下来、抽回去、整页上飞都算——
   * 起步和停住都是平的，再过一个软弹簧，停住时会回弹一下再收平，像块真布。
   */
  const velRoot = useVelocity(rootY);
  const velDrop = useVelocity(dropY);
  const sagRaw = useTransform([velRoot, velDrop], ([a, b]: number[]) =>
    Math.min((Math.abs(a) + Math.abs(b)) * SAG_K, SAG_MAX * vp.h),
  );
  const sag = useSpring(sagRaw, { stiffness: 140, damping: 16 });
  const clip = useTransform(sag, (d) => {
    const W = vp.w;
    return `path("M0 0 H${W} V${line} Q${W / 2} ${line + d} 0 ${line} Z")`;
  });

  /*
   * 目录一打开就把 Life / Lab 首屏的大图取回来解码好。
   * 不然点牌子上飞、新页面刚露头那一刻才解码，中段会卡一下。
   */
  useEffect(() => {
    const pad = (i: number) => String(i).padStart(2, "0");
    const urls = [
      ...seg01Layers.map((l) => `/assets/life/${l.dir ?? "seg01"}/${l.src}.webp`),
      /* 窗户 / 唱片的序列帧全都常驻 DOM，页面一露头就要全部解码，是上飞中段卡那一下的大头 */
      ...Array.from({ length: 24 }, (_, i) => `/assets/life/seg01/window-anim/f${pad(i)}.webp`),
      ...Array.from({ length: 36 }, (_, i) => `/assets/life/seg01/record-anim/f${pad(i)}.webp`),
      "/assets/life/seg01/record-disc.webp",
      "/assets/life/seg01/record-arm.webp",
      "/assets/life/room-bg-tile.webp",
      "/assets/lab/entrance-wall.webp",
      "/assets/lab/gallery-painting-big.webp",
      "/assets/lab/gallery-lamp-on.webp",
      "/assets/lab/prop-statue.webp",
      "/assets/lab/panel-tall.webp",
    ];
    const imgs = urls.map((src) => {
      const im = new Image();
      im.src = src;
      im.decode().catch(() => {});
      return im;
    });
    return () => imgs.forEach((im) => (im.src = ""));
  }, []);

  useEffect(() => {
    alive.current = true;
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    /* 打开期间底下页面别跟着滚 */
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      alive.current = false;
      window.removeEventListener("resize", on);
      document.documentElement.style.overflow = prev;
    };
  }, []);

  /* 稿 → 屏：整张 720×450 的稿等比放到宽度铺满（矮屏按高），水平居中，从顶上挂下来 */
  const s = Math.min(vp.w / FRAME_W, vp.h / FRAME_H);
  const ox = (vp.w - FRAME_W * s) / 2;

  /* 打开：布盖下来，略微欠阻尼，落地轻轻一顿 */
  useEffect(() => {
    const c = animate(dropY, 0, { type: "spring", stiffness: 62, damping: 15, mass: 1 });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (phase !== "in") return;
    setPhase("out");
    /* 牌子先抬走，最后一块快出屏时把布往上抽回去 */
    animate(dropY, hidden, { duration: PULL_T, ease: [0.5, 0, 0.8, 0.6], delay: PULL_DELAY });
    window.setTimeout(() => alive.current && onClosed(), (PULL_DELAY + PULL_T) * 1000 + 40);
  };

  const pick = (tag: TagDef) => {
    if (phase !== "in" || picked) return;
    setPicked(tag.id);
    setHovered(null);
    const vh = window.innerHeight;
    /*
     * 点下去这一刻就切路由。新页面先原位挂在黑底下面（黑底不透明，看不见），
     * 牌子往下拽的这 0.2s 里它就画过一遍、图也解码好了；要是一开始就把它推到屏外，
     * 浏览器会等它露头才解码，正好卡在上飞中段。
     * 带上 from: "menu"，目标页读到就跳过自己的开场遮罩——上飞本身就是过场。
     */
    navigate(tag.path, { state: { from: "menu" } });
    window.scrollTo(0, 0);
    /*
     * 先给页面那层一个看不出来的半像素位移：有 transform 它就单独成一层，
     * 整页的光栅化在拽牌子这 0.2s 里（黑底盖着）就做完了；
     * 不然等起飞那一帧才建层，光栅要 100 多毫秒，正好卡在起步上。
     */
    pageY?.set(0.5);
    window.setTimeout(() => {
      if (!alive.current) return;
      setPhase("go");
      /* 起飞前一帧把页面挪到屏幕底下（还被黑底盖着），然后黑底 0 → -1 屏、页面 +1 屏 → 0，同一条曲线贴着走 */
      pageY?.set(vh);
      const opts = { duration: GO_T, ease: GO_EASE };
      animate(rootY, -vh, opts).then(() => alive.current && onClosed());
      if (pageY) animate(pageY, 0, opts);
    }, DIP_T * 1000);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const px = (n: number) => n * s;
  const box = (b: Box): CSSProperties => ({
    position: "absolute",
    left: px(b.x),
    top: px(b.y),
    width: px(b.w),
    height: px(b.h),
  });

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60]"
      data-lenis-prevent=""
      style={{ y: rootY, willChange: picked ? "transform" : undefined }}
    >
      {/* 蓝底：点它关目录。从屏幕上边盖下来 / 抽回去，上下都多出一截，底边按 clip 裁成弧（静止时是直线） */}
      <motion.div
        className="absolute inset-x-0"
        style={{ top: -padTop, bottom: -SAG_MAX * vp.h, clipPath: clip, background: MENU_BG, y: dropY }}
        onClick={close}
      />

      {/* 蓝底上那份白顶栏：MENU 外面有圈，点它 / logo 都能走；布盖过顶栏那一带再显出来 */}
      <motion.div
        className="absolute inset-x-0 top-0 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "out" ? 0 : 1 }}
        transition={phase === "out" ? { duration: 0.25, delay: PULL_DELAY } : { duration: 0.2, delay: 0.12 }}
      >
        <NavBar color={navColor} menuOpen={phase === "in"} onMenu={close} extra={extra} />
      </motion.div>

      {/* 吊牌们：一张按稿等比放的画板，挂在顶边 */}
      {/* 画板本身不吃点击，点到牌子之间的空处要能落到蓝底上关目录 */}
      <div className="pointer-events-none absolute top-0" style={{ left: ox, width: px(FRAME_W), height: px(FRAME_H) }}>
        {TAGS.map((tag) => (
          <Tag
            key={tag.id}
            tag={tag}
            s={s}
            vh={vp.h}
            box={box}
            phase={phase}
            hovered={hovered === tag.id && !picked}
            dipped={picked === tag.id}
            dimmed={(picked ?? hovered) !== null && (picked ?? hovered) !== tag.id}
            note={t(tag.sub)}
            onHover={(on) => phase === "in" && !picked && setHovered(on ? tag.id : null)}
            onPick={() => pick(tag)}
          />
        ))}
      </div>
    </motion.div>,
    document.body,
  );
}

/* ---------------- 一块吊牌 ---------------- */

function Tag({
  tag,
  s,
  vh,
  box,
  phase,
  hovered,
  dipped,
  dimmed,
  note,
  onHover,
  onPick,
}: {
  tag: TagDef;
  s: number;
  vh: number;
  box: (b: Box) => CSSProperties;
  phase: Phase;
  /** 鼠标在它上面：下沉、放大 */
  hovered: boolean;
  /** 被点中：往下拽一下 */
  dipped: boolean;
  /** 别的牌被 hover / 点了：这块退一步 */
  dimmed: boolean;
  note: string;
  onHover: (on: boolean) => void;
  onPick: () => void;
}) {
  /* 牌子（夹子以下的一切）的竖向位置：-DROP*s 在屏外，0 挂好 */
  const y = useMotionValue(-DROP * s);
  const landed = useRef(false);
  /*
   * 摆动：绳子绕顶端转的角度 rot，不写关键帧，落地那一下给个角速度让弹簧自己晃出来——
   * 周期固定、幅度一次比一次小。牌子再用一个更软的弹簧跟着绳子（follow），
   * 两者的差就是牌子绕夹子"慢半拍"的那一点角度，挂着的东西就是这么动的。
   */
  const rot = useMotionValue(0);
  const follow = useSpring(rot, { stiffness: 90, damping: 7, mass: 1 });
  const bodyRot = useTransform([rot, follow], ([r, f]: number[]) => (f - r) * 1.6);
  const kicked = useRef(false);
  /* 四块牌方向交替、力度略不同，别同步晃 */
  const idx = TAGS.indexOf(tag);
  /* 轴挪高了，同样角度摆幅更大，力度相应给小 */
  const kick = (idx % 2 ? -1 : 1) * (15 + idx * 2);
  const swing = (velocity: number) => animate(rot, 0, { type: "spring", stiffness: 34, damping: 3, mass: 1, velocity });
  useMotionValueEvent(y, "change", (v) => {
    /* 第一次落到底（穿过 0）那帧撞出摆动 */
    if (!kicked.current && v >= -0.5) {
      kicked.current = true;
      swing(kick);
    }
  });
  /*
   * 绳子：顶端统一钉到屏幕外 ROPE_TOP 那么高（稿里画的绳头离屏边太近，一摆就露出来），
   * 下端接在夹子上；长度跟着牌子走——牌子掉多深绳子放多长，拽一下就绷长一点。
   */
  const ropeTop = -ROPE_TOP * vh;
  const ropeEnd = (tag.string.y + tag.string.h) * s;
  const ropeLen = ropeEnd - ropeTop;
  const rope: CSSProperties = {
    position: "absolute",
    left: tag.string.x * s,
    top: ropeTop,
    width: tag.string.w * s,
    height: ropeLen,
  };
  const ropeScale = useTransform(y, (v) => Math.max(0, (ropeLen + v) / ropeLen));
  /* 摆动轴 = 绳子顶端 */
  const pivot = `${(tag.string.x + tag.string.w / 2) * s}px ${ropeTop}px`;
  /* 放大以夹子为中心，往下长 */
  const clipOrigin = `${tag.pivot.x * s}px ${tag.pivot.y * s}px`;

  /* 放下来：等蓝底那块布盖过去再掉，弹簧到位，落地回弹时绳子也跟着长短一下 */
  useEffect(() => {
    const c = animate(y, 0, { type: "spring", stiffness: 105, damping: 13, mass: 1.1, delay: TAG_WAIT + tag.delay });
    c.then(() => {
      landed.current = true;
    });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 收回：反序抬走 */
  useEffect(() => {
    if (phase !== "out") return;
    landed.current = false;
    animate(y, -DROP * s, { duration: LIFT_T, ease: [0.5, 0, 0.8, 0.6], delay: liftDelay(tag) });
    animate(rot, 0, { duration: 0.3, ease: "easeOut" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* hover 下沉 / 点中拽一下：都只在挂好之后 */
  useEffect(() => {
    if (!landed.current) return;
    const target = dipped ? DIP * s : hovered ? HOVER_SINK * s : 0;
    animate(y, target, dipped ? { duration: DIP_T, ease: [0.3, 0, 0.7, 1] } : { duration: 0.35, ease: "easeOut" });
    /* 拽一下 / 沉一下也会带起一点晃 */
    if (dipped) swing(-kick * 0.7);
    else if (hovered) swing(kick * 0.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, dipped]);

  return (
    /* 外层：绳子 + 牌子一起绕绳子顶端摆 */
    <motion.div className="pointer-events-none absolute inset-0" style={{ transformOrigin: pivot, rotate: rot }}>
      {/* 绳子：顶端不动，按牌子位置伸长 */}
      <motion.img
        src={`${A}/string-${tag.id}.png`}
        alt=""
        draggable={false}
        style={{ ...rope, transformOrigin: "50% 0%", scaleY: ropeScale }}
      />

      {/* 牌子那组：掉落 / 下沉 / 拽，位置由 y 定 */}
      <motion.div
        className="absolute inset-0"
        style={{ y, rotate: bodyRot, transformOrigin: clipOrigin }}
        animate={{
          scale: dipped ? 1.02 : hovered ? 1.05 : 1,
          opacity: dimmed ? 0.45 : 1,
        }}
        transition={{ scale: { duration: 0.35, ease: "easeOut" }, opacity: { duration: 0.3 } }}
      >
        {/* 牌身 */}
        <img src={`${A}/tag-${tag.id}.webp`} alt="" draggable={false} style={box(tag.body)} />
        {/* 贴纸（带白描边） */}
        <img src={`${A}/sticker-${tag.id}.png`} alt="" draggable={false} style={box(tag.sticker)} />
        {/* 夹子 */}
        <img src={`${A}/${tag.clip.big ? "clip-big" : "clip"}.png`} alt="" draggable={false} style={box(tag.clip)} />
        {/* WOOLAB 水印（正片叠底压在纸上） */}
        <img
          src={`${A}/mark.png`}
          alt=""
          draggable={false}
          style={{ ...box(tag.mark), mixBlendMode: "multiply", rotate: `${tag.mark.rotate}deg` }}
        />
        {/* 胶带 */}
        <img
          src={`${A}/tape-${tag.id}.png`}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: (tag.tape.cx - tag.tape.w / 2) * s,
            top: (tag.tape.cy - tag.tape.h / 2) * s,
            width: tag.tape.w * s,
            height: tag.tape.h * s,
            transform: `rotate(${tag.tape.rotate}deg)${tag.tape.flip ? " scaleY(-1)" : ""}`,
          }}
        />
        {/* 标题 + 一句小字 */}
        <span
          className="font-nav absolute block whitespace-nowrap text-center font-black leading-[1.2] text-white"
          style={{
            left: tag.head.cx * s,
            top: tag.head.top * s,
            transform: "translateX(-50%)",
            fontSize: 20 * s,
            letterSpacing: 1 * s,
          }}
        >
          {tag.title}
        </span>
        <span
          className="font-scroll absolute block text-center leading-[1.2] text-white"
          style={{
            left: tag.note.cx * s,
            top: tag.note.top * s,
            /* 英文按稿宽折成两行；中文短，一行放完 */
            width: /[\u4e00-\u9fff]/.test(note) ? "auto" : tag.note.w * s,
            whiteSpace: /[\u4e00-\u9fff]/.test(note) ? "nowrap" : "normal",
            transform: `translateX(-50%) rotate(${tag.note.rotate}deg)`,
            fontSize: 10 * s,
          }}
        >
          {note}
        </span>

        {/* 点击热区 = 牌身 */}
        <button
          type="button"
          aria-label={tag.title}
          className="pointer-events-auto absolute cursor-pointer"
          style={box(tag.body)}
          onPointerEnter={() => onHover(true)}
          onPointerLeave={() => onHover(false)}
          onClick={onPick}
          disabled={phase !== "in"}
        />
      </motion.div>
    </motion.div>
  );
}
