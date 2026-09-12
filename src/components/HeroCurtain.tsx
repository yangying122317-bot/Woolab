import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { INTRO_DISMISSED_EVENT, INTRO_SESSION_KEY } from "../state/intro";
import { useReportNavHidden } from "../state/chrome";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * 首页开场的那块白布：压在首页场景上面，把整个房子盖住。
 * 布上是一台小电视（屏幕里雪花闪着、Getting Meelo ready... 跟着抖）和一条横穿画面的手写 woolab 签名线：
 * 淡的一条是完整的签名，深的那条从左往右一笔一笔描上去，描到哪算加载到哪
 * （进度 = 图下了几成 和 时间过了几成 里较小的那个，两头都满了线才画完）。
 * 这里只管：等首页第一屏的图 + 字体 + 最短停留（最长兜底）→ 线画满 → 电视关机（压成一条亮线缩没）→ 报 onLoaded；
 * 外面（HeroScene）把 slide 置真 → 布整块向上拉走、底边拖一个弧 →
 * 写会话标记（预览不写）、广播离场事件、报 onDone。布盖着期间顶栏整条藏起来。
 */

/** 至少停这么久，签名线起码能完整描一遍 */
const MIN_SHOW = 1.6;
/** 图再没下完也走，别把人卡在开屏 */
const MAX_WAIT = 7;
/** 线画满后再等一下让弹簧追上，再报加载完成 */
const SETTLE_MS = 350;
/** 拉走的时长 */
export const CURTAIN_SLIDE_T = 0.7;
/** 底边拖弧：最多鼓多少（占屏高）、速度→弧深的系数 */
const SAG_MAX = 0.14;
const SAG_K = 0.1;

/* ---- 稿子（720×450 画板）上的东西 ---- */
const BOARD_W = 720;
const BOARD_H = 450;
/** 电视：位置尺寸按画板坐标 */
const TV = {
  src: "/assets/hero-loading-tv.png",
  x: 296,
  y: 183,
  w: 127,
  h: 84,
};
/**
 * 屏幕（灰色那块）：位置尺寸按画板坐标，底色和图里一致；
 * 形状用稿里那个手绘矢量原样裁（四边微鼓、四角不规则），按 0～1 的相对坐标定义、跟着屏幕缩放。
 * 描边（1.5，居中）是画在图上的，这层压在图上面，所以往里收一点别盖住描边。
 */
const SCREEN = {
  x: 313,
  y: 197,
  w: 100,
  h: 57,
  bg: "#B4B4B4",
  off: "#2A2A2A",
  clipId: "hero-tv-screen-clip",
  path: "M0.86 2.51C0.21 17.25 -0.7 48.48 0.86 55.5C6.69 57.1 93.4 57.86 97.64 55.5C101.89 53.14 99.75 6.65 96.35 2.51C92.96 -1.64 4.38 0.08 0.86 2.51Z",
  /** 往里收多少：屏幕描边另外叠在最上面（见 SCREEN_FRAME），这里不用收 */
  inset: 0,
};
/** 屏幕的手绘描边，单独一张图压在雪花上面（导出框比 100×57 大一圈：描边和噪点溢出） */
const SCREEN_FRAME = {
  src: "/assets/hero-loading-tv-frame.png",
  w: 103.33,
  h: 60.33,
};
/** 裁形模板的变换：先把稿坐标压到 0～1，再绕中心往里缩 inset */
const screenClipTransform = () => {
  const sx = 1 - (2 * SCREEN.inset) / SCREEN.w;
  const sy = 1 - (2 * SCREEN.inset) / SCREEN.h;
  return `translate(0.5 0.5) scale(${sx} ${sy}) translate(-0.5 -0.5) scale(${1 / SCREEN.w} ${1 / SCREEN.h})`;
};
/** 屏幕里那两行字的字号、颜色 */
const TV_TEXT = { size: 12, color: "#5E5B58" };
/** 雪花画布的分辨率（拉伸到屏幕大小，颗粒感刚好） */
const SNOW = { w: 120, h: 66, alpha: 0.34 };
/** 关机收尾：先压成一条亮线，再从两边缩没 */
const SHUTOFF_T = 0.34;
/**
 * 手写签名线：稿里是一根 1.5 描边的矢量，带一个斜切变换（写字的倾斜）。
 * 路径已按书写顺序接成一笔（左端从画板外进来 → 中间 → 右端出画板外），
 * 这样按 pathLength 描线就是从左往右写字的效果。
 */
const SIGN = {
  d: "M0 68.3C120.52 69.87 152.9 22.18 137.37 24.67C134.19 26.44 125.9 32.38 117.5 41.53C102.56 57.82 105.11 66.12 129.27 59.11C135.87 57.19 141.1 55.43 146.24 53.22C156.58 48.78 164.35 42.92 169.22 38.22C171.91 35.62 173.64 33.73 175.87 32C178.21 30.2 162.48 44.17 159.67 48.59C142.38 75.72 217.98 46.94 231.09 39.15C236.55 35.9 222.27 50 216.5 60.24C207.57 76.09 281.49 50.98 250.39 39.38C248.96 38.85 234.13 37.89 234.71 38.83C238.05 44.34 272.08 33.24 269.4 42.63C267.32 49.9 265.08 53.35 265.15 58.05C265.18 59.64 266.99 60.62 268.34 61.64C280.28 70.54 305.75 51.42 303.92 42.12C302.38 34.32 256.53 42.9 293.06 39.98C301.63 39.29 493.61 51.56 525.38 41.29C588.69 20.83 596.31 -5.1 583.37 0.87C578.23 3.25 542.77 41.84 536.85 45.99C514.58 61.62 529.43 63.09 561.04 62.17C576.68 61.71 602.18 56.38 607.47 44.12C608.2 42.42 607.15 40.78 606.04 39.71C593.09 27.28 557.66 37.2 558.84 54.51C560.02 71.82 583.03 62.77 589.86 60.15C596.84 57.47 601.85 54.32 606.09 48.55C607.9 46.11 607.47 44.07 607.47 44.12C607.47 82.08 642.31 55.15 660.02 34.7C670.34 22.78 673.56 7.45 664.47 28.6C659.87 39.29 655.74 45.47 654.94 48.93C651.59 63.36 659.03 71.12 675.79 59.25C690.65 48.74 657.44 40.4 656.46 48.28C652.17 82.9 782.7 59.91 800.71 55.02",
  transform: "matrix(0.99995 -0.00992 -0.6474 0.76215 -15.28 226.94)",
  width: 1.5,
  /** 完整那条的透明度 */
  trackAlpha: 0.1,
};

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
  useReportNavHidden(true);
  const { t } = useLanguage();

  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const { w: vw, h: vh } = vp;
  /* 画板按"盖满"缩放：签名线两头要出画面 */
  const u = Math.max(vw / BOARD_W, vh / BOARD_H);
  const boardLeft = (vw - BOARD_W * u) / 2;
  const boardTop = (vh - BOARD_H * u) / 2;

  const pad = SAG_MAX * vh;
  const y = useMotionValue(0);
  const vel = useVelocity(y);
  const sagRaw = useTransform(vel, (v) => Math.min(Math.abs(v) * SAG_K, pad));
  const sag = useSpring(sagRaw, { stiffness: 140, damping: 16 });
  const clip = useTransform(
    sag,
    (d) => `path("M0 0 H${vw} V${vh} Q${vw / 2} ${vh + d} 0 ${vh} Z")`,
  );

  /* 进度：目标值按帧算，弹簧跟着走，线就描得顺 */
  const target = useMotionValue(0);
  const drawn = useSpring(target, {
    stiffness: 70,
    damping: 20,
    restDelta: 0.001,
  });

  /* 加载判定 */
  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    let done = 0;
    const total = Math.max(preload.length, 1);
    const assets = Promise.all(
      preload.map((src) =>
        loaded(src).then(() => {
          done += 1;
        }),
      ),
    );
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const minShow = new Promise<void>((r) =>
      window.setTimeout(r, MIN_SHOW * 1000),
    );
    const maxWait = new Promise<void>((r) =>
      window.setTimeout(r, MAX_WAIT * 1000),
    );

    let raf = 0;
    const tick = () => {
      if (!alive) return;
      const timeFrac = Math.min(
        (performance.now() - t0) / (MIN_SHOW * 1000),
        1,
      );
      const assetFrac = preload.length ? done / total : 1;
      target.set(Math.min(timeFrac, assetFrac));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    Promise.race([Promise.all([assets, fonts, minShow]), maxWait]).then(() => {
      if (!alive) return;
      cancelAnimationFrame(raf);
      target.set(1);
      // 线描满 → 电视"关机"→ 报加载完成（外面随即拉布）
      window.setTimeout(() => {
        if (alive) setShutoff(true);
      }, SETTLE_MS);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 雪花屏 + 字抖：每帧重画一张低分辨率的随机灰点，叠一条慢慢往下滚的暗带；字跟着小幅乱跳 */
  const [shutoff, setShutoff] = useState(false);
  const snowRef = useRef<HTMLCanvasElement | null>(null);
  const jitterX = useMotionValue(0);
  const jitterY = useMotionValue(0);
  useEffect(() => {
    if (shutoff) return;
    const canvas = snowRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { w, h } = SNOW;
    const img = ctx.createImageData(w, h);
    const px = img.data;
    let band = 0;
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame += 1;
      // 雪花每两帧换一次，更像老电视那种粗糙的闪
      if (frame % 2 === 0) {
        band = (band + 0.7) % (h + 14);
        for (let yy = 0; yy < h; yy += 1) {
          // 暗带：离带中心越近越暗
          const dBand = Math.abs(yy - band + 7);
          const dim = dBand < 7 ? 0.45 + (dBand / 7) * 0.55 : 1;
          for (let xx = 0; xx < w; xx += 1) {
            const i = (yy * w + xx) * 4;
            const v = Math.random() * 255 * dim;
            px[i] = v;
            px[i + 1] = v;
            px[i + 2] = v;
            px[i + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
        // 字：大多数时候轻微颤，偶尔横向跳一下
        const kick =
          Math.random() < 0.06 ? (Math.random() < 0.5 ? -1 : 1) * 2.4 : 0;
        jitterX.set((Math.random() - 0.5) * 1.1 + kick);
        jitterY.set((Math.random() - 0.5) * 0.9);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shutoff]);
  /* 字的抖动量按画板单位算，这里换成像素 */
  const textX = useTransform(jitterX, (v) => v * u);
  const textY = useTransform(jitterY, (v) => v * u);

  /* 拉走 */
  const sliding = useRef(false);
  useEffect(() => {
    if (!slide || sliding.current) return;
    sliding.current = true;
    animate(y, -(vh + pad), {
      duration: CURTAIN_SLIDE_T,
      ease: [0.55, 0, 0.75, 0.55],
    }).then(() => {
      if (!preview) sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      window.dispatchEvent(new Event(INTRO_DISMISSED_EVENT));
      onDone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  return (
    <motion.div
      className="pointer-events-auto absolute inset-x-0 top-0 select-none overflow-hidden bg-white"
      style={{
        height: vh + pad,
        y,
        clipPath: clip,
        zIndex: 20,
      }}
    >
      {/* 画板：签名线 + 电视 + 屏幕里的字，一起按 u 缩放、居中 */}
      <div
        className="absolute"
        style={{
          left: boardLeft,
          top: boardTop,
          width: BOARD_W * u,
          height: BOARD_H * u,
        }}
      >
        <svg
          className="absolute inset-0 overflow-visible"
          width={BOARD_W * u}
          height={BOARD_H * u}
          viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
          aria-hidden
        >
          <g
            transform={SIGN.transform}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* 完整的签名，淡淡的 */}
            <path
              d={SIGN.d}
              stroke="#000"
              strokeOpacity={SIGN.trackAlpha}
              strokeWidth={SIGN.width}
            />
            {/* 描到哪算加载到哪 */}
            <motion.path
              d={SIGN.d}
              stroke="#000"
              strokeWidth={SIGN.width}
              style={{ pathLength: drawn }}
            />
          </g>
        </svg>

        <img
          src={TV.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute"
          style={{
            left: TV.x * u,
            top: TV.y * u,
            width: TV.w * u,
            height: TV.h * u,
          }}
        />
        {/* 屏幕形状的裁形模板：0～1 相对坐标，套在下面那层上 */}
        <svg width="0" height="0" className="absolute" aria-hidden>
          <clipPath id={SCREEN.clipId} clipPathUnits="objectBoundingBox">
            <path d={SCREEN.path} transform={screenClipTransform()} />
          </clipPath>
        </svg>
        {/* 屏幕：整块按手绘屏幕的形状裁掉；底下一层关机后的深色，上面是灰屏 + 雪花 + 字；
            关机时灰屏先压成一条亮线再从两边缩没（裁形在外层，缩的是裁好的屏幕） */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: SCREEN.x * u,
            top: SCREEN.y * u,
            width: SCREEN.w * u,
            height: SCREEN.h * u,
            background: SCREEN.off,
            clipPath: `url(#${SCREEN.clipId})`,
          }}
        >
          <motion.div
            className="absolute inset-0 overflow-hidden"
            style={{ background: SCREEN.bg }}
            initial={false}
            animate={
              shutoff
                ? {
                    scaleY: [1, 0.035, 0.035],
                    scaleX: [1, 1, 0],
                    backgroundColor: [SCREEN.bg, "#FFFFFF", "#FFFFFF"],
                    boxShadow: [
                      "0 0 0 rgba(255,255,255,0)",
                      `0 0 ${6 * u}px rgba(255,255,255,0.9)`,
                      `0 0 ${2 * u}px rgba(255,255,255,0.6)`,
                    ],
                  }
                : {}
            }
            transition={{
              duration: SHUTOFF_T,
              times: [0, 0.55, 1],
              ease: "easeIn",
            }}
            onAnimationComplete={() => {
              if (shutoff) onLoaded();
            }}
          >
            <canvas
              ref={snowRef}
              width={SNOW.w}
              height={SNOW.h}
              className="absolute inset-0 h-full w-full"
              style={{
                opacity: shutoff ? 0 : SNOW.alpha,
                imageRendering: "pixelated",
              }}
              aria-hidden
            />
            <motion.div
              className="font-look absolute inset-0 flex items-center justify-center text-center whitespace-pre-line"
              style={{
                x: textX,
                y: textY,
                fontSize: TV_TEXT.size * u,
                lineHeight: 1.1,
                fontWeight: 900,
                color: TV_TEXT.color,
                /* 雪花上压一圈同色的柔光，字才读得清 */
                textShadow: `0 0 ${2 * u}px ${SCREEN.bg}, 0 0 ${4 * u}px ${SCREEN.bg}`,
                opacity: shutoff ? 0 : 1,
              }}
            >
              {t("intro.ready")}
            </motion.div>
          </motion.div>
        </div>
        {/* 屏幕描边：压在雪花最上面，雪花的边就藏在描边底下 */}
        <img
          src={SCREEN_FRAME.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute"
          style={{
            left: (SCREEN.x - (SCREEN_FRAME.w - SCREEN.w) / 2) * u,
            top: (SCREEN.y - (SCREEN_FRAME.h - SCREEN.h) / 2) * u,
            width: SCREEN_FRAME.w * u,
            height: SCREEN_FRAME.h * u,
          }}
        />
      </div>
    </motion.div>
  );
}
