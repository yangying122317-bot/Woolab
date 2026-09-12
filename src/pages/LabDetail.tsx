import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
  type Variants,
} from "framer-motion";
import { labProjects, type LabProject, type Lookbook, type Marks } from "../data/labs";
import { useLanguage } from "../i18n/LanguageContext";
import type { Localized } from "../i18n/dict";
import { useSmoothContainer } from "../components/SmoothScroll";
import { MU } from "../components/NavBar";
import { useReportDetailOpen } from "../state/chrome";

/**
 * Lab 详情页：深色 lookbook。
 *
 * 视觉照设计稿（720 宽画板）搬过来：所有坐标 / 尺寸 / 字号都写成"稿子里的 px × u"，
 * u 由视口算出来，画板居中放大，两侧多出来的地方只铺石纹背景，
 * 这样字和图永远是稿子里的比例，宽屏、窄屏都不会乱。
 *
 * 滚动：
 *  1. 第一屏 = 页头 + 标签行 + 那段话 + 拼贴板，比一屏高的部分先正常滚，滚到拼贴底边贴屏底再钉住；
 *     打开时撕纸先擦出来，邮票 / 拍立得 / 小图一张张贴上去
 *  2. 页顶那只金框是钉在屏上的主角：一开始歪着挂，滚动时它不跟页头走，那段话、撕纸从它底下过去，
 *     它正好从撕纸底下两张小图中间穿过；一路慢慢扶正
 *  3. 再往下滚，通栏主图从底下整块顶上来把拼贴盖掉，停在那段话下面；主角浮在照片上被"托"回屏中；
 *     之后整页一起正常滚，主图完整露出
 *  4. 底部画框墙：主角落进墙上一排画框里（正好扶正）；再往下滑，下一只自己飞回页顶（点别的框也行）、
 *     边飞边歪回起始角度，变成新的主角，换产品重来；最后一件到头就停在墙上
 */

const A = "/assets/lab/detail";
/** 画板设计宽 */
const BOARD_W = 720;

/* ---- 第一屏（稿子 px）：标题在顶、主角金框在正中、那段话在下部；拼贴板在第一屏以下 ---- */
/** 稿子里标签行的 y；页头那套缩放按"这个位置落在屏幕竖直正中"来算 */
const LABEL_Y = 324;
/** 拼贴板顶在稿子里的位置；实际会被推到第一屏以下 */
const PHOTO_TOP = 440;
/**
 * 撕纸底下那两张小图（背面印花 / 正面小标）和它们的手写标注要不要放。
 * 现在先收起来，画面太满；数据和位置都留着，想放回来把这个改成 true 就行。
 */
const SHOW_CROPS = false;
/** 拼贴板高：放小图时到左边那句手写字的底（稿子 814 → ~1495），不放就到拍立得底 + 底下留一点 */
const COLLAGE_H = SHOW_CROPS ? 681 : 420;
const COLLAGE_PAD = 12;
/** 撕纸那一组（纸 + 表 + 拍立得 + 邮票 + 印章）比稿子放大的倍数，以纸顶边中心为锚 */
const PAPER_K = 1.15;
/** 撕纸底边（含投影）相对拼贴顶的位置 */
const PAPER_BOTTOM = 317 * PAPER_K;

/**
 * 两套缩放：
 *  - u：页头标题 / 那段话 / 两边标签 / 返回按钮（1080 高的屏约 1.67）。第一屏 = 标题在顶、
 *    主角金框在正中（尺寸另按屏高算，见 heroSize）、那段话在下部，撕纸在屏幕底下
 *  - uc：拼贴板和底部画框墙。按"页头到撕纸底装进一屏"算（约 1.28），不跟页头一起涨，免得撕纸太大
 * 两个都还受屏宽限制（照片总宽 800 要装进屏宽）。
 */
function boardUnits() {
  const byW = window.innerWidth / 820;
  const u = Math.min(2.2, Math.max(0.9, Math.min(window.innerHeight / (LABEL_Y * 2), byW)));
  const uc = Math.min(1.6, Math.max(0.9, Math.min(window.innerHeight / (PHOTO_TOP + PAPER_BOTTOM + 40), byW)));
  return { u, uc };
}

function useBoardUnits() {
  const [units, setUnits] = useState(boardUnits);
  useEffect(() => {
    const on = () => setUnits(boardUnits());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return units;
}

/** 稿子坐标 → 绝对定位样式（left/top/width/height 都是稿子 px） */
function box(u: number, x: number, y: number, w?: number, h?: number): CSSProperties {
  return {
    position: "absolute",
    left: x * u,
    top: y * u,
    width: w === undefined ? undefined : w * u,
    height: h === undefined ? undefined : h * u,
  };
}

/**
 * 稿子里带旋转的元素：Figma 给的是"旋转后的外接框 + 未旋转的内框 + 角度"，
 * 照搬：外框定位，内框居中后转。
 */
function Rotated({
  u,
  x,
  y,
  w,
  h,
  iw,
  ih,
  transform,
  style,
  children,
}: {
  u: number;
  x: number;
  y: number;
  w: number;
  h: number;
  iw: number;
  ih: number;
  transform: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        ...box(u, x, y, w, h),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <div
        style={{
          width: iw * u,
          height: ih * u,
          flex: "none",
          transform,
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Img({ src, style, fit = "cover" }: { src: string; style?: CSSProperties; fit?: CSSProperties["objectFit"] }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none select-none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: fit,
        ...style,
      }}
    />
  );
}

/* ---------------- 背景：石纹墙钉死不动；WOOLAB GOODS 水印那份跟着页头一起滚 ---------------- */

/**
 * 稿子里石纹图 1472×990 放在 (-376,-195)、50% 透明压在 #5a5454 上；按屏幕放大到不露边。
 * 50% 那步已经烙进图里（bg-stone-wall 是净墙，bg-stone-mark 带 WOOLAB GOODS 水印）。
 */
function stoneSize(u: number) {
  const w = Math.max(1472 * u, window.innerWidth);
  const h = Math.max(w * (990 / 1472), window.innerHeight + 195 * u);
  return { w, h };
}

/** 背景整体压一点饱和度（原图偏红），墙和水印那份用同一个值才接得上 */
const STONE_FILTER = "saturate(0.6)";

function StoneWall({ u }: { u: number }) {
  const { w, h } = stoneSize(u);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#5a5454]">
      <img
        src={`${A}/bg-stone-wall.webp`}
        alt=""
        draggable={false}
        className="absolute left-1/2 max-w-none -translate-x-1/2"
        style={{
          top: -195 * u,
          width: w,
          height: h,
          objectFit: "cover",
          objectPosition: "center top",
          filter: STONE_FILTER,
        }}
      />
    </div>
  );
}

/** 图里 WOOLAB GOODS 浮雕的位置（占图高的比例）：中心 753/1610，半高 138/1610 */
const MARK_CY = 753 / 1610;
const MARK_HALF = 138 / 1610;
/** 金框（95–262）的中心，水印要套在它上面 */
const FRAME_CY = (95 + 262) / 2;

/**
 * 带水印的那张。石纹图是按屏宽铺的（宽屏上比 u 大），所以不按稿子坐标摆，
 * 直接把浮雕中心对到 cy（屏幕 px）：
 *  - head：放在页头后面，对到金框中心，浮雕底下往下渐隐进墙里，那段话压在渐隐区上面
 *  - wall：放在底部画框墙后面，对到那排画框的中心，上下都渐隐
 */
function Watermark({ u, cy = FRAME_CY * u, mode = "head" }: { u: number; cy?: number; mode?: "head" | "wall" }) {
  const { w, h } = stoneSize(u);
  const half = MARK_HALF * h;
  const boxTop = mode === "head" ? 0 : cy - half - 120;
  const top = cy - MARK_CY * h - boxTop;
  const fadeFrom = cy + half + 16 - boxTop;
  const height = mode === "head" ? fadeFrom + 130 : (half + 120) * 2;
  const mask =
    mode === "head"
      ? `linear-gradient(to bottom, #000 ${fadeFrom}px, transparent 100%)`
      : "linear-gradient(to bottom, transparent 0, #000 32%, #000 68%, transparent 100%)";
  return (
    <div
      className="pointer-events-none absolute inset-x-0 overflow-hidden"
      style={{ top: boxTop, height, WebkitMaskImage: mask, maskImage: mask }}
    >
      <img
        src={`${A}/bg-stone-mark.webp`}
        alt=""
        draggable={false}
        className="absolute left-1/2 max-w-none -translate-x-1/2"
        style={{
          top,
          width: w,
          height: h,
          objectFit: "cover",
          objectPosition: "center top",
          filter: STONE_FILTER,
        }}
      />
    </div>
  );
}

/**
 * 详情页第一屏的"空墙"：石纹 + 水印，和 DetailPage 刚打开时（滚动为 0）的背景逐像素一样。
 * 画廊里点画框翻面、放大那一段，框形遮罩里露的就是这块；放大到满屏后换成真正的 DetailPage，接缝看不出来。
 */
export function DetailBackdrop() {
  const { u } = useBoardUnits();
  const [vh, setVh] = useState(() => window.innerHeight);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return (
    <div className="relative h-full w-full overflow-hidden">
      <StoneWall u={u} />
      <Watermark u={u} cy={vh / 2} />
    </div>
  );
}

/* ---------------- 顶部：Meelo's Closet 手写标题（金框单独做成钉在屏上的主角，见 HeroFrame） ---------------- */

function LookbookHead({ u, closet }: { u: number; closet: string }) {
  return (
    <Board u={u}>
      <Rotated u={u} x={297} y={22.44} w={126.87} h={29.1} iw={126.87} ih={29.1} transform="rotate(-2.33deg)">
        <p className="font-hand whitespace-nowrap text-center text-white" style={{ fontSize: 20 * u, lineHeight: 1.2 }}>
          {closet}
        </p>
      </Rotated>
      <img src={`${A}/underline-closet.svg`} alt="" draggable={false} style={box(u, 306, 47, 118.1, 10.5)} />
    </Board>
  );
}

/* ---------------- 金框：一只框 + 框里的画，页顶那只和墙上那排都用它 ---------------- */

/** 金框切图（自带阴影出血：外扩 3.71% / 8.66% / 10.93%）在稿子里的框：x/y/w/h */
const FRAME_X = 299.64 - 4.5;
const FRAME_Y = 95;
const FRAME_W = 136.28;
const FRAME_H = 167.5;
/** 框里的画（稿子 318,116 84×112）占切图框的比例 */
const FRAME_ART = {
  l: (318 - FRAME_X) / FRAME_W,
  t: (116 - FRAME_Y) / FRAME_H,
  w: 84 / FRAME_W,
  h: 112 / FRAME_H,
};

/** 按宽度画一只金框（高按切图比例跟着），框里是项目的画，没画的项目先放名字占位 */
function FramePiece({ project, width }: { project: LabProject; width: number }) {
  const { pick } = useLanguage();
  const h = (width * FRAME_H) / FRAME_W;
  const art = project.wall?.art;
  /* 连框带画的整张图：各产品框型不一样（方的 / 椭圆的），整张按比例装进同一个框位 */
  if (project.wall?.frame) {
    return (
      <div className="relative" style={{ width, height: h }}>
        <Img src={project.wall.frame} fit="contain" />
      </div>
    );
  }
  return (
    <div className="relative" style={{ width, height: h }}>
      <div
        className="absolute overflow-hidden bg-[#3f3939]"
        style={{ left: FRAME_ART.l * width, top: FRAME_ART.t * h, width: FRAME_ART.w * width, height: FRAME_ART.h * h }}
      >
        {art ? (
          <Img src={art} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center border border-dashed border-white/25 p-1 text-center text-white/60">
            <span className="font-hand" style={{ fontSize: width * 0.085, lineHeight: 1.25 }}>
              {pick(project.title)}
            </span>
          </div>
        )}
      </div>
      <img
        src={`${A}/gold-frame.webp`}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
      />
    </div>
  );
}

/** 标签行：钉在屏幕左右两边的竖直正中（和主角中心一条线），全程不动；换字时短暂淡入淡出 */
function LabelRow({ u, left, right }: { u: number; left: string; right: string }) {
  const s: CSSProperties = { fontSize: 12 * u, lineHeight: 1.2, top: "50%", transform: "translateY(-50%)" };
  const fade = {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: 0.18 },
  };
  return (
    <>
      <div className="font-look absolute z-30 whitespace-nowrap text-white" style={{ ...s, left: 25 * u }}>
        <AnimatePresence mode="wait">
          <motion.p key={left} {...fade}>
            {left}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="font-look absolute z-30 whitespace-nowrap text-right text-white" style={{ ...s, right: 20 * u }}>
        <AnimatePresence mode="wait">
          <motion.p key={right} {...fade}>
            {right}
          </motion.p>
        </AnimatePresence>
      </div>
    </>
  );
}

/* ---------------- 主图：通栏两张照片 + Back/Front 手写标注，打开时遮罩往下擦开 ---------------- */

/** 稿子里两张照片拼起来的总宽（-10 → 789），通栏后所有尺寸按 视口宽 / 799 换算 */
const STRIP_W = 799;
const STRIP_H = 285;

function useViewportWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/** 擦开用的缓动 */
const WIPE_EASE = [0.76, 0, 0.24, 1] as const;

function HeroStrip({
  lb,
  placeholder,
  reveal,
  scale,
  pad,
  delay = 0,
}: {
  lb?: Lookbook;
  placeholder: string;
  /** false = 一直盖着（翻转卡片里那份）；true = 挂载后自动擦开 */
  reveal: boolean;
  /**
   * 照片本体的缩放（只缩照片，撕纸边 / Back-Front 标注不动）。
   * 详情页里传滚动驱动的值：滚进屏时略大，走到主角下面时正好 1，像被慢慢按平贴到墙上；
   * 不传就是翻转卡片里那份，定在 1。
   */
  scale?: MotionValue<number>;
  /**
   * 上下撕纸边要吃掉的高度（px）：整块按这个加高，照片 cover 铺满（两侧多裁一点），
   * 这样撕边撕掉的是加出来的那部分，露出来的照片高度还是稿子那么高。
   */
  pad?: { top: number; bottom: number };
  delay?: number;
}) {
  const { pick } = useLanguage();
  const k = useViewportWidth() / STRIP_W;
  const hand: CSSProperties = { fontSize: 15 * k, lineHeight: 1.2 };
  const hidden = "inset(0 0 100% 0)";
  const shown = "inset(0 0 0% 0)";
  const padTop = pad?.top ?? 0;
  const H = STRIP_H * k + padTop + (pad?.bottom ?? 0);
  /* 两句标注：字、位置（稿子 799 宽的坐标）都可以每件自己定，默认是 T 恤 01 那张的；false = 不要 */
  const front =
    lb?.captions?.front === false
      ? null
      : { text: { zh: "正面", en: "Front" }, x: 654, y: 16, flip: false, ...lb?.captions?.front };
  const back =
    lb?.captions?.back === false ? null : { text: { zh: "背面", en: "Back" }, x: 172, y: 50, ...lb?.captions?.back };
  return (
    <div className="relative w-full overflow-hidden" style={{ height: H }}>
      <motion.div
        className="absolute inset-0"
        initial={{ clipPath: hidden }}
        animate={{ clipPath: reveal ? shown : hidden }}
        transition={{ duration: 1.15, delay, ease: WIPE_EASE }}
      >
        {lb ? (
          <>
            {/* 照片本体：正面在下、背面在上，背面右缘压住正面左缘（稿子 356–420 那段）；只有这一层缩放 */}
            <motion.div className="absolute inset-0" style={{ scale }}>
              {"strip" in lb.photos ? (
                <Img src={lb.photos.strip} />
              ) : (
                <>
                  <div style={{ ...box(k, 366, 0, 433), top: 0, height: H }}>
                    <Img src={lb.photos.front} />
                  </div>
                  <div style={{ ...box(k, 0, 0, 430), top: 0, height: H }}>
                    <Img src={lb.photos.back} />
                  </div>
                </>
              )}
            </motion.div>
            {/* Back / Front 手写标注：跟着照片可见区（加高的那段之下）走；位置每件可以自己调，别压到人 */}
            <div className="absolute inset-x-0" style={{ top: padTop, height: STRIP_H * k }}>
              {front && (
                <>
                  <Rotated
                    u={k}
                    x={front.x}
                    y={front.y}
                    w={42.26}
                    h={23.83}
                    iw={42.26}
                    ih={23.83}
                    transform="rotate(-8.68deg)"
                  >
                    <p className="font-hand whitespace-nowrap text-black" style={hand}>
                      {pick(front.text)}
                    </p>
                  </Rotated>
                  {/* 箭头默认从字底往左下指；flip 就往右下指（字放在东西左边的时候用） */}
                  <Rotated
                    u={k}
                    x={front.x + (front.flip ? -8 : 7)}
                    y={front.y + 31}
                    w={17.14}
                    h={32.59}
                    iw={12.04}
                    ih={31.64}
                    transform={front.flip ? "rotate(-10.05deg) scale(-1, -1)" : "rotate(10.05deg) scaleY(-1)"}
                  >
                    <Img src={`${A}/arrow-front.svg`} fit="fill" />
                  </Rotated>
                </>
              )}
              {back && (
                <>
                  <Rotated
                    u={k}
                    x={back.x}
                    y={back.y}
                    w={42.26}
                    h={23.83}
                    iw={42.26}
                    ih={23.83}
                    transform="rotate(-8.68deg)"
                  >
                    <p className="font-hand whitespace-nowrap text-black" style={hand}>
                      {pick(back.text)}
                    </p>
                  </Rotated>
                  <Rotated
                    u={k}
                    x={back.x + 21}
                    y={back.y + 20}
                    w={22.69}
                    h={33.19}
                    iw={12.04}
                    ih={31.64}
                    transform="rotate(157.93deg)"
                  >
                    <Img src={`${A}/arrow-back.svg`} fit="fill" />
                  </Rotated>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center border border-dashed border-white/30 bg-[#4a4444]/70 text-white/60">
            <span className="font-hand" style={{ fontSize: 22 * k }}>
              {placeholder}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ---------------- 那段话：打开时一行一行冒出来，和标签行同一排 ---------------- */

/** 块内坐标沿用稿子（那段话原来在照片底 663 到拼贴顶 814 之间） */
const DESC_Y0 = 663;
const DESC_H = 814 - DESC_Y0;
/** 那段话文字块的顶（块内稿子坐标）；第一行的中心要和标签行对齐 */
const DESC_TEXT_Y = 707.8;

type MarkBox = { l: number; t: number; w: number; h: number };
/** 装饰的 key：underline:0 / underline:1 / ... / circle */
type MarkKey = `underline:${number}` | "circle";

/** 一段话要画的装饰列表：[key, 词] */
function markList(marks: Marks | undefined): [MarkKey, string][] {
  const out: [MarkKey, string][] = [];
  marks?.underline?.forEach((w, i) => out.push([`underline:${i}`, w]));
  if (marks?.circle) out.push(["circle", marks.circle]);
  return out;
}

/** 把一行文字里要画装饰的词包成 span（拿来量位置），其余原样输出 */
function renderMarked(
  text: string,
  marks: [MarkKey, string][],
  setRef: (key: MarkKey, el: HTMLSpanElement | null) => void,
) {
  const hits: { key: MarkKey; at: number; len: number }[] = [];
  marks.forEach(([key, word]) => {
    const at = text.toLowerCase().indexOf(word.toLowerCase());
    if (at >= 0) hits.push({ key, at, len: word.length });
  });
  if (!hits.length) return text;
  hits.sort((a, b) => a.at - b.at);
  const out: ReactNode[] = [];
  let pos = 0;
  hits.forEach((h) => {
    if (h.at < pos) return; // 两个词重叠了，后面那个不画
    if (h.at > pos) out.push(text.slice(pos, h.at));
    out.push(
      <span key={h.key} ref={(el) => setRef(h.key, el)}>
        {text.slice(h.at, h.at + h.len)}
      </span>,
    );
    pos = h.at + h.len;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}

function Description({
  u,
  top,
  lines,
  marks,
  play,
  delay,
}: {
  u: number;
  /** 块顶在所属块里的位置（px） */
  top: number;
  lines: string[];
  marks?: Lookbook["marks"];
  /** false = 一直藏着（翻转卡片里那份 / 还没滚到） */
  play: boolean;
  delay: number;
}) {
  const { lang } = useLanguage();
  const markDefs = markList(marks?.[lang]);
  const Y = (y: number) => y - DESC_Y0;
  /*
   * 行错开出现，手绘装饰 / 箭头等行出完再淡入。
   * 延时都通过 custom 显式传（父级 staggerChildren 会被子级自己的 transition.delay 顶掉，不可靠）。
   */
  const lineDelay = 0.14;
  const decoAt = delay + (lines.length - 1) * lineDelay + 0.45;
  const line: Variants = {
    hidden: { y: "115%", opacity: 0 },
    show: (d: number) => ({ y: "0%", opacity: 1, transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] } }),
  };
  const deco: Variants = {
    hidden: { opacity: 0 },
    show: (d: number) => ({ opacity: 1, transition: { duration: 0.5, delay: d } }),
  };

  /*
   * 下划线 / 圈的位置不写死：把词包成 span，渲染后量它相对文字块的位置再摆装饰，
   * 换行、改字、换语言都不用调坐标。字体是异步加载的，加载完再量一次。
   */
  const textEl = useRef<HTMLDivElement | null>(null);
  const markEls = useRef<Partial<Record<MarkKey, HTMLSpanElement | null>>>({});
  const [boxes, setBoxes] = useState<Partial<Record<MarkKey, MarkBox>>>({});
  const setRef = (key: MarkKey, el: HTMLSpanElement | null) => {
    markEls.current[key] = el;
  };
  useEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const next: Partial<Record<MarkKey, MarkBox>> = {};
      (Object.keys(markEls.current) as MarkKey[]).forEach((key) => {
        const el = markEls.current[key];
        if (!el) return;
        /*
         * 沿 offsetParent 链一路加到文字块：行在做位移动画时带 transform，
         * 浏览器会把它当成 offsetParent，直接读 offsetTop 会量到行内坐标。
         */
        let l = 0;
        let t = 0;
        let node: HTMLElement | null = el;
        while (node && node !== textEl.current) {
          l += node.offsetLeft;
          t += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        next[key] = { l, t, w: el.offsetWidth, h: el.offsetHeight };
      });
      setBoxes(next);
    };
    measure();
    document.fonts?.ready.then(measure);
    const t = window.setTimeout(measure, 1200);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [u, lang, lines.join("\n")]);

  const uls = (Object.keys(boxes) as MarkKey[]).filter((k) => k.startsWith("underline")).map((k) => boxes[k]!);
  const ci = boxes.circle;
  /* 圈那张 svg 原本是 178×39 套在约 140×22 的词上，按同样的比例往外扩 */
  const circleW = ci ? ci.w * 1.24 : 0;
  const circleH = ci ? ci.h * 1.85 : 0;

  return (
    <motion.div
      className="absolute inset-x-0"
      style={{ top, height: DESC_H * u }}
      initial="hidden"
      animate={play ? "show" : "hidden"}
    >
      <Board u={u}>
        <Rotated u={u} x={40} y={Y(DESC_TEXT_Y)} w={640} h={60} iw={640} ih={60} transform="rotate(-1.31deg)">
          <div
            ref={textEl}
            className="font-hand relative text-center text-white"
            style={{
              fontSize: 16 * u,
              lineHeight: 1.4,
              textTransform: lang === "en" ? "capitalize" : "none",
            }}
          >
            {lines.map((text, i) => (
              <span key={i} className="block overflow-hidden" style={{ paddingBottom: 0.1 * 16 * u }}>
                <motion.span className="block" variants={line} custom={delay + i * lineDelay}>
                  {renderMarked(text, markDefs, setRef)}
                </motion.span>
              </span>
            ))}
            {/* 装饰跟文字放在同一个转过的框里，一起斜 */}
            {uls.map((ul, i) => (
              <motion.img
                key={i}
                src={`${A}/underline-desc.svg`}
                alt=""
                draggable={false}
                variants={deco}
                custom={decoAt}
                className="pointer-events-none absolute max-w-none"
                style={{
                  left: ul.l - ul.w * 0.02,
                  top: ul.t + ul.h - 7 * u,
                  width: ul.w * 1.04,
                  height: (ul.w * 1.04 * 12.24) / 171.1,
                }}
              />
            ))}
            {ci && (
              <motion.img
                src={`${A}/circle-relaxed.svg`}
                alt=""
                draggable={false}
                variants={deco}
                custom={decoAt}
                className="pointer-events-none absolute max-w-none"
                style={{
                  left: ci.l + ci.w / 2 - circleW / 2,
                  top: ci.t + ci.h / 2 - circleH / 2,
                  width: circleW,
                  height: circleH,
                  transform: "rotate(2.97deg)",
                }}
              />
            )}
          </div>
        </Rotated>
        <motion.img
          src={`${A}/arrow-down.svg`}
          alt=""
          draggable={false}
          variants={deco}
          custom={decoAt}
          style={box(u, 353.5 - 13.36 / 2, Y(780.5), 13.36, 30.68)}
        />
      </Board>
    </motion.div>
  );
}

/* ---------------- 拼贴板（产品表 / 拍立得 / 邮票 / 印章 / 小图 / 手写标注） ---------------- */

/** 拼贴在稿子里的纵向起点，下面所有 y 都减掉它 */
const COLLAGE_Y0 = 814;
/**
 * 三张照片（拍立得 / 背面印花 / 正面小标）比稿子放大的倍数。
 * 稿子是 720 竖版，等比缩到桌面后这三张只剩一两百像素，主次反了，所以单独放大；
 * 撕纸和文字不动，照片各自以搭在撕纸上的那个角为锚点往外长。
 */
const PHOTO_K = 1.4;
/**
 * 两张小图贴在撕纸底下的左右两边（导出框含胶带 / 描边，左上角，稿子坐标），
 * 两张都推到撕纸外侧的墙上，中间空道 30 → 687（约 660），钉在屏中的金框一路变小，第一屏往上滚时空道正好经过它。
 * 左：背面印花（竖），右：正面小标（横）。
 */
const CROP_B = { x: -120, y: 1200 };
const CROP_F = { x: 687, y: 1215 };

/*
 * 打开时的出场：撕纸从上往下擦出来，纸快擦完了其它一张张"啪"地贴上，手写标注最后淡入。
 * 每个元素的延时用 custom 显式传进来（父级 staggerChildren 会被子级自己的 transition.delay 顶掉，不可靠）。
 */
const wipeIn: Variants = {
  hidden: { clipPath: "inset(0 0 100% 0)" },
  show: (d: number) => ({ clipPath: "inset(0 0 0% 0)", transition: { duration: 0.8, delay: d, ease: WIPE_EASE } }),
};
const stickOn: Variants = {
  hidden: { opacity: 0, scale: 1.25, rotate: -3 },
  show: (d: number) => ({
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { duration: 0.45, delay: d, ease: [0.22, 1, 0.36, 1] },
  }),
};
const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: (d: number) => ({ opacity: 1, transition: { duration: 0.6, delay: d } }),
};

function Collage({ u, lb, play, delay }: { u: number; lb: Lookbook; play: boolean; delay: number }) {
  const { t, pick } = useLanguage();
  const Y = (y: number) => y - COLLAGE_Y0;
  const rows: [string, string][] = lb.sheet.slice(0, 5).map((r) => [pick(r.label), pick(r.value)]);
  /** 第 i 个元素的出场时刻：0 = 撕纸；之后的等纸擦到八成（0.6s）再每 0.16s 一个 */
  const at = (i: number) => delay + (i === 0 ? 0 : 0.6 + (i - 1) * 0.16);
  /*
   * 下面几张图（撕纸 / 邮票 / 拍立得 / 两张小裁切）都是设计师在 Figma 里调好色、
   * 连描边 / 胶带 / 投影一起导出的成品 PNG，所以这里不再叠 border / filter / 胶带，
   * 只按"导出框"(= 稿子里的元素框往外扩了投影和描边那一圈) 摆位置。
   * 每个都包一层 motion.div 走 variants，父级 stagger 出场顺序 = 书写顺序。
   */
  return (
    <motion.div
      className="absolute inset-x-0 top-0"
      style={{ height: COLLAGE_H * u }}
      initial="hidden"
      animate={play ? "show" : "hidden"}
    >
      {/* 撕纸这一组整体放大 PAPER_K，锚在纸顶边中心（拼贴顶 = 纸顶） */}
      <div className="absolute inset-0" style={{ transform: `scale(${PAPER_K})`, transformOrigin: `${360 * u}px 0` }}>
        {/* 撕纸 + 上面的产品表文字，一起擦出来。纸 416×309 @ (152,814)，投影 0/4/4 → 导出框左右各多 4、下面多 8 */}
        <motion.div className="absolute inset-0" variants={wipeIn} custom={at(0)}>
          <div style={box(u, 148, Y(814), 424, 317)}>
            <Img src={`${A}/paper-sheet.webp`} fit="fill" />
          </div>
          <p
            className="font-look absolute whitespace-nowrap font-medium text-black"
            style={{
              left: 206 * u,
              top: Y(853) * u,
              fontSize: 12 * u,
              lineHeight: 1.2,
            }}
          >
            {t("lab.detail.sheet")}
          </p>
          <img src={`${A}/sheet-lines.svg`} alt="" draggable={false} style={box(u, 206, Y(914.5), 288, 149)} />
          {rows.map(([k, v], i) => (
            <div key={k}>
              <p
                className="font-look absolute whitespace-nowrap font-medium text-black"
                style={{
                  left: 206 * u,
                  top: Y(894 + i * 37) * u,
                  fontSize: 10 * u,
                  lineHeight: 1.2,
                }}
              >
                {k}
              </p>
              <p
                className="font-hand absolute whitespace-nowrap text-black"
                style={{
                  left: 262 * u,
                  top: Y(891 + i * 37) * u,
                  fontSize: 16 * u,
                  lineHeight: 1.2,
                }}
              >
                {v}
              </p>
            </div>
          ))}
        </motion.div>

        {/* 拍立得（相纸 + 照片 + 胶带，已经转好 10°）：稿子里 154.17×188.85 @ (425.8,890)，以左上角为锚放大 */}
        <motion.div variants={stickOn} custom={at(1)} style={box(u, 425.8, Y(890), 154.17 * PHOTO_K, 188.85 * PHOTO_K)}>
          <Img src={lb.polaroid} fit="fill" />
        </motion.div>

        {/* 邮票：67×90 @ (461,851)，投影 0.5/1 → 右多 0.5、下多 1。贴在拍立得上面 */}
        {lb.postage && (
          <motion.div variants={stickOn} custom={at(2)} style={box(u, 461, Y(851), 67.5, 91)}>
            <Img src={lb.postage} fit="fill" />
          </motion.div>
        )}

        {/* 印章：正片叠底 30% */}
        <motion.div className="absolute inset-0" variants={fadeIn} custom={at(3)}>
          <Rotated
            u={u}
            x={352.44}
            y={Y(957.76)}
            w={165.44}
            h={163.07}
            iw={128.8}
            ih={124.6}
            transform="rotate(21.45deg)"
            style={{ mixBlendMode: "multiply", opacity: 0.3 }}
          >
            <Img src={`${A}/stamp.webp`} fit="fill" />
          </Rotated>
        </motion.div>
      </div>

      {SHOW_CROPS && (
        <>
          {/* 右下：正面小标 + 胶带（一张图，导出框 157.75×116.75 放大 PHOTO_K） */}
          <motion.div
            variants={stickOn}
            custom={at(5)}
            style={box(u, CROP_F.x, Y(CROP_F.y), 157.75 * PHOTO_K, 116.75 * PHOTO_K)}
          >
            <Img src={lb.crops.front} fit="fill" />
          </motion.div>

          {/* 左下：背面印花 + 胶带（一张图，导出框 107.5×160.75 放大 PHOTO_K） */}
          <motion.div
            variants={stickOn}
            custom={at(4)}
            style={box(u, CROP_B.x, Y(CROP_B.y), 107.5 * PHOTO_K, 160.75 * PHOTO_K)}
          >
            <Img src={lb.crops.back} fit="fill" />
          </motion.div>

          {/* 两句手写标注 + 箭头 + 圈：各自挂在两张小图底下 */}
          <motion.div className="absolute inset-0" variants={fadeIn} custom={at(6)}>
            <p
              className="font-hand absolute text-white"
              style={{
                left: (CROP_B.x + 10) * u,
                top: Y(CROP_B.y + 255) * u,
                width: 127 * u,
                fontSize: 16 * u,
                lineHeight: 1.2,
              }}
            >
              {pick(lb.notes.left)}
            </p>
            <Rotated
              u={u}
              x={CROP_B.x + 57}
              y={Y(CROP_B.y + 190)}
              w={51.92}
              h={66.31}
              iw={59.67}
              ih={31}
              transform="rotate(-113.93deg) scaleY(-1)"
            >
              <Img src={`${A}/arrow-stripes.svg`} fit="fill" />
            </Rotated>
            <p
              className="font-hand absolute whitespace-nowrap text-white"
              style={{ left: (CROP_F.x - 13) * u, top: Y(CROP_F.y + 202) * u, fontSize: 16 * u, lineHeight: 1.2 }}
            >
              {pick(lb.notes.right)}
            </p>
            <Rotated
              u={u}
              x={CROP_F.x + 62}
              y={Y(CROP_F.y + 148)}
              w={36}
              h={48.28}
              iw={16.43}
              ih={46.61}
              transform="rotate(27.85deg) scaleY(-1)"
            >
              <Img src={`${A}/arrow-signature.svg`} fit="fill" />
            </Rotated>
            <Rotated
              u={u}
              x={CROP_F.x - 32}
              y={Y(CROP_F.y + 197)}
              w={75.71}
              h={32.31}
              iw={74.74}
              ih={28.3}
              transform="rotate(4.03deg)"
            >
              <Img src={`${A}/circle-woolab.svg`} fit="fill" />
            </Rotated>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

/* ---------------- 页面 ---------------- */

/** 一屏内的画板容器：720u 宽、水平居中，子元素按稿子坐标摆 */
function Board({ u, children, className }: { u: number; children: ReactNode; className?: string }) {
  return (
    <div
      className={`absolute left-1/2 top-0 h-full -translate-x-1/2 ${className ?? ""}`}
      style={{ width: BOARD_W * u }}
    >
      {children}
    </div>
  );
}

/* ---- 主角金框 + 底部画框墙（尺寸都按屏高算，和页头那套缩放脱钩） ---- */
/** 主角在第一屏的高（屏高比例），正中当主角 */
const HERO_H = 0.4;
/** 主角一路变小：让路靠边时缩到这个比例，落墙再缩到墙上那排的尺寸（WALL_K，要比这个小） */
const HERO_MID_K = 0.72;
/** 墙上每只框的宽 = 主角第一屏宽 × 这个；框心间距 = 框宽 × 1.45 */
const WALL_K = 0.7;
const WALL_GAP_K = 1.45;
/** 那排框的中心在屏高的多少处 */
const WALL_ROW_CY = 0.54;
/** 画框墙那屏钉住之后再滚这么多（屏高的倍数），主角在这段里落到墙上 */
const WALL_LAND = 0.6;
/** 主角一开始歪着挂的角度（度，负 = 往左倒），一路扶正，落到墙上正好 0 */
const HERO_TILT = -8;
/** 照片顶上来停在主角底边下面这么多（稿子 px × u） */
const PHOTO_GAP = 22;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** 滚动时间轴上的几个关口（滚动容器的 scrollTop）和主角的几个尺寸 */
type Timeline = {
  vw: number;
  vh: number;
  /** 主角让路：从 asideStart 开始往边上滑、缩小，到 asideEnd 靠边停稳（中心 x = asideX） */
  asideStart: number;
  asideEnd: number;
  asideX: number;
  asideY: number;
  /** 滚到这里照片顶边正好走到主角下面 */
  photoAt: number;
  /** 画框墙那屏的顶在文档里的位置（滚到这里它正好占满一屏） */
  wallTop: number;
  /** 主角开始落 / 落到位 */
  landStart: number;
  landEnd: number;
  /** 主角第一屏的宽 / 墙上每只的宽（屏幕 px） */
  heroW: number;
  wallW: number;
  /** 主角要落的那一格的中心 x（屏幕 px） */
  slotX: number;
};

/** 主角第一屏的尺寸：高占屏高 HERO_H，太窄的屏按宽限 */
function heroSize(vw: number, vh: number) {
  const w = Math.min((vh * HERO_H * FRAME_W) / FRAME_H, vw * 0.25);
  return { w, h: (w * FRAME_H) / FRAME_W };
}

/** 两边标签占的地方（稿单位）：整排画框要让开，别压到"货号 / 产品名" */
const WALL_SIDE = 130;
/** 间距压到最紧也得留这么多倍框宽 */
const WALL_GAP_MIN = 1.15;

/**
 * 墙上那排：每只的宽、框心间距、第 i 只的中心 x（整排水平居中）。
 * 4:3 这类窄屏上按屏高算出来的框会把整排撑到屏边、压住两边的标签：
 * 先压间距（最紧 WALL_GAP_MIN 倍），还放不下就整排缩小。
 */
function wallLayout(vw: number, vh: number) {
  const n = labProjects.length;
  const avail = vw - 2 * WALL_SIDE * boardUnits().u;
  let wallW = heroSize(vw, vh).w * WALL_K;
  let gap = wallW * WALL_GAP_K;
  const rowW = (w: number, k: number) => (n - 1) * k * w + w;
  if (rowW(wallW, WALL_GAP_K) > avail) {
    if (rowW(wallW, WALL_GAP_MIN) <= avail) {
      gap = (avail - wallW) / (n - 1);
    } else {
      wallW = avail / ((n - 1) * WALL_GAP_MIN + 1);
      gap = wallW * WALL_GAP_MIN;
    }
  }
  const slotX = (i: number) => vw / 2 + (i - (n - 1) / 2) * gap;
  return { wallW, gap, slotX };
}

/**
 * 主角金框在某个滚动位置的姿态（纯函数：滚到哪儿就是哪个样子，往回滚原路返回）。
 * 像参考视频里的酒瓶：每换一段挪一次位置，内容排在它旁边过去，尺寸一路只缩不长。
 *  - 第一屏：居中当主角
 *  - asideStart → asideEnd：那段话快滚到它跟前时让路——滑到左上角，缩到 HERO_MID_K；
 *    之后撕纸、照片、下一件都从中间过去，它在左上陪着不动。
 *    放左上是因为照片里的东西（人、蜡烛、杯子）都在中下部，左上角基本都是空墙；两边标签在竖直正中也碰不到
 *  - landStart → landEnd：从左边沿一条往上拱的弧线飞过去落到墙上自己那一格，缩到墙上那排的尺寸
 *  - 角度：一开始 HERO_TILT，整条路上单调扶正，落到墙上正好 0
 */
function heroPose(s: number, tl: Timeline) {
  const hx0 = tl.vw / 2;
  const hy0 = tl.vh / 2;
  const aside = smooth((s - tl.asideStart) / (tl.asideEnd - tl.asideStart));
  const land = smooth((s - tl.landStart) / (tl.landEnd - tl.landStart));
  const ty = tl.vh * WALL_ROW_CY + Math.max(0, tl.wallTop - s);
  const cx = hx0 + (tl.asideX - hx0) * aside;
  const cy = hy0 + (tl.asideY - hy0) * aside;
  const x = cx + (tl.slotX - cx) * land;
  /* 落墙那段走一条往上拱的弧线，别直接从别的框身上扫过去 */
  const arc = Math.sin(Math.PI * land) * tl.vh * 0.3;
  const y = cy + (ty - cy) * land - arc;
  const midK = 1 + (HERO_MID_K - 1) * aside;
  const w = tl.heroW;
  const h = (w * FRAME_H) / FRAME_W;
  return {
    x: x - w / 2,
    y: y - h / 2,
    rotate: HERO_TILT * (1 - smooth(s / tl.landEnd)),
    scale: midK + (tl.wallW / tl.heroW - midK) * land,
    land,
  };
}

/** 钉在屏上的那只金框，姿态全由滚动位置算出来 */
function HeroFrame({
  project,
  scrollY,
  tl,
  hidden,
}: {
  project: LabProject;
  scrollY: MotionValue<number>;
  tl: Timeline;
  hidden: boolean;
}) {
  const x = useTransform(scrollY, (s) => heroPose(s, tl).x);
  const y = useTransform(scrollY, (s) => heroPose(s, tl).y);
  const rotate = useTransform(scrollY, (s) => heroPose(s, tl).rotate);
  const scale = useTransform(scrollY, (s) => heroPose(s, tl).scale);
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ x, y, rotate, scale, visibility: hidden ? "hidden" : "visible" }}
    >
      <FramePiece project={project} width={tl.heroW} />
    </motion.div>
  );
}

/**
 * 底部的画框墙：四只框挂成一排、整排水平居中。
 * 主角落到墙上之前，当前项目那一格空着（主角飞过来填）；落好了就能点：
 * hover 哪只哪只微微抬起来、名字亮起来（两边的标签也跟着换成它的），点哪只就打开哪只，点当前这只滚回顶部。
 */
function FrameWall({
  u,
  vw,
  vh,
  index,
  landed,
  active,
  hideIndex,
  onHover,
  onOpen,
  onBackTop,
}: {
  u: number;
  vw: number;
  vh: number;
  /** 当前正在看的项目 */
  index: number;
  /** 主角已经落到墙上（这时候才能点） */
  landed: boolean;
  /** false = 翻转卡片里那份 / 正在飞：不响应 */
  active: boolean;
  /** 正在飞回页顶的那只：墙上先藏掉 */
  hideIndex: number | null;
  onHover: (i: number | null) => void;
  onOpen: (i: number) => void;
  onBackTop: () => void;
}) {
  const { pick } = useLanguage();
  const { wallW: W, slotX } = wallLayout(vw, vh);
  const H = (W * FRAME_H) / FRAME_W;
  const rowCy = vh * WALL_ROW_CY;
  const [hover, setHover] = useState<number | null>(null);
  const canPick = landed && active;
  const setHovered = (i: number | null) => {
    setHover(i);
    onHover(i);
  };
  /* 不能点的时候把 hover 清掉（比如主角飞走了） */
  useEffect(() => {
    if (!canPick && hover !== null) setHovered(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPick]);

  return (
    <div className="sticky top-0 h-screen overflow-hidden">
      <Watermark u={u} cy={rowCy} mode="wall" />

      {labProjects.map((p, i) => {
        const shown = (landed || i !== index) && i !== hideIndex;
        const lit = hover === null ? i === index : hover === i;
        return (
          <div
            key={p.id}
            className="absolute"
            style={{ left: slotX(i) - W / 2, top: rowCy - H / 2, width: W, height: H }}
          >
            {/* 手写名字 + 小箭头：hover 的那只亮（没 hover 时当前这只亮），其它暗 */}
            <motion.div
              className="pointer-events-none absolute inset-x-0 flex flex-col items-center"
              style={{ top: -78 * u }}
              animate={{ opacity: lit ? 1 : 0.45 }}
              transition={{ duration: 0.25 }}
            >
              <p
                className="font-hand whitespace-nowrap text-white"
                style={{ fontSize: 16 * u, lineHeight: 1.2, transform: "rotate(-3deg)" }}
              >
                {pick(p.wall?.label ?? p.title)}
              </p>
              <img
                src={`${A}/arrow-down.svg`}
                alt=""
                draggable={false}
                style={{ width: 11 * u, height: 25 * u, marginTop: 10 * u, transform: "rotate(14deg)" }}
              />
            </motion.div>

            {/* 显示 / 隐藏不带过渡：主角落到这格的那一帧直接换手，两边位置重合，不能有淡入 */}
            <div className="absolute inset-0" style={{ visibility: shown ? "visible" : "hidden" }}>
              <motion.button
                type="button"
                className="absolute inset-0 block"
                style={{ cursor: canPick ? "pointer" : "default" }}
                whileHover={canPick ? { scale: 1.05, y: -8 } : undefined}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                onHoverStart={() => canPick && setHovered(i)}
                onHoverEnd={() => setHovered(null)}
                onTap={() => {
                  if (!canPick) return;
                  if (i === index) onBackTop();
                  else onOpen(i);
                }}
                aria-label={pick(p.wall?.label ?? p.title)}
              >
                <FramePiece project={p} width={W} />
              </motion.button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 项目某一件的两边标签：货号 / 产品名；没填 lookbook 的用编号 + 项目名顶着 */
function labelOf(pick: (v: Localized) => string, p: LabProject, i: number, look = 0) {
  const lb = p.looks?.[look];
  return {
    left: lb ? pick(lb.sku) : `NO.${String(i + 1).padStart(2, "0")}`,
    right: lb ? pick(lb.productName) : pick(p.title),
  };
}

/** 一件在文档里的布局（都是相对这件块顶的 px，start 是块顶在文档里的位置） */
type LookLayout = {
  start: number;
  /** 那段话块的顶 */
  descTop: number;
  /** 拼贴板的顶 */
  collageTop: number;
  /** 那段话 + 拼贴这一块的高（照片从这儿开始） */
  blockH: number;
  /** 照片那块的高（含撕边加高和底下留白） */
  stripH: number;
};

/**
 * 一件：那段话 → 拼贴 → 通栏照片。第一件前面还带页头和水印。
 * 第一件打开就出场；后面的滚到眼前再出场（那段话 / 拼贴的贴纸动画）。
 */
function LookSection({
  lb,
  fallbackLines,
  first,
  closet,
  u,
  uc,
  vh,
  layout,
  photoStopY,
  stripPad,
  tornMask,
  scrollY,
  scroller,
  play,
  delay,
  fadeIn = false,
}: {
  lb?: Lookbook;
  fallbackLines: string[];
  first: boolean;
  /** 切项目切过来的：页头的水印 / 标题淡入，别在回顶那一帧整块跳出来 */
  fadeIn?: boolean;
  closet: string;
  u: number;
  uc: number;
  vh: number;
  layout: LookLayout;
  photoStopY: number;
  stripPad: { top: number; bottom: number };
  tornMask: CSSProperties;
  scrollY: MotionValue<number>;
  scroller: RefObject<HTMLDivElement | null>;
  play: boolean;
  delay: number;
}) {
  const { t, lang } = useLanguage();
  const ref = useRef<HTMLDivElement | null>(null);
  /* 后面几件：块顶滚进屏幕下 1/3 就开始出场，只出一次 */
  const inView = useInView(ref, { root: scroller, once: true, margin: "0px 0px -30% 0px" });
  const show = play && (first || inView);
  /*
   * 照片本体的缩放：顶边刚从屏底进来时 1.05，走到主角下面时正好 1，之后不再动。
   * 幅度很小，只是让它有"被慢慢按平、贴到墙上"的感觉，别看着像在呼吸。
   */
  const enter = layout.start + layout.blockH - vh;
  const photoAt = layout.start + layout.blockH - photoStopY;
  const scale = useTransform(scrollY, (s) => 1 + 0.05 * (1 - smooth((s - enter) / (photoAt - enter))));

  return (
    <section ref={ref} className="relative">
      <div className="relative" style={{ height: layout.blockH }}>
        {/* 页头标题：切项目切过来的淡入；底下的 WOOLAB 水印不在这儿，挂在滚动内容最外层，切项目不重挂 */}
        {first && (
          <motion.div
            className="absolute inset-0"
            initial={fadeIn ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          >
            <LookbookHead u={u} closet={closet} />
          </motion.div>
        )}
        <Description
          u={u}
          top={layout.descTop}
          lines={lb ? lb.lines[lang] : fallbackLines}
          marks={lb?.marks}
          play={show}
          delay={delay}
        />
        <div className="absolute inset-x-0" style={{ top: layout.collageTop, height: COLLAGE_H * uc }}>
          <Board u={uc}>
            {lb ? (
              <Collage u={uc} lb={lb} play={show} delay={delay} />
            ) : (
              <div
                className="flex items-center justify-center border border-dashed border-white/30 bg-[#4a4444]/70 text-white/60"
                style={box(uc, 110, 0, 500, COLLAGE_H)}
              >
                <span className="font-hand" style={{ fontSize: 22 * uc }}>
                  {t("lab.detail.shot")}
                </span>
              </div>
            )}
          </Board>
        </div>
      </div>

      {/* 通栏照片：上下都是撕纸边，像一张撕下来的照片纸贴在墙上；照片本体跟滚动微微缩放 */}
      <div className="relative z-10" style={{ paddingBottom: 24 * uc }}>
        <div className="relative" style={tornMask}>
          <HeroStrip
            lb={lb}
            placeholder={t("lab.detail.hero")}
            reveal={first ? play : show}
            scale={scale}
            pad={stripPad}
          />
        </div>
      </div>
    </section>
  );
}

export function DetailPage({
  project,
  index,
  onClose,
  onNext,
  interactive = true,
}: {
  project: LabProject;
  index: number;
  onClose: () => void;
  /** 在底部画框墙上挑了另一件 */
  onNext?: (nextIndex: number) => void;
  interactive?: boolean;
}) {
  const { t, pick } = useLanguage();
  /* 报给全站顶栏：详情盖着，顶栏换成压在详情上的样子（去 logo，右边 MENU / CN·EN / 喇叭照常） */
  useReportDetailOpen();
  const { u, uc } = useBoardUnits();
  const scroller = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  /* 详情页自己的滚动条也走丝滑滚动；翻转卡片里那份不滚，不用 */
  const lenis = useSmoothContainer(scroller, content, interactive);
  /* 这个项目的几件；一件都没填的渲染一段占位 */
  const looks: (Lookbook | undefined)[] = project.looks?.length ? project.looks : [undefined];
  const closet = pick(project.wall?.label ?? looks[0]?.closet ?? { zh: "Meelo 的衣柜", en: "Meelo's Closet" });

  /* 切到另一件后：回顶部，第一屏重新出场 */
  const shownIndex = useRef(index);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !interactive || shownIndex.current === index) return;
    shownIndex.current = index;
    setEntered(true);
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true, force: true });
    else el.scrollTop = 0;
  }, [index, interactive, lenis]);
  /* 出场起始延时：第一次是画框放大到满屏那一刻才挂上来的，稍等一拍再出；之后切项目差不多 */
  const base = entered ? 0.2 : 0.25;

  /* 两边的标签：平时是正在看的这一件（滚到哪件算哪件），鼠标放到墙上某只框时换成那个项目的 */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [lookIdx, setLookIdx] = useState(0);
  const shownLabel =
    hoverIdx === null ? labelOf(pick, project, index, lookIdx) : labelOf(pick, labProjects[hoverIdx], hoverIdx);

  const vw = useViewportWidth();
  const [vh, setVh] = useState(() => window.innerHeight);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  /* 主角第一屏的尺寸、墙上那排的尺寸 */
  const hero = heroSize(vw, vh);
  const wall = wallLayout(vw, vh);
  /*
   * 撕纸边的带高（素材 torn-top 1600×64、torn-bottom 1600×100，按屏宽拉伸再压到 0.8）。
   * 撕边线大致在带的中间：照片整块加高 stripPad，撕掉的正好是加出来的那部分，照片露出来的高度不变。
   */
  const topH = Math.round((vw * 64 * 0.8) / 1600);
  const botH = Math.round((vw * 100 * 0.8) / 1600);
  const stripPad = { top: Math.round(topH * 0.5), bottom: Math.round(botH * 0.5) };
  /* 通栏照片那块的高（照片 + 撕边加高 + 底下留白） */
  const stripH = STRIP_H * (vw / STRIP_W) + stripPad.top + stripPad.bottom + 24 * uc;
  /*
   * 每一件的布局，一件接一件排下去，全是普通内容一路匀速滚，没有钉住的段落：
   *  - 第一件：页头在顶、主角在正中、那段话在屏幕下部（第一行的顶在 78% 屏高）；
   *    拼贴推到第一屏以下（屏矮到稿子位置本来就在屏外时按稿子）
   *  - 后面几件：那段话上下留一点空，底下接拼贴
   *  - 每件末尾接通栏照片
   */
  const layouts: LookLayout[] = [];
  looks.forEach((_, j) => {
    const start = j === 0 ? 0 : layouts[j - 1].start + layouts[j - 1].blockH + layouts[j - 1].stripH;
    /* 后面几件：那段话上下各留 8% 屏高的空 */
    const descBlockH = j === 0 ? vh : Math.round(DESC_H * u + vh * 0.16);
    const descTop = j === 0 ? vh * 0.78 - (DESC_TEXT_Y - DESC_Y0) * u : (descBlockH - DESC_H * u) / 2;
    const collageTop = j === 0 ? Math.max(PHOTO_TOP * u, vh + 24 * uc) : descBlockH;
    const blockH = collageTop + (COLLAGE_H + COLLAGE_PAD) * uc;
    layouts.push({ start, descTop, collageTop, blockH, stripH });
  });
  const last = layouts[layouts.length - 1];
  /*
   * 主角让路的时机：第一件那段话的第一行滚到主角底边时开始往右滑，再滚半屏停稳。
   * 这样那段话正好从中间干净地过去，不会被盖。
   */
  const descTextDoc = layouts[0].descTop + (DESC_TEXT_Y - DESC_Y0) * u;
  const asideStart = Math.max(0, descTextDoc - (vh / 2 + hero.h / 2) - 20);
  const asideEnd = asideStart + vh * 0.5;
  /* 照片走到主角（已缩到中等）底边下面一点的那一刻；照片从屏底进来到那儿是缩放缓动的区间 */
  const photoStopY = vh / 2 + (hero.h * HERO_MID_K) / 2 + PHOTO_GAP * u;
  const photoAt = last.start + last.blockH - photoStopY;
  /* 滚动时间轴 */
  const wallTop = last.start + last.blockH + last.stripH;
  const tl: Timeline = {
    vw,
    vh,
    asideStart,
    asideEnd,
    /* 靠边的位置：左上角。y 在屏高 1/4；x 靠左一点，别压到照片左上那句手写标注 */
    asideX: vw * 0.25 - 130 * u,
    asideY: vh * 0.25,
    photoAt,
    wallTop,
    landStart: Math.max(photoAt + 1, wallTop - vh * 0.6),
    landEnd: wallTop + vh * WALL_LAND * 0.7,
    heroW: hero.w,
    wallW: wall.wallW,
    slotX: wall.slotX(index),
  };

  const { scrollY } = useScroll({ container: scroller });
  /* 正在看哪一件：哪件的块顶滚过了屏幕中线就算哪件（两边标签跟着换） */
  useMotionValueEvent(scrollY, "change", (s) => {
    let j = 0;
    layouts.forEach((l, i) => {
      if (i > 0 && s >= l.start - vh / 2) j = i;
    });
    setLookIdx(j);
  });
  /* 撕纸遮罩：顶带 + 底带 + 中间实心，和两条带各重叠 1px 免得露缝 */
  const tornMask: CSSProperties = {
    WebkitMaskImage: `url(${A}/torn-top.png), url(${A}/torn-bottom.png), linear-gradient(#000, #000)`,
    maskImage: `url(${A}/torn-top.png), url(${A}/torn-bottom.png), linear-gradient(#000, #000)`,
    WebkitMaskSize: `100% ${topH}px, 100% ${botH}px, 100% calc(100% - ${topH + botH - 2}px)`,
    maskSize: `100% ${topH}px, 100% ${botH}px, 100% calc(100% - ${topH + botH - 2}px)`,
    WebkitMaskPosition: `0 0, 0 100%, 0 ${topH - 1}px`,
    maskPosition: `0 0, 0 100%, 0 ${topH - 1}px`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };

  /* 主角落到墙上了没：落好了主角藏起来、墙上那一格接上（两者位置完全重合，看不出换手） */
  const [landed, setLanded] = useState(false);
  useMotionValueEvent(scrollY, "change", (s) => setLanded(heroPose(s, tl).land >= 1));

  /*
   * 在墙上挑了另一件：那只框从墙上升起来飞回屏中（墙同时暗下去），边飞边歪回起始角度，
   * 到位后切项目、回顶部，屏中的主角正好接在它落点上，再把飞的这只撤掉。
   */
  const [flying, setFlying] = useState<number | null>(null);
  const flyTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(flyTimer.current), []);
  /*
   * 落到墙上以后再往下滑：不用点，下一只自己升起来飞回页顶接着讲（最后一件到头就停在墙上）。
   * 落稳后留 350ms 空窗，别让把主角送到墙上的那股惯性顺手把下一只也带走。
   */
  const landedAt = useRef(0);
  useEffect(() => {
    if (landed) landedAt.current = performance.now();
  }, [landed]);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY <= 0 || !landed || flying !== null) return;
      if (index >= labProjects.length - 1) return;
      if (performance.now() - landedAt.current < 350) return;
      setFlying(index + 1);
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, [landed, flying, index, interactive]);
  const onFlown = () => {
    if (flying === null) return;
    onNext?.(flying);
    flyTimer.current = window.setTimeout(() => setFlying(null), 220);
  };
  const backTop = () => {
    if (lenis.current) lenis.current.scrollTo(0, { duration: 1.4 });
    else scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    /* data-lenis-prevent：整页盖在画廊上面，滚轮别再传给外面 window 那份丝滑滚动 */
    <div className="relative h-full w-full overflow-hidden text-white" data-lenis-prevent="">
      <StoneWall u={u} />
      {/* 返回按钮钉在角上、两边标签钉在竖直正中，其余都跟着页面滚 */}
      <button
        type="button"
        data-lab-detail-close=""
        onClick={onClose}
        className="font-look absolute z-30 whitespace-nowrap text-white/90 transition hover:opacity-70"
        /* 竖直中心对齐全站顶栏那一行（顶栏高 52 个稿单位，中心在 26） */
        style={{ left: 25 * u, top: `calc(${MU} * 26)`, transform: "translateY(-50%)", fontSize: 12 * u }}
      >
        {t("lab.detail.back")}
      </button>
      <LabelRow u={u} left={shownLabel.left} right={shownLabel.right} />

      <div
        ref={scroller}
        className="relative h-full w-full overflow-y-auto"
        style={{ overscrollBehavior: "contain", scrollbarWidth: "none" }}
      >
        <div ref={content} className="relative">
          {/*
           * 第一屏底下的 WOOLAB 石刻水印：跟着内容滚，但放在按项目 key 的段落外面——
           * 切项目时段落整个重挂，水印要是在里面就会重新出现一次；它对每个项目都一样，挂一次就够。
           */}
          <Watermark u={u} cy={vh / 2} />
          {/*
           * 这个项目的每一件：那段话 + 拼贴 → 通栏照片，一件接一件，全是普通内容一路匀速滚；
           * 钉着不动的只有屏中的主角金框，这些东西从它身后依次过去。
           */}
          {looks.map((lb, j) => (
            <LookSection
              key={`${project.id}-${j}`}
              lb={lb}
              fallbackLines={[pick(project.description)]}
              first={j === 0}
              fadeIn={entered}
              closet={closet}
              u={u}
              uc={uc}
              vh={vh}
              layout={layouts[j]}
              photoStopY={photoStopY}
              stripPad={stripPad}
              tornMask={tornMask}
              scrollY={scrollY}
              scroller={scroller}
              play={interactive}
              delay={j === 0 ? base + 0.1 : 0.1}
            />
          ))}

          {/* 画框墙：占一屏 + 主角落下来那段；飞回屏中的时候整面墙暗掉，切项目那一跳就看不见了 */}
          <motion.section
            className="relative"
            style={{ height: vh * (1 + WALL_LAND) }}
            animate={{ opacity: flying === null ? 1 : 0 }}
            transition={{ duration: 0.45 }}
          >
            <FrameWall
              u={uc}
              vw={vw}
              vh={vh}
              index={index}
              landed={landed}
              active={interactive && flying === null}
              hideIndex={flying}
              onHover={setHoverIdx}
              onOpen={setFlying}
              onBackTop={backTop}
            />
          </motion.section>
        </div>
      </div>

      {/* 主角金框：钉在屏上，姿态跟着滚动走；落到墙上 / 有一只在飞回来的时候藏起来 */}
      <HeroFrame project={project} scrollY={scrollY} tl={tl} hidden={landed || flying !== null} />

      {flying !== null && (
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-20"
          initial={{
            x: wall.slotX(flying) - hero.w / 2,
            y: vh * WALL_ROW_CY - hero.h / 2,
            scale: wall.wallW / hero.w,
            rotate: 0,
          }}
          animate={{ x: vw / 2 - hero.w / 2, y: vh / 2 - hero.h / 2, scale: 1, rotate: HERO_TILT }}
          transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1] }}
          onAnimationComplete={onFlown}
        >
          <FramePiece project={labProjects[flying]} width={hero.w} />
        </motion.div>
      )}
    </div>
  );
}
