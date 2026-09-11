import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { useNavigate } from "react-router-dom";
import { A, CARD_H, CARD_W, FRAME_PAD, WINDOW, box, noiseBg } from "./geom";
import MarkedText, { CIRCLE_AR, UNDERLINE_AR, decoDelay } from "./MarkedText";
import { aboutNext, type AboutShot } from "../../data/aboutShots";
import { useLanguage } from "../../i18n/LanguageContext";
import { useReportPlainNav } from "../../state/chrome";
import { playNavigate } from "../../audio/sfx";

/**
 * About 页最后翻过去的那页（Figma Frame 1 / 文案表第 06 条 What's Next）：
 * 蓝底从屏幕底下弹上来盖住相机页，顶边跟着速度鼓一个弧（和目录页落下来那块布同一套）；
 * 盖住后前面拍的 5 张相纸按 01→05 依次从上面掉进来、歪着叠好；再出标题下那行手写字。
 * 底边中间挖一个半圆缺口露出米白，米白条上左右两个链接去 Life / Lab。
 * 往上滚：整页退回屏幕底下，回到相机页。
 *
 * 稿是 720×578（比相机页的 450 高），按 min(vw/720, vh/578) 等比缩、贴着屏幕底边放；
 * 蓝底和米白条本身都是通栏的，两边多出来的直接铺满。
 */

const SW = 720;
const SH = 578;
const BLUE = "#44A4D3";
const CREAM = "#F8F9F4";
/** 蓝底底边（稿单位）；再往下是米白条 */
const BLUE_BOTTOM = 520;
/** 半圆缺口：弦宽 139、深 36 → 圆心在底边下面 55.5、半径 91.5 */
const NOTCH_R = 91.5;
const NOTCH_CY = 575.5;
/**
 * 缺口里的小羊水印（mark.webp 396×372，图里小羊本体占 y 7%～99%）：
 * 缺口顶 520 到屏幕底 578 的正中是 549，按本体中心对到这条线上
 */
const NOTCH_MARK = { cx: SW / 2, y: 520, w: 58, h: 54 };

/** 5 张相纸落定的位置（中心点）和歪斜；数组顺序就是叠放顺序（后面的压前面的） */
const CARDS: { shot: number; cx: number; cy: number; rot: number }[] = [
  { shot: 0, cx: 183.6, cy: 319, rot: -9.5 },
  { shot: 1, cx: 255, cy: 238, rot: 0 },
  { shot: 3, cx: 477.6, cy: 224.8, rot: 8.4 },
  { shot: 4, cx: 587.6, cy: 289.6, rot: 11.3 },
  { shot: 2, cx: 374, cy: 297, rot: 0 },
];

const TITLE = { y: 58 };
const SUB = { y: 86 };
const LINE = { cx: 360, y: 430, w: 560 };

/* 弧：动得越快鼓得越高 */
const SAG_MAX = 0.16;
const SAG_K = 0.1;
/* 节拍（秒） */
/** 布起来多久后相纸开始掉 */
const CARDS_AT = 0.85;
const CARD_GAP = 0.16;
const LINE_AT = CARDS_AT + (CARDS.length - 1) * CARD_GAP + 0.75;
/** 退回去的时长 */
const LEAVE_T = 0.55;

export default function NextPage({
  vp,
  shots,
  onBack,
}: {
  vp: { w: number; h: number };
  shots: AboutShot[];
  /** 已经退回屏幕底下、可以卸载了 */
  onBack: () => void;
}) {
  const { lang, pick } = useLanguage();
  const navigate = useNavigate();

  const s = Math.min(vp.w / SW, vp.h / SH);
  const left = (vp.w - SW * s) / 2;
  const top = vp.h - SH * s;
  /* 页脚链接和顶栏 logo / 喇叭同一条边距（顶栏按 720×450 缩） */
  const inset = Math.min(vp.w / 720, vp.h / 450) * 25;

  /* 盒子比屏幕高出 pad，弧才有地方鼓 */
  const pad = SAG_MAX * vp.h;
  const hidden = vp.h + pad;
  const y = useMotionValue(hidden);
  const vel = useVelocity(y);
  const sagRaw = useTransform(vel, (v) => Math.min(Math.abs(v) * SAG_K, pad));
  const sag = useSpring(sagRaw, { stiffness: 140, damping: 16 });
  const clip = useTransform(sag, (d) => `path("M0 ${pad} Q${vp.w / 2} ${pad - d} ${vp.w} ${pad} V${pad + vp.h} H0 Z")`);

  /* 顶栏：蓝底的弧顶盖过顶栏那一刻换成纯白（米白上白字看不见，蓝上 difference 又会变橙） */
  const edgeTop = useTransform([y, sag], ([a, b]: number[]) => a - b);
  const [coversNav, setCoversNav] = useState(false);
  useMotionValueEvent(edgeTop, "change", (v) => setCoversNav(v < vp.h * 0.05));
  useReportPlainNav(coversNav);

  const leaving = useRef(false);
  const [hover, setHover] = useState<number | null>(null);
  /* 相纸全落定之前，动画带着各自的延时；落定后 hover 的进出要即时 */
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const c = animate(y, 0, { type: "spring", stiffness: 62, damping: 15, mass: 1 });
    const t = window.setTimeout(() => setLanded(true), (CARDS_AT + (CARDS.length - 1) * CARD_GAP + 1.0) * 1000);
    return () => {
      c.stop();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    animate(y, hidden, { duration: LEAVE_T, ease: [0.5, 0, 0.8, 0.6] });
    window.setTimeout(onBack, LEAVE_T * 1000 + 40);
  };

  /* 往上滚 / 往上划 / 方向键 → 退回相机页 */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < -24) leave();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "PageUp") leave();
    };
    let ty = 0;
    const onTs = (e: TouchEvent) => (ty = e.touches[0].clientY);
    const onTe = (e: TouchEvent) => {
      if (e.changedTouches[0].clientY - ty > 60) leave();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTs, { passive: true });
    window.addEventListener("touchend", onTe);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTs);
      window.removeEventListener("touchend", onTe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (path: string) => {
    playNavigate();
    navigate(path);
  };

  const line = pick(aboutNext.line);

  return (
    <motion.div
      className="absolute inset-x-0 select-none"
      style={{
        top: -pad,
        height: vp.h + pad,
        y,
        clipPath: clip,
        backgroundColor: BLUE,
        ...noiseBg("blue", s),
        zIndex: 20,
      }}
    >
      {/* 下面这层的坐标都从可见区顶边算 */}
      <div className="absolute inset-x-0 bottom-0" style={{ top: pad }}>
        {/* 米白条 + 半圆缺口（两块噪点对到同一原点，拼起来没缝） */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            top: top + BLUE_BOTTOM * s,
            backgroundColor: CREAM,
            ...noiseBg("cream", s, 0, top + BLUE_BOTTOM * s),
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            left: vp.w / 2 - NOTCH_R * s,
            top: top + (NOTCH_CY - NOTCH_R) * s,
            width: NOTCH_R * 2 * s,
            height: NOTCH_R * 2 * s,
            backgroundColor: CREAM,
            ...noiseBg("cream", s, vp.w / 2 - NOTCH_R * s, top + (NOTCH_CY - NOTCH_R) * s),
          }}
        />

        {/* 稿坐标系 */}
        <div
          className="absolute"
          style={{ left, top, width: SW, height: SH, transform: `scale(${s})`, transformOrigin: "0 0" }}
        >
          {/* 缺口里的小羊水印 */}
          <img
            src={`${A}/mark.webp`}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              left: NOTCH_MARK.cx - NOTCH_MARK.w / 2,
              top: NOTCH_MARK.y,
              width: NOTCH_MARK.w,
              height: NOTCH_MARK.h,
            }}
          />

          {/* 标题 / 副标：铺满稿宽居中（motion 会接管 transform，不能靠 translateX(-50%)） */}
          <motion.div
            className="font-nav absolute whitespace-nowrap text-center font-black text-white"
            style={{ left: 0, width: SW, top: TITLE.y, fontSize: 20, lineHeight: 1.3 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {pick(aboutNext.title)}
          </motion.div>
          <motion.div
            className="font-look absolute whitespace-nowrap text-center text-white"
            style={{ left: 0, width: SW, top: SUB.y, fontSize: 14, lineHeight: 1.3 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {pick(aboutNext.sub)}
          </motion.div>

          {/* 5 张相纸：按拍摄顺序一张张从上面掉下来；hover 的那张浮到最前面 */}
          {CARDS.map((c, i) => {
            const shot = shots[c.shot];
            const order = c.shot;
            const fromRot = c.rot + (c.rot >= 0 ? 16 : -16);
            return (
              <motion.div
                key={shot.id}
                className="absolute"
                style={{
                  left: c.cx - CARD_W / 2,
                  top: c.cy - CARD_H / 2,
                  width: CARD_W,
                  height: CARD_H,
                  zIndex: hover === i ? 10 : i + 1,
                  filter: "drop-shadow(0 5px 8px rgba(0,0,0,0.14))",
                }}
                initial={{ y: -(top / s + c.cy + CARD_H), rotate: fromRot, scale: 1 }}
                animate={{
                  y: hover === i ? -6 : 0,
                  rotate: hover === i ? c.rot * 0.35 : c.rot,
                  scale: hover === i ? 1.06 : 1,
                  transition: landed
                    ? { type: "spring", stiffness: 260, damping: 22 }
                    : {
                        y: {
                          type: "spring",
                          stiffness: 150,
                          damping: 17,
                          mass: 1.1,
                          delay: CARDS_AT + order * CARD_GAP,
                        },
                        rotate: { type: "spring", stiffness: 120, damping: 14, delay: CARDS_AT + order * CARD_GAP },
                        scale: { duration: 0.35 },
                      },
                }}
                onHoverStart={() => landed && setHover(i)}
                onHoverEnd={() => setHover((h) => (h === i ? null : h))}
              >
                <div className="absolute overflow-hidden" style={{ ...box(WINDOW), background: "#F3F1EA" }}>
                  <img
                    src={shot.photo}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 h-full w-full max-w-none object-cover"
                  />
                </div>
                <img
                  src={`${A}/frame.webp`}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute max-w-none"
                  style={{
                    left: -FRAME_PAD,
                    top: -FRAME_PAD,
                    width: CARD_W + FRAME_PAD * 2,
                    height: CARD_H + FRAME_PAD * 2,
                  }}
                />
              </motion.div>
            );
          })}

          {/* 底下那行手写字 */}
          <MarkedText
            key={lang}
            text={line}
            cx={LINE.cx}
            y={LINE.y}
            w={LINE.w}
            className="font-hand"
            fontSize={16}
            lineHeight={1.4}
            color="#FFFFFF"
            tone="light"
            delay={LINE_AT}
          />
        </div>

        {/* 页脚两个链接：贴屏幕两边，竖向居中在米白条里 */}
        <motion.div
          className="font-nav absolute inset-x-0 flex items-center justify-between font-bold uppercase"
          style={{
            top: top + BLUE_BOTTOM * s,
            bottom: 0,
            paddingLeft: inset,
            paddingRight: inset,
            fontSize: 12 * s,
            letterSpacing: 0.6 * s,
            color: "#111",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: decoDelay(line, LINE_AT) + 0.3, duration: 0.5 }}
        >
          <FootLink label={pick(aboutNext.life)} onClick={() => go("/life")} />
          <FootLink label={pick(aboutNext.lab)} onClick={() => go("/lab")} />
        </motion.div>
      </div>
    </motion.div>
  );
}

/** 页脚入口：平时字底下一道手绘划线，hover 换成一个手绘圈（都按字的实际尺寸放，单位屏幕 px） */
function FootLink({ label, onClick }: { label: string; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, fs: 12 });
  const [hover, setHover] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (el) setSize({ w: el.offsetWidth, h: el.offsetHeight, fs: parseFloat(getComputedStyle(el).fontSize) || 12 });
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [label]);

  /* 圈 / 划线轮着来（两个入口共用计数，和顶栏 MENU 的涂鸦一个路数）；进来那一刻定花样，画着的时候不换 */
  const [doodle, setDoodle] = useState<Doodle>("circle");
  const enter = () => {
    setDoodle(DOODLES[doodleTurn++ % DOODLES.length]);
    setHover(true);
  };

  const uw = size.w * 1.06;
  const uh = uw * UNDERLINE_AR;
  const cw = Math.max(size.w + size.fs * 1.3, (size.h + 4) / CIRCLE_AR);
  const ch = cw * CIRCLE_AR;
  const deco =
    doodle === "circle"
      ? { src: `${A}/circle-l.png`, box: { x: size.w / 2 - cw / 2, y: size.h / 2 - ch / 2 + 1, w: cw, h: ch } }
      : { src: `${A}/underline-dark.png`, box: { x: size.w / 2 - uw / 2, y: size.h - uh * 0.35, w: uw, h: uh } };

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={enter}
      onMouseLeave={() => setHover(false)}
      className="relative cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 uppercase"
      style={{ color: "inherit", font: "inherit", letterSpacing: "inherit" }}
    >
      {label}
      {size.w > 0 && (
        <motion.img
          src={deco.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={box(deco.box)}
          initial={false}
          animate={{ clipPath: hover ? "inset(-6px -6px -6px -6px)" : "inset(-6px 100% -6px -6px)" }}
          transition={hover ? { duration: 0.4, ease: "easeOut" } : { duration: 0.2, ease: "easeIn" }}
        />
      )}
    </button>
  );
}

type Doodle = "circle" | "underline";
const DOODLES: Doodle[] = ["circle", "underline"];
let doodleTurn = 0;
