import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  animate,
  motion,
  useAnimationControls,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { labProjects, type LabProject } from "../data/labs";
import { useLanguage } from "../i18n/LanguageContext";
import { playNavigate } from "../audio/sfx";
import { DetailBackdrop, DetailPage } from "./LabDetail";
import { usePageShift } from "../components/PageShift";
import { getViewWidth, isMobileView, useMobileHorizontalDrag } from "../device";
import { useReportDarkNav } from "../state/chrome";
import { INTRO_SESSION_KEY } from "../state/intro";
import { isImageReady, loadImage, loadImages, warmBytes } from "../components/life/preload";
import { useLenis } from "lenis/react";
import { warmLabDetail, warmLabProject } from "../components/lab/preload";

/**
 * 实验室 · 画展。
 *
 * 一条滚动、一个假透视走廊（纯 2D 多层缩放，所有东西共用一个消失点）：
 * 1. 第一屏：一整面墙横在走廊入口左侧，珍珠小羊挂在墙上、两座小羊雕像
 *    立在墙前；墙右缘是转角，转过去就是走廊
 * 2. 往下滚：人先沿墙向右平移到走廊中轴、再往前走，一站站看展
 */

/** 走廊四站 */
const N = labProjects.length;

/** 滚动总长（px）：沿墙平移 + 进走廊 + 四站节拍 + 出口 */
const SCROLL_LEN = 7000;
/** 点画框翻转看详情。详情页做好了，线上一起放开（之前只在本地开发时开着） */
const DETAIL_ENABLED = true;

/** 壁灯：灭灯态为蓝罩台灯（与第一屏同款），亮灯态为暖罩+光锥，
    交叉淡入淡出。蓝灯按亮灯画布里灯具的位置对位（灯具同尺寸：
    亮灯画布 616x347、灯具在 x218 起 178x209，蓝灯画布 179x210） */
function WallLamp({ hover, width, height }: { hover: boolean; width: number; height: number }) {
  const k = width / 616;
  return (
    <div className="absolute" style={{ width, height }}>
      <img
        src="/assets/lab/gallery-lamp-entrance.webp"
        alt=""
        draggable={false}
        className="absolute select-none"
        style={{
          left: 218 * k,
          top: (height - 347 * k) / 2,
          width: 179 * k,
          height: 210 * k,
          opacity: hover ? 0 : 1,
          transition: "opacity 0.35s ease",
        }}
      />
      <img
        src="/assets/lab/gallery-lamp-on.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain"
        style={{ opacity: hover ? 1 : 0, transition: "opacity 0.35s ease" }}
      />
    </div>
  );
}

/* ---------------- 入口：一面墙 + 两座小羊雕像 ---------------- */

/**
 * 珍珠小羊油画：复刻参考站邮票的 hover 手感——
 * 悬停缓动放大 1.02 并朝鼠标所在方向轻微 3D 倾斜（约 ±1.2°），移开弹回。
 * 开场动画播放期间隐藏（透明但可测量），避免与飞行中的大图重影。
 * 坐标单位为墙面局部 px（外层已按深度缩放）。
 */
function EntrancePainting({
  hidden,
  rect,
  pe,
  mobile,
  onHover,
}: {
  hidden: boolean;
  rect: { left: number; top: number; width: number; height: number };
  pe: MotionValue<"auto" | "none">;
  mobile: boolean;
  onHover: (h: boolean) => void;
}) {
  const spring = { stiffness: 160, damping: 19 };
  const rotateX = useSpring(0, spring);
  const rotateY = useSpring(0, spring);
  const scale = useSpring(1, { stiffness: 180, damping: 20 });

  return (
    <motion.img
      id="lab-entrance-painting"
      src="/assets/lab/gallery-painting-big.webp"
      alt=""
      draggable={false}
      className="absolute max-w-none cursor-pointer select-none"
      style={{
        ...rect,
        opacity: hidden ? 0 : 1,
        pointerEvents: pe,
        rotateX: mobile ? undefined : rotateX,
        rotateY: mobile ? undefined : rotateY,
        scale: mobile ? undefined : scale,
        transformPerspective: mobile ? undefined : 900,
      }}
      onPointerMove={(e) => {
        if (mobile) return;
        const r = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        rotateX.set(-dy * 3.6);
        rotateY.set(dx * 3.6);
        scale.set(1.02);
        onHover(true);
      }}
      onPointerLeave={() => {
        if (mobile) return;
        rotateX.set(0);
        rotateY.set(0);
        scale.set(1);
        onHover(false);
      }}
    />
  );
}

/** 入口墙：一块世界物件，墙上挂画和壁灯一起随相机缩放/平移 */
function EntranceWall({
  camDepth,
  camX,
  frame,
  paintingHidden,
}: {
  camDepth: MotionValue<number>;
  camX: MotionValue<number>;
  frame: ShellFrame;
  paintingHidden: boolean;
}) {
  const { t } = useLanguage();
  const u = frame.g;
  const mobile = frame.vw < 560;
  const entW = mobile ? 1560 : ENT_W;
  const entH = entW / (3194 / 1730);
  const entCx = -CO_WALL_X - entW / 2;
  const [lampOn, setLampOn] = useState(false);
  /* 相机拐进走廊（cz > 280，即 d <= 200）时入口墙早已完全滑出屏幕左侧，及时截断缩放并卸载图层，防止放大到 20 倍撑爆手机 Safari 显存 */
  const { x, scale, opacity, display } = usePieceMotion(camDepth, camX, ENT_Z, entCx, frame, "cut", 200);
  const y = useTransform(scale, (s) => (CO_WALL_H + entH * (1 - ENT_FOOT)) * u * s);
  const tf = useMotionTemplate`translate(-50%, -100%) translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  /* 墙过身后虽然透明，但已被放大到盖住整屏——必须连指针一起关掉，
     否则会挡住后面展板的 hover/点击 */
  const pe = useTransform(opacity, (o) => (o > 0 ? ("auto" as const) : ("none" as const)));
  /* 局部坐标（世界 px）：画挂在相机起点正前方 → 局部 x = 起点相对墙左缘；
     画心在视线上方 55 */
  const floorL = entH * ENT_FOOT; // 主墙脚线
  const axisL = ENT_CAM_X0 - (entCx - entW / 2);
  const paintL = axisL - ENT_PAINT_W / 2;
  const paintT = floorL - CO_WALL_H - 55 - ENT_PAINT_H / 2;
  /* 壁灯：WallLamp 画布 616 宽里灯具 179 宽，灯具要 44 世界px → 画布 152×86，
     灯具顶正好在画布顶，灯具底离画框顶 8 */
  const lampW = 152;
  const lampH = (lampW * 347) / 616;
  const lampFixH = (lampW / 616) * 210;
  const lampL = axisL - lampW / 2;
  const lampT = paintT - 8 - lampFixH;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const px = (v: number) => v * u;

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: "50%",
        top: frame.vpY,
        width: px(entW),
        height: px(entH),
        opacity,
        display,
        transform: tf,
        transformOrigin: "50% 100%",
      }}
    >
      <img
        src="/assets/lab/entrance-wall.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
      />
      {/* 壁灯：hover 油画时点亮 */}
      <div className="absolute" style={{ left: px(lampL), top: px(lampT), width: px(lampW), height: px(lampH) }}>
        <WallLamp hover={lampOn} width={px(lampW)} height={px(lampH)} />
      </div>
      {/* 珍珠小羊油画：开场动画的落位目标（按 id 量取屏幕矩形） */}
      <EntrancePainting
        hidden={paintingHidden}
        rect={{
          left: px(paintL),
          top: px(paintT),
          width: px(ENT_PAINT_W),
          height: px(ENT_PAINT_H),
        }}
        pe={pe}
        mobile={mobile}
        onHover={setLampOn}
      />
      {/* 滚动提示：手绘小箭头（切图朝下，转 -90° 朝右，呼应先向右平移）+ ( Scroll )，
          整组在画下方居中；箭头轻轻向右点 */}
      <motion.img
        src="/assets/lab/scroll-arrow.svg"
        alt=""
        draggable={false}
        className="absolute select-none"
        style={{
          left: px(axisL - 34 - 7),
          top: px(paintT + ENT_PAINT_H + 29 - 9.25),
          width: px(14),
          height: px(18.5),
          rotate: -90,
        }}
        animate={reduced ? undefined : { x: [0, px(3), 0], opacity: [1, 0.55, 1] }}
        transition={{ duration: 1.9, ease: "easeInOut", repeat: Infinity }}
      />
      <span
        className="font-hand absolute whitespace-nowrap"
        style={{
          left: px(axisL - 19),
          top: px(paintT + ENT_PAINT_H + 20),
          fontSize: px(14),
          color: "#7E4218",
          WebkitTextStroke: `${px(1)}px #7E4218`,
        }}
      >
        {t(frame.vw < 560 ? "lab.entry.swipe" : "lab.entry.scroll")}
      </span>
    </motion.div>
  );
}

/** 小羊雕像（side -1 左 / 1 右）：独立世界物件，站在墙前一步的地板上，
    对称立在画的两侧；右边那座水平镜像，两座对称朝外 */
function EntranceStatue({
  camDepth,
  camX,
  side,
  frame,
}: {
  camDepth: MotionValue<number>;
  camX: MotionValue<number>;
  side: 1 | -1;
  frame: ShellFrame;
}) {
  const u = frame.g;
  const dx = frame.vw < 560 ? 122 : STATUE_DX;
  const { x, scale, opacity, display } = usePieceMotion(camDepth, camX, STATUE_Z, ENT_CAM_X0 + side * dx, frame, "cut", 200);
  const y = useTransform(scale, (s) => CO_WALL_H * u * s);
  const tf = useMotionTemplate`translate(-50%, -100%) translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: "50%",
        top: frame.vpY,
        width: STATUE_W * u,
        height: STATUE_H * u,
        opacity,
        display,
        transform: tf,
        transformOrigin: "50% 100%",
      }}
    >
      <img
        src="/assets/lab/prop-statue.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        style={{ transform: side === 1 ? "scaleX(-1)" : undefined }}
      />
    </motion.div>
  );
}

/* ---------------- 假透视节拍走廊 ---------------- */

/** 节拍：走-停-走。d 到达停留、de 离开停留（相机深度在这段持平） */
type Beat = { d: number; de: number };
const BEATS: Beat[] = [
  { d: 0.24, de: 0.32 },
  { d: 0.44, de: 0.52 },
  { d: 0.64, de: 0.72 },
  { d: 0.84, de: 0.91 },
];

/** 假透视：所有东西共用一个消失点。画面大小 = FOCAL / (物体深度 − 相机深度) */
const FOCAL = 400;

/* —— 走廊（第一视角）——
   世界里什么都不动，只有相机沿走廊中轴往前走：眼前的柱子越来越大、
   从画面两边滑出去，远处的尽头墙一点点变大，展板贴在两侧墙上被走过。
   世界单位 = 设计稿 px（720×450 = 16:10），消失点在画面 55.5% 高度。 */
const CO_VP_D = 249.9; // 消失点距画布顶（设计稿 px）
const CO_WALL_X = 280; // 墙面到走廊轴的距离（地脚线/天花线所在）
/** 尽头墙切图 293×151：四角正好落在天花线/地脚线上 → 两条线的斜率 = 75.35/145.25 */
const CO_SLOPE = 75.35 / 145.25;
const CO_END_W = 293.25;
const CO_END_H = 151.5;
/** 天花/地面在墙面处相对消失点的高度（同一深度处水平不变） */
const CO_WALL_H = CO_WALL_X * CO_SLOPE;
/** 角线描边粗细（设计稿 px）：画面边缘处 / 消失点处，中间线性收细 */
const CO_LINE_T = 3;
const CO_LINE_T_FAR = 0.9;

/** 展板：贴墙立着、朝走廊里探出的隔断，左右交替 */
const PANEL_W = 245; // 板宽（设计稿 px）
/** 板子离墙立在走廊里，外侧和墙线留一条缝。
    约束：内缘离中轴 ≥ 20，路过时（深度钳位 20）板才能整块滑出画面 */
const PANEL_INSET = 15;
/** 板中心离走廊轴的距离 */
const PANEL_CX = CO_WALL_X - PANEL_W / 2 - PANEL_INSET;
const STATION_SIDE: (1 | -1)[] = [-1, 1, -1, 1];
/** 相机走到展板旁停下时，与展板的深度差（越小板越大）。桌面端 340，手机竖屏下贴近到 200 让画框放大突出 */
const DWELL_DIST = 340;
const MOBILE_DWELL_DIST = 200;
const STATION_GAP = 380;
/** 第一站放在进走廊之后 */
const STATION_Z = STATION_SIDE.map((_, i) => 980 + i * STATION_GAP);
/** 每站的停留相机深度 */
const VIEW_Z = STATION_Z.map((z) => z - DWELL_DIST);
const MOBILE_VIEW_Z = STATION_Z.map((z) => z - MOBILE_DWELL_DIST);
/** 走完最后一站再往前一段，尽头墙迎面放大到填满画面中央 */
const CAM_END = VIEW_Z[3] + STATION_GAP;
const EXIT_Z = CAM_END + 230;

/* —— 入口 ——
   一整面墙（切图 3194×1730，带转角条）横在走廊入口左侧，右缘的转角接走廊左墙：
   走廊的角线从这个深度往里画。相机起步时在墙前偏左，画正对镜头，
   整屏都是墙（转角在画面右缘之外）；先沿墙向右平移到走廊中轴，再往前进走廊。 */
const ENT_Z = 487; // 墙的深度：主墙脚落在画面 82% 高
/** 墙宽：进场迈步起点（相机在 -60、墙缩到 0.73）时也要盖满整屏宽 */
const ENT_W = 1200;
/** 切图里主墙脚线在 93.5% 高，右侧转角条再往下伸到底 */
const ENT_FOOT = 0.935;
/** 相机起点横向（世界 px）：整个转角条（切图右侧 12.8%，≈154 世界 px）都在画面右缘外——
    进场迈步起点时转角条内缘也至少在 377（半屏 360 之外） */
const ENT_CAM_X0 = -CO_WALL_X - 650;
const ENT_PAINT_W = 160; // 珍珠小羊（切图 557×610）
const ENT_PAINT_H = ENT_PAINT_W * (610 / 557);
/** 小羊雕像（切图 293×620）：两座对称立在画两侧、墙前一步的地板上 */
const STATUE_Z = ENT_Z - 70;
const STATUE_H = 150;
const STATUE_W = STATUE_H * (293 / 620);
const STATUE_DX = 175;

/** 圆柱成对、每 190 一对，从入口一路排到尽头，与展板深度错开半格（95）：
    每块展板前后各夹一对柱子，不会和板撞在同一深度 */
const CO_COL_GAP = 190;
const CO_COLUMN_Z = Array.from(
  { length: 10 },
  (_, i) => STATION_Z[0] - 95 - CO_COL_GAP + i * CO_COL_GAP, // 695 … 2405，最后一对贴着尽头墙拐角
);
/** 天窗：三盏等距铺满走廊（比展板稀，避免远处叠成一串） */
const CO_OVAL_Z = [0, 1, 2].map((i) => STATION_Z[0] + 60 + i * 570);

/** 走廊零散摆件：{深度, 侧, 素材, 世界高} —— 靠墙立着，和展板错开 */
type PropSpec = { z: number; side: 1 | -1; kind: PropKind };
type PropKind = "chair" | "plant" | "amphora" | "vase";
const PROP_ASSET: Record<PropKind, { src: string; ratio: number; h: number }> = {
  chair: { src: "prop-chair", ratio: 183 / 371, h: 118 },
  plant: { src: "prop-plant", ratio: 178 / 330, h: 105 },
  amphora: { src: "prop-amphora", ratio: 114 / 300, h: 88 },
  vase: { src: "door-vase", ratio: 156 / 226, h: 70 },
};
/** 每站脚边轮放的摆件（贴板子靠墙那一角） */
const STATION_PROP: PropKind[] = ["chair", "plant", "amphora", "vase"];
const CO_PROPS: PropSpec[] = [
  { z: STATION_Z[0] + 190, side: 1, kind: "amphora" },
  { z: STATION_Z[1] + 190, side: -1, kind: "vase" },
  { z: STATION_Z[2] + 190, side: 1, kind: "plant" },
  { z: STATION_Z[3] + 190, side: -1, kind: "amphora" },
];

/** q → 相机横向：开头一段沿墙向右平移到走廊中轴，之后一直在中轴上 */
const CAM_X_KEYS = [0, 0.15];
/** 滚到这里砖红入口墙已经出画、满屏奶油黄，顶栏从白字换黑字 */
const CORRIDOR_Q = 0.13;
const CAM_X_VALS = [ENT_CAM_X0, 0];
/** q → 相机深度：平移快结束时起步往前走到第一站，随后平台对应停留、斜坡对应前进 */
const CAM_Z_KEYS = [0, 0.12, 0.24, 0.32, 0.44, 0.52, 0.64, 0.72, 0.84, 0.91, 1];
const CAM_Z_VALS = [
  0,
  0,
  VIEW_Z[0],
  VIEW_Z[0],
  VIEW_Z[1],
  VIEW_Z[1],
  VIEW_Z[2],
  VIEW_Z[2],
  VIEW_Z[3],
  VIEW_Z[3],
  CAM_END,
];
const MOBILE_CAM_Z_VALS = [
  0,
  0,
  MOBILE_VIEW_Z[0],
  MOBILE_VIEW_Z[0],
  MOBILE_VIEW_Z[1],
  MOBILE_VIEW_Z[1],
  MOBILE_VIEW_Z[2],
  MOBILE_VIEW_Z[2],
  MOBILE_VIEW_Z[3],
  MOBILE_VIEW_Z[3],
  CAM_END,
];

/** 到站时"转头"看展板：整幅画面（连消失点）朝展板那侧平移——
    小角度转头在透视上就等于整幅画面平移。转头量 = 停留时板中心离走廊轴的屏距，
    转完展品正好停在页面水平正中。两站之间不"回正—直走—再转"，
    而是从上一站离开到下一站到达，用一条贯穿全程的平滑曲线从一侧过渡到另一侧，
    像人边走边自然转头，中途不停顿 */
const TURN_RAMP = 150;
const smooth = (t: number) => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return k * k * (3 - 2 * k);
};
/** 返回设计稿 px（调用方乘 frame.g） */
function camTurnOf(cz: number, mobile = false) {
  const dwell = mobile ? MOBILE_DWELL_DIST : DWELL_DIST;
  const vz = mobile ? MOBILE_VIEW_Z : VIEW_Z;
  const turnD = PANEL_CX * (FOCAL / dwell);
  const turnAt = (i: number) => -STATION_SIDE[i] * turnD;
  const last = vz.length - 1;
  /* 进走廊：到第一站前 TURN_RAMP 内转向第一块板 */
  if (cz <= vz[0]) return turnAt(0) * smooth((cz - (vz[0] - TURN_RAMP)) / TURN_RAMP);
  /* 出走廊：离开最后一站后在 TURN_RAMP 内回正，正对尽头墙 */
  if (cz >= vz[last]) return turnAt(last) * (1 - smooth((cz - vz[last]) / TURN_RAMP));
  for (let i = 0; i < last; i++) {
    if (cz < vz[i + 1]) {
      const t = smooth((cz - vz[i]) / (vz[i + 1] - vz[i]));
      return turnAt(i) + (turnAt(i + 1) - turnAt(i)) * t;
    }
  }
  return 0;
}

type ShellFrame = { g: number; vpX: number; vpY: number; vw: number; vh: number };
/** 走廊画布坐标系：桌面端按 cover 铺满视口；手机竖屏下按屏宽缩放镜头，让两座入口雕像、展板与尽头门完整收进竖屏 */
function shellFrame(vw: number, vh: number): ShellFrame {
  if (vw < 560) {
    const g = vw / 345;
    return { g, vpX: vw / 2, vpY: vh * 0.54, vw, vh };
  }
  const g = Math.max(vw / 720, vh / 450);
  return { g, vpX: vw / 2, vpY: (vh - 450 * g) / 2 + CO_VP_D * g, vw, vh };
}

/** 相机贴脸时深度钳位：钳得越低，路过的东西能放得越大、越保证滑出画面 */
function depthOf(z: number, camZ: number) {
  return Math.max(z - camZ, 20);
}
function scaleOf(z: number, camZ: number) {
  return FOCAL / depthOf(z, camZ);
}

/** 隔断板统一用一张高板（切图 1486×1354，板内坐标按 1/2 计）；
    侧棱画在左边，右墙的站水平镜像。展品尺寸各站按素材等比 */
const PANEL_PW = 743;
const PANEL_PH = 677;
/* 板内排版（按设计稿比例）：壁灯灯具顶贴板顶（1%），灯具高 16%，
   画框顶在 21.5%、高 50%、水平居中；号码牌在画框下方居中（顶 75.5%） */
const ART_TOP = Math.round(PANEL_PH * 0.215);
const ART_H = Math.round(PANEL_PH * 0.5);
const LAMP_FIX_H = Math.round(PANEL_PH * 0.16);
const LAMP_TOP = Math.round(PANEL_PH * 0.01);
const BADGE_TOP = Math.round(PANEL_PH * 0.755);
/**
 * 每站的画：art 是连框带画的整张图；mask 是它的外形剪影（翻面后当遮罩用）；
 * solid 是剪影里最大的一块实心矩形（占图的比例），放大时要让这块盖满屏幕，框的花边才全出屏。
 */
type StationCfg = {
  art: string;
  mask: string;
  ratio: number;
  solid: { x: number; y: number; w: number; h: number };
};
const STATION_CFG: StationCfg[] = [
  { art: "art-tee", mask: "mask-tee", ratio: 286 / 352, solid: { x: 0.063, y: 0.046, w: 0.878, h: 0.875 } },
  { art: "art-sticker", mask: "mask-sticker", ratio: 555 / 666, solid: { x: 0.027, y: 0.006, w: 0.919, h: 0.955 } },
  { art: "art-drink", mask: "mask-drink", ratio: 661 / 694, solid: { x: 0.207, y: 0.21, w: 0.592, h: 0.556 } },
  { art: "art-candle", mask: "mask-candle", ratio: 615 / 725, solid: { x: 0.127, y: 0.143, w: 0.72, h: 0.694 } },
];

/** 到站时顺带"低头"一点：板子立在地上、画框比视线略低，整幅画面往上抬，
    让画框中心正好落在屏幕竖直正中。抬升量 = 消失点离屏中的距离 + 画框中心低于视线的屏距。
    四站抬升量相同：进走廊时抬起来、走廊里保持、出走廊回正，路上不跳 */
const PANEL_WORLD_H = PANEL_PH * (PANEL_W / PANEL_PW);
const ART_CENTER_ABOVE_FLOOR = PANEL_WORLD_H * (1 - (ART_TOP + ART_H / 2) / PANEL_PH);
/** 返回设计稿 px（画面上抬为正，调用方乘 frame.g） */
function camTiltOf(cz: number, mobile = false) {
  const dwell = mobile ? MOBILE_DWELL_DIST : DWELL_DIST;
  const vz = mobile ? MOBILE_VIEW_Z : VIEW_Z;
  const tiltD = CO_VP_D - 225 + (CO_WALL_H - ART_CENTER_ABOVE_FLOOR) * (FOCAL / dwell);
  const last = vz.length - 1;
  if (cz <= vz[0]) return tiltD * smooth((cz - (vz[0] - TURN_RAMP)) / TURN_RAMP);
  if (cz >= vz[last]) return tiltD * (1 - smooth((cz - vz[last]) / TURN_RAMP));
  return tiltD;
}

/** 单站展位：世界坐标固定，画面姿态由「它和相机的深度差」统一换算 */
function CorridorStation({
  camDepth,
  camX,
  sizeK,
  frame,
  index,
  project,
  enabled,
  artHidden,
  onOpen,
}: {
  camDepth: MotionValue<number>;
  camX: MotionValue<number>;
  sizeK: number;
  frame: ShellFrame;
  index: number;
  project: LabProject;
  enabled: boolean;
  /** 画框正被翻出去看详情：墙上的原画隐藏，避免和翻转层重影 */
  artHidden: boolean;
  onOpen: (project: LabProject, rect: DOMRect) => void;
}) {
  const cfg = STATION_CFG[index];
  const pw = PANEL_PW;
  const ph = PANEL_PH;
  const z = STATION_Z[index];
  const side = STATION_SIDE[index];
  const flip = side === 1;
  const mobile = frame.vw < 560;
  const minD = mobile ? 55 : 21;
  const [hover, setHover] = useState(false);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const scale = useTransform(camDepth, (cz) => (FOCAL / Math.max(z - cz, minD)) * sizeK);
  /* 板子离墙一条缝立在走廊里（中心在 PANEL_CX）；随相机靠近沿自己那侧滑出画面 */
  const worldXd = side * PANEL_CX;
  const x = useTransform([camDepth, camX], (v: number[]) => {
    const [cz, cx] = v;
    return (worldXd - cx) * frame.g * (FOCAL / Math.max(z - cz, minD));
  });
  /* 板脚落在该深度的地脚线上（用 translate3d 承载纵移，避免每帧修改 top 触发布局回流） */
  const feetOffset = useTransform(camDepth, (cz) => CO_WALL_H * frame.g * (FOCAL / Math.max(z - cz, minD)));
  /* 不做淡出：相机走到板子跟前之前它的内缘就已经滑出画面。
     深度触到钳位后直接隐藏并 display: none，释放超大 GPU 合成纹理 */
  const visible = useTransform(camDepth, (cz) => (z - cz > minD ? 1 : 0));
  const display = useTransform(visible, (v) => (v > 0 ? "block" : "none"));
  const transform = useMotionTemplate`translate(-50%, -100%) translate3d(${x}px, ${feetOffset}px, 0) scale(${scale})`;
  /* 展品 hover：与珍珠小羊油画同款——缓动放大 + 朝鼠标方向轻微 3D 倾斜 */
  const tiltSpring = { stiffness: 160, damping: 19 };
  const artRX = useSpring(0, tiltSpring);
  const artRY = useSpring(0, tiltSpring);
  const artScale = useSpring(1, { stiffness: 180, damping: 20 });

  /* 板内排版：画框水平居中、顶在 21.5%；壁灯灯具顶贴板顶、灯具高 16%；
     号码牌在画框下方居中 */
  const ah = ART_H;
  const aw = Math.round(ah * cfg.ratio);
  const artLeft = (pw - aw) / 2;
  const artTop = ART_TOP;
  /* WallLamp 画布 616×347，灯具 179×210 在画布里；按灯具高 LAMP_FIX_H 反推画布尺寸，
     灯具顶恰在画布顶 */
  const lampW = Math.round((LAMP_FIX_H / 210) * 616);
  const lampH = Math.round((lampW * 347) / 616);
  const lampTop = LAMP_TOP;
  /* 脚边摆件（每站轮放）：立在板子靠墙那一角的地上，比板脚略低（在板前面） */
  const prop = PROP_ASSET[STATION_PROP[index % STATION_PROP.length]];
  const propH = Math.round(prop.h * (PANEL_PW / PANEL_W)); // 世界 px → 板内 px
  const propW = Math.round(propH * prop.ratio);
  const propInset = Math.round(pw * 0.1);

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: "50%",
        top: frame.vpY,
        width: pw,
        height: ph,
        opacity: visible,
        display,
        transform,
        transformOrigin: "50% 100%",
      }}
    >
      {/* 隔断板 */}
      <img
        src="/assets/lab/panel-tall.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        style={{ transform: flip ? "scaleX(-1)" : undefined }}
      />
      {/* 号码牌：画框下方居中 */}
      <img
        src={`/assets/lab/badge-0${index + 1}.webp`}
        alt=""
        draggable={false}
        className="absolute select-none"
        style={{
          top: BADGE_TOP,
          left: (pw - 112) / 2,
          width: 112,
          height: 73,
        }}
      />
      {/* 可点击的作品集群：壁灯 + 带框展品（hover 亮灯 + 缓动放大 + 3D 倾斜） */}
      <button
        type="button"
        onPointerDown={(ev) => {
          downPos.current = { x: ev.clientX, y: ev.clientY };
        }}
        onClick={(ev) => {
          if (!DETAIL_ENABLED) return;
          if (downPos.current && Math.hypot(ev.clientX - downPos.current.x, ev.clientY - downPos.current.y) > 7) {
            return;
          }
          const img = ev.currentTarget.querySelector<HTMLElement>("[data-art]");
          if (!img) return;
          /* 量画框在舞台容器内的矩形；hover 放大 1.02 的那点要扣掉，翻回来落位才严丝合缝 */
          const r = img.getBoundingClientRect();
          const ox = document.body.getBoundingClientRect().left;
          const k = artScale.get();
          const w = r.width / k;
          const h = r.height / k;
          const rect = new DOMRect(r.left - ox + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h);
          playNavigate();
          onOpen(project, rect);
        }}
        onMouseEnter={() => {
          setHover(true);
          /* 碰到哪只框就把那个项目的图先拉齐，悬停到点下去那几百毫秒够用 */
          warmLabProject(project);
        }}
        onMouseLeave={() => setHover(false)}
        onPointerMove={(ev) => {
          if (mobile) return;
          const r = ev.currentTarget.getBoundingClientRect();
          const dx = (ev.clientX - r.left) / r.width - 0.5;
          const dy = (ev.clientY - r.top) / r.height - 0.5;
          artRX.set(-dy * 3.6);
          artRY.set(dx * 3.6);
          artScale.set(1.02);
        }}
        onPointerLeave={() => {
          if (mobile) return;
          artRX.set(0);
          artRY.set(0);
          artScale.set(1);
        }}
        aria-label={`${project.title.zh} / ${project.title.en}`}
        className={`absolute block ${DETAIL_ENABLED ? "cursor-pointer" : "cursor-default"}`}
        style={{
          left: artLeft - 16,
          top: lampTop,
          width: aw + 32,
          height: artTop + ah - lampTop + 16,
          pointerEvents: enabled ? "auto" : "none",
        }}
      >
        <div
          className="absolute"
          style={{
            left: (aw + 32 - lampW) / 2,
            top: 0,
            width: lampW,
            height: lampH,
          }}
        >
          <WallLamp hover={hover || (mobile && enabled)} width={lampW} height={lampH} />
        </div>
        <motion.img
          data-art=""
          src={`/assets/lab/${cfg.art}.webp`}
          alt=""
          draggable={false}
          className="absolute select-none"
          style={{
            left: 16,
            top: artTop - lampTop,
            width: aw,
            height: ah,
            rotateX: mobile ? undefined : artRX,
            rotateY: mobile ? undefined : artRY,
            scale: mobile ? undefined : artScale,
            transformPerspective: mobile ? undefined : 900,
            opacity: artHidden ? 0 : 1,
            filter: hover ? "brightness(1.08)" : "brightness(1)",
            transition: "filter 0.35s ease",
          }}
        />
      </button>
      {/* 脚边摆件：靠墙那一角，压住板子下沿 */}
      <img
        src={`/assets/lab/${prop.src}.webp`}
        alt=""
        draggable={false}
        className="absolute select-none"
        style={{
          top: ph + Math.round(ph * 0.02) - propH,
          width: propW,
          height: propH,
          ...(flip ? { right: propInset } : { left: propInset }),
          transform: flip ? "scaleX(-1)" : undefined,
        }}
      />
    </motion.div>
  );
}

/* —— 走廊建筑件（手绘切图）——
   同一形体导出了两档描边（近看细边 / 远看粗边）：按显示大小选一张，
   只在切换窗口里一张淡出一张淡入（透明度之和恒为 1）。窗口之外任何时刻
   屏上只有一张图——两张图边缘即便差一两像素也不会叠出重影。 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 两档切换：显示高度 h 在 [lo, hi] 之间时线性过渡，返回近看档（细边）的透明度 */
function nearMix(h: number, lo: number, hi: number) {
  return clamp01((h - lo) / (hi - lo));
}

/** 建筑件通用姿态：世界坐标（设计稿 px）→ 屏幕 px。
    屏幕 x = (物体 x − 相机横向) × 缩放。
    fade：近处渐隐（柱子/摆件，防止贴脸消失的跳变）；
    cut：不淡出，靠自身滑出画面，深度触到钳位才隐藏（入口墙，
         它的右缘在钳位前早就滑出画面） */
function usePieceMotion(
  camDepth: MotionValue<number>,
  camX: MotionValue<number>,
  z: number,
  worldXd: number,
  frame: ShellFrame,
  mode: "fade" | "cut" = "fade",
  cutDist = 21,
) {
  const minD = mode === "cut" ? cutDist : 44;
  const x = useTransform([camDepth, camX], (v: number[]) => {
    const [cz, cx] = v;
    return (worldXd - cx) * frame.g * (FOCAL / Math.max(z - cz, minD));
  });
  const scale = useTransform(camDepth, (cz) => FOCAL / Math.max(z - cz, minD));
  const opacity = useTransform(camDepth, (cz) => {
    const d = z - cz;
    if (mode === "cut") return d > cutDist ? 1 : 0;
    if (d <= 44) return 0;
    if (d < 110) return (d - 44) / 66;
    return 1;
  });
  const display = useTransform(opacity, (o) => (o > 0 ? "block" : "none"));
  return { x, scale, opacity, display };
}

/** 走廊里的零散摆件：靠墙立在地上（离墙线一条缝，和展板一样） */
function CorridorProp({
  camDepth,
  camX,
  spec,
  frame,
}: {
  camDepth: MotionValue<number>;
  camX: MotionValue<number>;
  spec: PropSpec;
  frame: ShellFrame;
}) {
  const u = frame.g;
  const a = PROP_ASSET[spec.kind];
  const H = a.h;
  const W = H * a.ratio;
  const { x, scale, opacity, display } = usePieceMotion(
    camDepth,
    camX,
    spec.z,
    spec.side * (CO_WALL_X - PANEL_INSET - W / 2),
    frame,
  );
  const y = useTransform(scale, (s) => CO_WALL_H * u * s);
  const tf = useMotionTemplate`translate(-50%, -100%) translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: "50%",
        top: frame.vpY,
        width: W * u,
        height: H * u,
        opacity,
        display,
        transform: tf,
        transformOrigin: "50% 100%",
      }}
    >
      <img
        src={`/assets/lab/${a.src}.webp`}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
        style={{ transform: spec.side === 1 ? "scaleX(-1)" : undefined }}
      />
    </motion.div>
  );
}

/** 单根圆柱（side: -1 左墙 / 1 右墙），立在墙前的地板上
    （圆柱左右对称，两侧共用同一张图） */
function CorridorColumn({
  camDepth,
  camX,
  z,
  side,
  frame,
}: {
  camDepth: MotionValue<number>;
  camX: MotionValue<number>;
  z: number;
  side: 1 | -1;
  frame: ShellFrame;
}) {
  const u = frame.g; // 设计稿 px → 屏幕 px
  /* 世界尺寸（设计稿 px）：高 340，宽按切图比例 322/1793（切图无留白，底边即柱础底） */
  const H = 340;
  const W = H * (322 / 1793);
  /* 独立立柱：站在墙前一个柱宽处的地板上，地脚线整条从柱身后面穿过、
     不碰柱础，柱础清楚地立在地上。柱高 340 > 走廊墙高 290，柱头探到天花线上方 */
  const { x, scale, opacity, display } = usePieceMotion(camDepth, camX, z, side * (CO_WALL_X - W), frame);
  const y = useTransform(scale, (s) => CO_WALL_H * u * s);
  const tf = useMotionTemplate`translate(-50%, -100%) translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: "50%",
        top: frame.vpY,
        width: W * u,
        height: H * u,
        opacity,
        display,
        transform: tf,
        transformOrigin: "50% 100%",
      }}
    >
      <img
        src="/assets/lab/gallery-c-col.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
      />
    </motion.div>
  );
}

/** 顶灯：悬在走廊中轴上方，锚点 = 灯体中心。大小两档描边交叉 */
function CorridorOval({
  camDepth,
  camX,
  z,
  frame,
}: {
  camDepth: MotionValue<number>;
  camX: MotionValue<number>;
  z: number;
  frame: ShellFrame;
}) {
  const u = frame.g;
  const W = 181.5; // 大档原始尺寸（设计稿 px）
  const H = 56.75;
  const { x, scale, opacity, display } = usePieceMotion(camDepth, camX, z, 0, frame);
  /* 灯体贴在该深度的天花上 */
  const y = useTransform(scale, (s) => -CO_WALL_H * u * s);
  const tf = useMotionTemplate`translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  /* 两档描边折算到显示高度 h：大档 ≈0.053h、小档 ≈0.077h；
     同深度处角线粗细 ≈ 0.9 + 1.62·s（设计px）。两档与角线偏差相等的点在 s≈0.45、
     h≈25.5——之前用大档、之后用小档，窄窗口内过渡，让天窗描边始终贴着角线粗细 */
  const oBig = useTransform(scale, (s) => nearMix(H * s, 22, 29));
  const oSmall = useTransform(oBig, (o) => 1 - o);
  const imgCls = "absolute inset-0 h-full w-full select-none";
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: "50%",
        top: frame.vpY,
        width: W * u,
        height: H * u,
        opacity,
        display,
        transform: tf,
        transformOrigin: "50% 50%",
      }}
    >
      <motion.img
        src="/assets/lab/gallery-c-oval-small.webp"
        alt=""
        draggable={false}
        className={imgCls}
        style={{ opacity: oSmall }}
      />
      <motion.img
        src="/assets/lab/gallery-c-oval-big.webp"
        alt=""
        draggable={false}
        className={imgCls}
        style={{ opacity: oBig }}
      />
    </motion.div>
  );
}

/** 走廊四条角线：天花线 ×2 + 地脚线 ×2，都是过消失点的直线——
    相机沿中轴前进时它们在画面上纹丝不动。相机横向偏离中轴时，
    每条线的方向 = atan2(±墙高, ±墙距 − 相机横向)，任何横位都成立。
    走廊从入口墙的深度才开始：比它更近的那段线不画（线的近端夹在该深度的投影半径处），
    相机走过入口后整条画满。用手绘黑线切图从消失点向四角拉出 */
function CorridorLines({
  frame,
  camDepth,
  camX,
  vw,
  vh,
}: {
  frame: ShellFrame;
  camDepth: MotionValue<number>;
  camX: MotionValue<number>;
  vw: number;
  vh: number;
}) {
  /* 角线要有远近：近处（画面边缘）粗、越靠近消失点越细，和柱子描边随距离变细一致。
     线条图按最粗画，再用楔形 clip 从消失点端收细 */
  const t = CO_LINE_T * frame.g; // 画面边缘处的粗细
  const tMin = CO_LINE_T_FAR * frame.g; // 消失点处的粗细
  const len = vw + vh; // 够长：转头平移后仍伸出屏幕
  /* 从消失点到线离开画面左右边缘的距离：楔形在这里到达全粗 */
  const lFull = t + frame.vpX / Math.cos(Math.atan(CO_SLOPE));
  const halfGap = (t - tMin) / 2;
  const edgeAt = (x: number) => Math.max(0, halfGap * (1 - x / lFull));
  const fullXm = Math.min(len, lFull);
  const fullE1 = edgeAt(fullXm);
  const fullE2 = edgeAt(len);
  const fullPoly = `polygon(0 ${halfGap}px, ${fullXm}px ${fullE1}px, ${len}px ${fullE2}px, ${len}px ${t - fullE2}px, ${fullXm}px ${t - fullE1}px, 0 ${t - halfGap}px)`;
  const useLine = (side: 1 | -1, vert: 1 | -1) => {
    const rot = useTransform(camX, (cx) => {
      const deg = (Math.atan2(vert * CO_WALL_H, side * CO_WALL_X - cx) * 180) / Math.PI;
      return `rotate(${deg}deg)`;
    });
    const clip = useTransform([camX, camDepth], (v: number[]) => {
      const [cx, cz] = v;
      const d = ENT_Z - cz;
      /* 走进走廊后（d <= 1）角线全长恒定，直接复用常量字符串避免每帧重绘 polygon 遮罩 */
      if (d <= 1) return fullPoly;
      const r = Math.hypot(side * CO_WALL_X - cx, CO_WALL_H) * (FOCAL / d) * frame.g;
      const xEnd = Math.min(len, t + r);
      if (xEnd >= len) return fullPoly;
      const xm = Math.min(xEnd, lFull);
      const e1 = edgeAt(xm);
      const e2 = edgeAt(xEnd);
      return `polygon(0 ${halfGap}px, ${xm}px ${e1}px, ${xEnd}px ${e2}px, ${xEnd}px ${t - e2}px, ${xm}px ${t - e1}px, 0 ${t - halfGap}px)`;
    });
    return { rot, clip };
  };
  const lines = [
    useLine(-1, -1), // 左上（天花线）
    useLine(1, -1), // 右上
    useLine(-1, 1), // 左下（地脚线）
    useLine(1, 1), // 右下
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      {lines.map(({ rot, clip }, i) => (
        <motion.img
          key={i}
          src="/assets/lab/gallery-c-line.webp"
          alt=""
          draggable={false}
          className="absolute select-none"
          style={{
            left: frame.vpX - t,
            top: frame.vpY - t / 2,
            width: len,
            height: t,
            clipPath: clip,
            transformOrigin: `${t}px 50%`,
            transform: rot,
          }}
        />
      ))}
    </div>
  );
}

/* —— 尽头墙上的小场景（世界 px，墙 293×151，墙底边就是地脚线）——
   壁灯 + 空金框（"下一件留位中"）+ 绿门（Life 页那扇，镜像成往右开）+ 思考羊雕像。
   按参考图的比例排：整组占墙宽约 70%，居中 */
const END_LAMP = { x: 59.5, y: 43, w: 20.4, h: (20.4 * 210) / 179 };
const END_FRAME = { x: 47.5, y: 68.7, w: 44.4, h: (44.4 * 495) / 446 };
/** 门：门框底压在地脚线上（关门切图 703×1106 就是门框的外沿） */
const END_DOOR = { x: 98, h: 108, w: (108 * 703) / 1106 };
/** 开门那张 1093×1229：门框在 x390 起、同尺寸，多出来的是甩开的门板和打到地上的光 */
const END_DOOR_OPEN = { l: -390 / 703, w: 1093 / 703, h: 1229 / 1106 };
/** 雕像：台座立在墙前一步的地上，底比地脚线低一点 */
const END_THINKER = { x: 192.7, w: 39.6, h: (39.6 * 721) / 400, below: 5 };

/** 走廊尽头墙：世界物件，随相机靠近从远处的小矩形一路长大；
    四角始终落在角线上。墙上的小场景贴在墙上一起缩放；鼠标碰到门，门推开、光亮起；点门回首页 */
function CorridorEndWall({
  camDepth,
  camX,
  frame,
  onEnterDoor,
}: {
  camDepth: MotionValue<number>;
  camX: MotionValue<number>;
  frame: ShellFrame;
  onEnterDoor: (rect: DOMRect) => void;
}) {
  const { t } = useLanguage();
  const [doorHover, setDoorHover] = useState(false);
  const [doorPinned, setDoorPinned] = useState(false);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const doorOpen = doorHover || doorPinned;
  const g = frame.g;
  const endZ = frame.vw < 560 ? CAM_END + 275 : EXIT_Z;
  const scale = useTransform(camDepth, (cz) => scaleOf(endZ, cz));
  /* 尽头墙画的是走廊断面（四角在角线上）。相机横向偏离时角线会变斜率，
     让墙随之横移 (1 − 半墙高/墙高)·cx，四角仍恰好落在角线上 */
  const x = useTransform([scale, camX], (v: number[]) => {
    const [s, cx] = v;
    return -(CO_END_H / 2 / CO_WALL_H) * cx * g * s;
  });
  const tf = useMotionTemplate`translate(-50%, -50%) translateX(${x}px) scale(${scale})`;
  /*
   * 墙的黑边不烧在图里、用和角线同一根手绘线勾：粗细取角线在墙四角那一点的粗细
   * （角线从消失点 0.9 到画面边缘 3 线性变粗，墙角离消失点多远就多粗），再除掉整块的缩放，
   * 这样走到尽头墙放大时边也不会跟着变成一根粗杠
   */
  const lineT = CO_LINE_T * g;
  const lineTFar = CO_LINE_T_FAR * g;
  const lFull = lineT + frame.vpX / Math.cos(Math.atan(CO_SLOPE));
  const cornerR = Math.hypot(CO_END_W / 2, CO_END_H / 2) * g;
  const border = useTransform(scale, (s) => {
    const onScreen = lineTFar + (lineT - lineTFar) * Math.min(1, (cornerR * s) / lFull);
    return onScreen / s;
  });
  const negHalf = useTransform(border, (b) => -b / 2);
  const wallW = CO_END_W * g;
  const wallH = CO_END_H * g;
  const spanW = useTransform(border, (b) => wallW + b);
  const spanH = useTransform(border, (b) => wallH + b);
  const bottomTop = useTransform(border, (b) => wallH - b / 2);
  /* 立起来的线：绕左上角转 90° 后线落在边的左侧，再往右挪半根线宽让它骑在边上 */
  const rotL = useMotionTemplate`rotate(90deg) translateY(${negHalf}px)`;
  const lampK = END_LAMP.w / 179;
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: frame.vpX,
        top: frame.vpY,
        width: wallW,
        height: wallH,
        transform: tf,
        transformOrigin: "50% 50%",
      }}
    >
      <img
        src="/assets/lab/gallery-c-endwall.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none"
      />
      {/* 四条边：上下两条横着铺，左右两条转 90° 立起来，两端各多出半根线宽把角包住 */}
      {([0, 1] as const).map((i) => (
        <motion.img
          key={`h${i}`}
          src="/assets/lab/gallery-c-line.webp"
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ left: negHalf, top: i === 0 ? negHalf : bottomTop, width: spanW, height: border }}
        />
      ))}
      {([0, 1] as const).map((i) => (
        <motion.div
          key={`v${i}`}
          className="absolute"
          style={{ left: i === 0 ? 0 : wallW, top: negHalf, width: 0, height: spanH }}
        >
          <motion.img
            src="/assets/lab/gallery-c-line.webp"
            alt=""
            draggable={false}
            className="absolute left-0 top-0 max-w-none select-none"
            style={{ width: spanH, height: border, transformOrigin: "0 0", transform: rotL }}
          />
        </motion.div>
      ))}
      {/* 壁灯：和站台的一样，碰到门时亮起来 */}
      <div
        className="absolute"
        style={{ left: (END_LAMP.x - 218 * lampK) * g, top: END_LAMP.y * g, width: 616 * lampK * g, height: 347 * lampK * g }}
      >
        <WallLamp hover={doorOpen} width={616 * lampK * g} height={347 * lampK * g} />
      </div>
      {/* 空金框：框里一句"下一件留位中" */}
      <div
        className="absolute"
        style={{ left: END_FRAME.x * g, top: END_FRAME.y * g, width: END_FRAME.w * g, height: END_FRAME.h * g }}
      >
        <img src="/assets/lab/end-frame.webp" alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
        <div
          className="absolute flex items-center justify-center text-center whitespace-pre-line"
          style={{
            inset: `${END_FRAME.h * 0.2 * g}px ${END_FRAME.w * 0.2 * g}px`,
            fontSize: 4.1 * g,
            lineHeight: 1.3,
            fontWeight: 600,
            color: "#D9D2C4",
          }}
        >
          {t("lab.gallery.reserved")}
        </div>
      </div>
      {/* 门：关着的一张压在开着的一张上面，鼠标碰到就换过去；整组镜像成往右开。点门推进暖光回首页 */}
      <button
        type="button"
        aria-label={t("lab.gallery.door")}
        onMouseEnter={() => setDoorHover(true)}
        onMouseLeave={() => setDoorHover(false)}
        onPointerDown={(e) => {
          downPos.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
          if (downPos.current && Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y) > 7) {
            return;
          }
          setDoorPinned(true);
          onEnterDoor(e.currentTarget.getBoundingClientRect());
        }}
        className="pointer-events-auto absolute block cursor-pointer"
        style={{
          left: END_DOOR.x * g,
          top: (CO_END_H - END_DOOR.h) * g,
          width: END_DOOR.w * g,
          height: END_DOOR.h * g,
          transform: "scaleX(-1)",
        }}
      >
        {/* 门缝透出来的暖光，铺在门前的地上 */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: -END_DOOR.w * 1.0 * g,
            top: END_DOOR.h * 0.3 * g,
            width: END_DOOR.w * 1.8 * g,
            height: END_DOOR.h * 0.9 * g,
            background: "radial-gradient(ellipse at 50% 55%, rgba(255,205,70,0.4) 0%, rgba(255,205,70,0) 68%)",
            opacity: doorOpen ? 1 : 0,
            transition: "opacity 0.45s ease",
          }}
        />
        <img
          src="/assets/life/seg03/lab-door-open.webp"
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            left: END_DOOR_OPEN.l * END_DOOR.w * g,
            top: 0,
            width: END_DOOR_OPEN.w * END_DOOR.w * g,
            height: END_DOOR_OPEN.h * END_DOOR.h * g,
            opacity: doorOpen ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
        <img
          src="/assets/life/seg03/lab-door.webp"
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          style={{ opacity: doorOpen ? 0 : 1, transition: "opacity 0.25s ease" }}
        />
      </button>
      {/* 思考羊雕像 */}
      <img
        src="/assets/lab/prop-thinker.webp"
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none"
        style={{
          left: END_THINKER.x * g,
          top: (CO_END_H + END_THINKER.below - END_THINKER.h) * g,
          width: END_THINKER.w * g,
          height: END_THINKER.h * g,
        }}
      />
    </motion.div>
  );
}

/**
 * 假透视走廊（纯 2D）：所有东西（入口墙、小羊雕像、圆柱、天窗、展板、摆件、
 * 尽头墙）都是世界物件，按"它和相机的深度差"统一缩放、按相机横向统一平移；
 * 从远到近排序渲染，近的盖住远的。
 */
function FakeCorridor({
  q,
  introZ,
  active,
  paintingHidden,
  openId,
  onOpen,
  onEnterDoor,
}: {
  q: MotionValue<number>;
  introZ: MotionValue<number>;
  active: number;
  paintingHidden: boolean;
  openId: string | null;
  onOpen: (project: LabProject, rect: DOMRect) => void;
  onEnterDoor: (rect: DOMRect) => void;
}) {
  const [vp, setVp] = useState(() => ({
    w: getViewWidth(),
    h: window.innerHeight,
  }));
  useEffect(() => {
    const onResize = () => setVp({ w: getViewWidth(), h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const { w: vw, h: vh } = vp;
  const mobile = vw < 560;
  /* 所有物件按走廊画布坐标系落位：任何长宽比下都贴着同一套角线 */
  const frame = shellFrame(vw, vh);
  /* 板内坐标 PANEL_PW 宽 → 世界里的 PANEL_W（设计稿 px） */
  const sizeK = (PANEL_W * frame.g) / PANEL_PW;

  /* 相机深度 = 滚动节拍深度（过阻尼弹簧：滚轮只推目标值，相机带惯性地追——
     推一下滑一段、稳稳停在节拍点；手机端提高弹簧刚度让手指滑动跟手不拖泥带水）+ 进场时的一小段迈步 */
  const camSpring = mobile
    ? { stiffness: 130, damping: 26, mass: 0.55 }
    : { stiffness: 60, damping: 20, mass: 0.9 };
  const qDepth = useTransform(q, CAM_Z_KEYS, mobile ? MOBILE_CAM_Z_VALS : CAM_Z_VALS);
  const qDepthSoft = useSpring(qDepth, camSpring);
  const camDepth = useTransform([qDepthSoft, introZ], (v: number[]) => v[0] + v[1]);
  /* 相机横向：开头沿墙向右平移到走廊中轴（与深度同参数的弹簧，两者步调一致） */
  const qX = useTransform(q, CAM_X_KEYS, CAM_X_VALS);
  const camX = useSpring(qX, camSpring);

  /* 到站转头：整幅走廊（角线、尽头墙、柱、灯、展板一起）平移 */
  const turnX = useTransform(camDepth, (cz) => camTurnOf(cz, mobile) * frame.g);
  /* 到站低头：整幅走廊上抬，画框落到竖直正中 */
  const turnY = useTransform(camDepth, (cz) => -camTiltOf(cz, mobile) * frame.g);

  /* 所有世界物件按深度从远到近排序渲染：近的永远盖住远的，遮挡关系交给一个列表管 */
  const pieces: { z: number; key: string; el: ReactNode }[] = [
    {
      z: EXIT_Z,
      key: "exit",
      el: <CorridorEndWall camDepth={camDepth} camX={camX} frame={frame} onEnterDoor={onEnterDoor} />,
    },
    ...CO_OVAL_Z.map((z) => ({
      z,
      key: `oval-${z}`,
      el: <CorridorOval camDepth={camDepth} camX={camX} z={z} frame={frame} />,
    })),
    ...CO_COLUMN_Z.flatMap((z) =>
      ([-1, 1] as const).map((side) => ({
        z,
        key: `col-${z}-${side}`,
        el: <CorridorColumn camDepth={camDepth} camX={camX} z={z} side={side} frame={frame} />,
      })),
    ),
    ...CO_PROPS.map((spec) => ({
      z: spec.z,
      key: `prop-${spec.z}-${spec.side}`,
      el: <CorridorProp camDepth={camDepth} camX={camX} spec={spec} frame={frame} />,
    })),
    ...labProjects.map((p, i) => ({
      z: STATION_Z[i],
      key: p.id,
      el: (
        <CorridorStation
          camDepth={camDepth}
          camX={camX}
          sizeK={sizeK}
          frame={frame}
          index={i}
          project={p}
          enabled={active === i + 1}
          artHidden={openId === p.id}
          onOpen={onOpen}
        />
      ),
    })),
    {
      z: ENT_Z,
      key: "entrance",
      el: <EntranceWall camDepth={camDepth} camX={camX} frame={frame} paintingHidden={paintingHidden} />,
    },
    ...([-1, 1] as const).map((side) => ({
      z: STATUE_Z,
      key: `statue-${side}`,
      el: <EntranceStatue camDepth={camDepth} camX={camX} side={side} frame={frame} />,
    })),
  ].sort((a, b) => b.z - a.z);

  return (
    <div className="absolute inset-0">
      {/* 走廊底色：奶油黄铺满全屏（四边超采 16px，呼吸浮动时不露底），
          取空壳边缘色，超宽/超窄窗口裁出画布时无缝续色 */}
      <div className="absolute" style={{ inset: -16, background: "#FEF0C1" }} />
      {/* 走廊整体（角线 + 所有世界物件）挂在一个转头平移层上 */}
      <motion.div className="absolute inset-0" style={{ x: turnX, y: turnY }}>
        <CorridorLines frame={frame} camDepth={camDepth} camX={camX} vw={vw} vh={vh} />
        <div className="absolute inset-0">
          {pieces.map(({ key, el }) => (
            <div key={key} className="pointer-events-none absolute inset-0">
              {el}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------- 详情：画框原地翻转 → 框形剪影放大到满屏（页面本体见 LabDetail.tsx） ---------------- */

/** 节拍（秒）：原地翻面 → 不停、剪影直接放大出屏；关闭时先把内容淡掉再倒放 */
const FLIP_T = 0.55;
const EXPAND_T = 0.7;
const FADE_T = 0.22;
/** 翻面：起步慢、到 180° 时还带着速度，紧接着就放大，看着是一口气 */
const FLIP_EASE = [0.5, 0, 0.8, 0.8] as const;
/** 翻回来：正常的进出缓动 */
const UNFLIP_EASE = [0.65, 0, 0.35, 1] as const;
/** 放大：先快后慢，没有回弹（参考站邮票长大的手感） */
const EXPAND_EASE = [0.3, 0, 0.2, 1] as const;
/** 放大到实心块刚好盖满屏之后再多一点，手绘边缘不规则，保险 */
const EXPAND_OVER = 1.04;

type FlipPhase = "flip" | "expand" | "open" | "fade" | "shrink" | "unflip";

/**
 * 点击画框看详情：
 * 1. 画框就在原位绕竖轴翻 180°。背面不是金框，而是一块"画框外形"的石墙——
 *    详情页第一屏的空墙按全屏铺在卡片后面，用这幅画的剪影当遮罩只露出正好被画框盖住的那块；
 * 2. 翻到 180° 不停，剪影以自己中心为原点放大（顺手滑到屏幕正中），直到花边全部出屏；
 *    墙纸本身不跟着放大（里面反向缩放抵消），所以放大完和真正的详情页背景逐像素一样，
 *    这时换上 DetailPage，页头 / 金框 / 标签再出场；
 * 3. 关闭倒放：内容先淡掉（露出同样的空墙）→ 剪影缩回画框 → 翻回正面。
 */
function FlipDetail({ index, rect, onClosed }: { index: number; rect: DOMRect; onClosed: () => void }) {
  const cfg = STATION_CFG[index];
  /* 详情页里"下一件"会切项目；翻转卡片的正面始终是最初点的那幅画 */
  const [cur, setCur] = useState(index);
  const curProject = labProjects[cur];
  const [phase, setPhase] = useState<FlipPhase>("flip");
  const [vp] = useState(() => ({ w: getViewWidth(), h: window.innerHeight }));

  /* 卡片中心、放大后要滑到的屏幕正中 */
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const toX = vp.w / 2 - cx;
  const toY = vp.h / 2 - cy;
  /*
   * 放大倍数：卡片停在屏中、以中心放大 S 倍后，剪影里那块实心矩形的四条边都要出屏。
   * 实心块相对卡片中心的偏移也会被放大，所以四条边分开算，取最大的。
   */
  const S = (() => {
    const { x, y, w, h } = cfg.solid;
    const W = rect.width;
    const H = rect.height;
    const l = (0.5 - x) * W; /* 中心到实心块左边的距离（未放大） */
    const r = (x + w - 0.5) * W;
    const t = (0.5 - y) * H;
    const b = (y + h - 0.5) * H;
    return Math.max(vp.w / 2 / l, vp.w / 2 / r, vp.h / 2 / t, vp.h / 2 / b) * EXPAND_OVER;
  })();

  /* 三个动的量：翻转角、放大倍数、位移进度（0 在原位、1 在屏中） */
  const ry = useMotionValue(0);
  const s = useMotionValue(1);
  const k = useMotionValue(0);
  const x = useTransform(k, (v) => v * toX);
  const y = useTransform(k, (v) => v * toY);
  /* 里面那层墙纸反向缩放 / 反向位移，抵消卡片的变换，在屏幕上一动不动 */
  const invS = useTransform(s, (v) => 1 / v);
  const invX = useTransform([k, s], ([kv, sv]: number[]) => (-kv * toX) / sv);
  const invY = useTransform([k, s], ([kv, sv]: number[]) => (-kv * toY) / sv);
  /* 剪影下的投影（单独一层同形状的黑块虚化，别给墙纸那层挂 filter，放大时太费）：翻面时有，放大一开始就散掉 */
  const shadowA = useMotionValue(0.32);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    (async () => {
      await animate(ry, 180, { duration: FLIP_T, ease: FLIP_EASE });
      if (!alive.current) return;
      setPhase("expand");
      animate(shadowA, 0, { duration: EXPAND_T * 0.4, ease: "easeOut" });
      animate(k, 1, { duration: EXPAND_T, ease: EXPAND_EASE });
      await animate(s, S, { duration: EXPAND_T, ease: EXPAND_EASE });
      if (!alive.current) return;
      setPhase("open");
    })();
    return () => {
      alive.current = false;
      document.documentElement.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = async () => {
    if (phase !== "open") return;
    setPhase("fade");
    await new Promise((r) => window.setTimeout(r, FADE_T * 1000));
    if (!alive.current) return;
    setPhase("shrink");
    animate(k, 0, { duration: EXPAND_T, ease: EXPAND_EASE });
    await animate(s, 1, { duration: EXPAND_T, ease: EXPAND_EASE });
    if (!alive.current) return;
    animate(shadowA, 0.32, { duration: 0.2 });
    setPhase("unflip");
    await animate(ry, 0, { duration: FLIP_T, ease: UNFLIP_EASE });
    if (alive.current) onClosed();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const showPage = phase === "open" || phase === "fade";
  const showCard = phase !== "open";
  const maskStyle: CSSProperties = {
    WebkitMaskImage: `url(/assets/lab/${cfg.mask}.png)`,
    maskImage: `url(/assets/lab/${cfg.mask}.png)`,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };

  return (
    <div className="fixed inset-0 z-50" style={{ perspective: 1400 }}>
      {/* 翻转 / 放大中的卡片：正面是画，背面是一块画框外形的石墙 */}
      {showCard && (
        <motion.div
          className="pointer-events-none absolute"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            transformStyle: "preserve-3d",
            rotateY: ry,
            scale: s,
            x,
            y,
            willChange: "transform",
          }}
        >
          <img
            src={`/assets/lab/${cfg.art}.webp`}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none"
            style={{ backfaceVisibility: "hidden" }}
          />
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <motion.div
              className="absolute inset-0 bg-black"
              style={{ ...maskStyle, y: 16, filter: "blur(14px)", opacity: shadowA }}
            />
            <div className="absolute inset-0 overflow-hidden" style={maskStyle}>
              {/* 遮罩里：详情页的空墙按全屏铺、按卡片位置反向偏移，露出正好在画框后面的那块 */}
              <motion.div
                className="absolute"
                style={{
                  left: -rect.left,
                  top: -rect.top,
                  width: vp.w,
                  height: vp.h,
                  transformOrigin: `${cx}px ${cy}px`,
                  scale: invS,
                  x: invX,
                  y: invY,
                  willChange: "transform",
                }}
              >
                <DetailBackdrop />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 真正的详情页：剪影放大到满屏后挂上来；关闭时先淡掉，底下的卡片还铺着同样的空墙 */}
      {showPage && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: phase === "fade" ? 0 : 1 }}
          transition={{ duration: FADE_T, ease: "easeOut" }}
          style={{ pointerEvents: phase === "open" ? "auto" : "none" }}
        >
          <DetailPage project={curProject} index={cur} onClose={() => void close()} onNext={setCur} />
        </motion.div>
      )}
    </div>
  );
}

/* ---------------- 开场动画 ---------------- */

/** 大油画切图尺寸与"画芯"（金框内的灰色衬底）在切图内的矩形，用于全屏铺满换算 */
const INTRO_IMG = { w: 1147, h: 1249 };
const INTRO_INNER = { x: 189, y: 153, w: 794, h: 882 };

type IntroRect = { left: number; top: number; width: number; height: number };

/**
 * 开场全屏矩形：把"画芯"放大到刚好铺满视口（金框被推到屏幕外），
 * 缩小归位时金框才逐渐进入视野——对应参考站邮票齿孔边框长出来的效果。
 */
function introBigRect(): IntroRect {
  const vw = getViewWidth();
  const vh = window.innerHeight;
  /* 1.04 轻微过扫，保证手绘画芯的不规则边缘不露出黑底 */
  const s = Math.max(vw / INTRO_INNER.w, vh / INTRO_INNER.h) * 1.04;
  return {
    left: vw / 2 - (INTRO_INNER.x + INTRO_INNER.w / 2) * s,
    top: vh / 2 - (INTRO_INNER.y + INTRO_INNER.h / 2) * s,
    width: INTRO_IMG.w * s,
    height: INTRO_IMG.h * s,
  };
}

/** 开场文字阴影（叠在虚化画面上保证可读） */
const INTRO_TEXT_SHADOW = "0 2px 26px rgba(0,0,0,0.55)";

const INTRO_FILTER_DARK = "brightness(0.45) blur(16px)";
const INTRO_FILTER_LIT = "brightness(1) blur(0px)";

/**
 * 进入 Lab 页的开场（每次进入都播放），复刻参考站的节奏：
 * 油画画芯全屏铺满、压暗且虚化 → 文字叠在画面上亮出 → 文字渐隐 →
 * 画面由暗转亮、模糊散开 → 全屏画面缩小归位到墙面陈列位
 * （金框随缩小进入视野），黑幕同时揭开。
 * 点击任意处跳过；系统开启"减少动态"时直接跳过。
 * 从目录吊牌进来的（startAtShrink）：整页上飞已经是过场，只留最后一段——
 * 第一帧就是亮着的全屏油画跟页面一起上来，落稳后直接缩小归位、黑幕揭开。
 */
/** 开场那张全屏大油画（1147×1249 高清原图，已在 index.html 与 TopNav 预加载） */
const INTRO_PAINTING = "/assets/lab/gallery-painting-big.webp";
/** 亮起并缩进画框前需要准备好的入口首屏素材 */
const LAB_ENTRANCE_FIRST = [
  INTRO_PAINTING,
  "/assets/lab/entrance-wall.webp",
  "/assets/lab/prop-statue.webp",
  "/assets/lab/gallery-lamp-entrance.webp",
  "/assets/lab/gallery-lamp-on.webp",
];

function LabIntro({ onDone, startAtShrink = false }: { onDone: () => void; startAtShrink?: boolean }) {
  const { t } = useLanguage();
  const lenis = useLenis();
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [phase, setPhase] = useState<"text" | "fade" | "bright" | "hold" | "shrink" | "skip">(
    startAtShrink ? "hold" : "text",
  );
  const [hiResReady, setHiResReady] = useState(() => isImageReady(INTRO_PAINTING));
  const [big] = useState<IntroRect>(() => introBigRect());
  const [target, setTarget] = useState<IntroRect | null>(null);
  const timers = useRef<number[]>([]);
  const done = useRef(false);
  /* 目录推着整页上飞的位移量：从目录进来时要等它真正归零再量墙上油画的位置 */
  const pageY = usePageShift();

  const finish = () => {
    if (done.current) return;
    done.current = true;
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    /* 画框归位完成，这时才把滚动放开 */
    lenis?.start();
    onDone();
  };

  useEffect(() => {
    if (reduced) {
      finish();
      return;
    }
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    /*
     * 播放期间锁定滚动。全站滚动是 Lenis 接管的：它自己截滚轮再用 window.scrollTo 推，
     * overflow: hidden 只拦原生滚动拦不住它，所以必须把 Lenis 也停掉，
     * 否则黑幕还在时滚轮已经在悄悄推后面的画廊了。
     */
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    lenis?.stop();

    const at = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms));
    };
    const shrink = () => {
      /* 归位前确保在页顶（万一锁之前吃到过滚轮），再量场景内油画当前的投影屏幕矩形作为归位目标 */
      if (window.scrollY !== 0) {
        lenis?.scrollTo(0, { immediate: true, force: true });
        window.scrollTo(0, 0);
      }
      const el = document.getElementById("lab-entrance-painting");
      if (el) {
        const r = el.getBoundingClientRect();
        const ox = document.body.getBoundingClientRect().left;
        setTarget({ left: r.left - ox, top: r.top, width: r.width, height: r.height });
      }
      setPhase("shrink");
      /* 收尾在缩小真正开始后再计时：飞行 1.1s + 黑幕揭开的尾巴 */
      at(1400, finish);
    };

    const paintingReady = loadImage(INTRO_PAINTING).then(() => {
      setHiResReady(true);
    });
    const entranceReady = loadImages(LAB_ENTRANCE_FIRST, 5);

    if (startAtShrink) {
      /*
       * 等目录整页上飞真正落稳再缩：上飞期间整页带 transform，这时候量到的油画位置
       * 和落稳后差一截，缩到那儿再跟着页面挪一下就是一次跳。
       * 所以盯着位移量归零那一刻（再缓 60ms 让 transform 撤掉、布局稳定），兜底 1.6s。
       */
      let fired = false;
      const go = () => {
        if (fired) return;
        fired = true;
        void entranceReady.then(() => at(60, shrink));
      };
      if (pageY && pageY.get() !== 0) {
        const off = pageY.on("change", (v) => {
          if (v === 0) {
            off();
            go();
          }
        });
        timers.current.push(window.setTimeout(off, 1700));
      }
      at(pageY && pageY.get() !== 0 ? 1600 : 1000, go);
    } else {
      /*
       * 高清大油画（1147×1249）一解码好立刻上屏（不再使用低清马赛克预览图）；
       * 等油画显现满 3.2s 且入口首屏素材解码完成后，淡出文字、亮起高清画并缩进金框。
       */
      void paintingReady.then(() => {
        if (done.current) return;
        const minTextStay = new Promise<void>((r) => at(3200, r));
        void Promise.all([minTextStay, entranceReady]).then(() => {
          if (done.current) return;
          setPhase("fade");
          at(600, () => setPhase("bright"));
          at(2100, shrink);
        });
      });
    }

    return () => {
      document.documentElement.style.overflow = prev;
      /* 被提前卸载（路由切走）也得把滚动还回去 */
      lenis?.start();
      timers.current.forEach(window.clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduced) return null;

  const skip = () => {
    if (phase === "skip") return;
    timers.current.forEach(window.clearTimeout);
    setPhase("skip");
    timers.current.push(window.setTimeout(finish, 280));
  };

  const textVisible = phase === "text" && hiResReady;
  const lit = phase === "bright" || phase === "hold" || phase === "shrink";

  /* 文字行进出场动画（按块错峰入场，退场整组同步） */
  const lineAnim = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: textVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 },
    transition: textVisible
      ? { duration: 0.7, delay, ease: "easeOut" as const }
      : { duration: 0.5, ease: "easeIn" as const },
  });

  return (
    <motion.div
      className="fixed inset-0 z-50 cursor-pointer"
      data-intro="1"
      onPointerDown={skip}
      animate={phase === "skip" ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.26, ease: "easeOut" }}
    >
      {/* 黑幕：缩小归位时揭开 */}
      <motion.div
        className="absolute inset-0 bg-[#1B1916]"
        animate={{ opacity: phase === "shrink" ? 0 : 1 }}
        transition={{ duration: 0.9, delay: phase === "shrink" ? 0.15 : 0, ease: "easeInOut" }}
      />

      {/* 高清大油画：1147×1249 原图，解码就绪后直接显现，文字退场后亮起并缩小归位 */}
      <motion.img
        src={INTRO_PAINTING}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{ opacity: hiResReady || startAtShrink ? 1 : 0 }}
        initial={{ ...big, filter: startAtShrink ? INTRO_FILTER_LIT : INTRO_FILTER_DARK }}
        animate={
          phase === "shrink" && target
            ? {
                left: target.left,
                top: target.top,
                width: target.width,
                height: target.height,
                filter: INTRO_FILTER_LIT,
              }
            : { ...big, filter: lit ? INTRO_FILTER_LIT : INTRO_FILTER_DARK }
        }
        transition={
          phase === "shrink"
            ? { duration: 1.1, ease: [0.65, 0, 0.35, 1] }
            : { filter: { duration: 1.4, ease: "easeInOut" } }
        }
      />

      {/* 开场文字：主组作为一个居中排版块，手机竖屏下放大字号保证清晰可读 */}
      {!startAtShrink && (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 flex flex-col items-center text-center"
            style={{ top: "45.6vh", transform: "translateY(-50%)" }}
          >
            <motion.p
              className="font-look text-[#FFF1C2]"
              style={{
                fontSize: isMobileView() ? "15px" : "1.7vw",
                letterSpacing: "0.1em",
                lineHeight: 1.3,
                textShadow: INTRO_TEXT_SHADOW,
                position: "relative",
                top: isMobileView() ? "-6px" : "-0.7vw",
              }}
              {...lineAnim(0.08)}
            >
              {t("lab.intro.welcome")}
            </motion.p>
            <motion.p
              className="font-look text-[#FFF1C2]"
              style={{
                fontSize: isMobileView() ? "38px" : "5vw",
                lineHeight: 1.12,
                marginTop: isMobileView() ? "6px" : "0.7vw",
                textShadow: INTRO_TEXT_SHADOW,
                whiteSpace: "pre-line",
              }}
              {...lineAnim(0.2)}
            >
              {t("lab.intro.title")}
            </motion.p>
          </div>
          <motion.p
            className="pointer-events-none absolute inset-x-0 px-6 text-center font-hand text-[#FFF1C2]"
            style={{
              bottom: "10.3vh",
              fontSize: isMobileView() ? "14px" : "1.35vw",
              letterSpacing: "0.04em",
              lineHeight: 1.45,
              textShadow: INTRO_TEXT_SHADOW,
              whiteSpace: "pre-line",
            }}
            {...lineAnim(0.5)}
          >
            {t("lab.intro.desc")}
          </motion.p>
        </>
      )}
    </motion.div>
  );
}

/* ---------------- 页面 ---------------- */

export default function LabPage() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: scrollRef });

  /* 画廊是整页滚动，原生滚动条会露在右边；和 Life 一样把它藏掉（Lenis 照常工作） */
  useEffect(() => {
    document.documentElement.classList.add("scrollbar-hidden");
    return () => {
      document.documentElement.classList.remove("scrollbar-hidden");
    };
  }, []);

  /* 进场迈步：相机从稍后一点走到起点（0.9s），叠在滚动深度上 */
  const introZ = useMotionValue(-60);
  useEffect(() => {
    window.scrollTo(0, 0);
    const controls = animate(introZ, 0, { duration: 0.9, ease: "easeOut" });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 镜头微呼吸 + 鼠标视差：沿墙平移时完全静止，起步进走廊的路上渐入，走廊里全量；
     手机端关闭呼吸与手指视差，省去每帧整幅走廊重绘并防止手指滑动与视差抖动打架 */
  const bobY = useMotionValue(0);
  useEffect(() => {
    if (isMobileView() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const controls = animate(bobY, [0, -7, 0], {
      duration: 6.5,
      ease: "easeInOut",
      repeat: Infinity,
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const parallaxX = useSpring(0, { stiffness: 40, damping: 15 });
  const headGain = useTransform(scrollYProgress, [0.12, 0.22], [0, 1]);
  const headY = useTransform([bobY, headGain], (v: number[]) => v[0] * v[1]);
  const headX = useTransform([parallaxX, headGain], (v: number[]) => v[0] * v[1]);

  const [active, setActive] = useState(0);
  /* 从目录吊牌跳进来的，整页被拉上来已经是过场了，开场只放最后"缩小归位"那一段 */
  const fromMenu = (useLocation().state as { from?: string } | null)?.from === "menu";
  const [introPlaying, setIntroPlaying] = useState(true);
  /* 翻转卡片背面要用的图先取回来解码好（剪影遮罩、详情页的石墙），点开那一下才不会卡一帧；
     手机端只暖 HTTP 缓存，避免进画廊滑动时占用数十 MB 额外位图显存 */
  useEffect(() => {
    const urls = [
      ...STATION_CFG.map((c) => `/assets/lab/${c.mask}.png`),
      "/assets/lab/detail/bg-stone-wall.webp",
      "/assets/lab/detail/bg-stone-mark.webp",
      /* 尽头墙上的小场景（开门那张是碰到门才显示的，先拉好免得闪） */
      "/assets/lab/end-frame.webp",
      "/assets/lab/prop-thinker.webp",
      "/assets/life/seg03/lab-door.webp",
      "/assets/life/seg03/lab-door-open.webp",
    ];
    if (isMobileView()) {
      void warmBytes(urls, 4);
      return;
    }
    void loadImages(urls);
  }, []);
  /* 开场播完再在后台把详情页的画、纸、照片都拉好，点画框翻面时框里不会空一下 */
  useEffect(() => {
    if (introPlaying) return;
    const id = window.setTimeout(() => warmLabDetail(), 600);
    return () => window.clearTimeout(id);
  }, [introPlaying]);
  const [open, setOpen] = useState<{ project: LabProject; rect: DOMRect } | null>(null);
  const blockOpen = useRef(false);
  const openProject = (project: LabProject, rect: DOMRect) => {
    if (blockOpen.current || open) return;
    setOpen({ project, rect });
  };
  const closeProject = () => {
    blockOpen.current = true;
    setOpen(null);
    window.setTimeout(() => {
      blockOpen.current = false;
    }, 400);
  };

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    /* 按"停留位附近"判定当前站 */
    let idx = 0;
    BEATS.forEach((b, i) => {
      if (p >= b.d - 0.05) idx = i + 1;
    });
    setActive((prev) => (prev === idx ? prev : idx));
    const nextCorridor = p >= CORRIDOR_Q;
    setInCorridor((prev) => (prev === nextCorridor ? prev : nextCorridor));
  });
  /* 沿墙平移快到走廊轴、满屏都是奶油黄之后，顶栏换黑字 */
  const [inCorridor, setInCorridor] = useState(false);
  useReportDarkNav(!introPlaying && inCorridor);

  /* 走进走廊尽头的门回首页：复刻 Life 页进 Lab 门的同款镜头推进 + 暖光漫满过渡 */
  const navigate = useNavigate();
  const lenis = useLenis();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const zoomControls = useAnimationControls();
  const [homeEntry, setHomeEntry] = useState<{ cx: number; cy: number } | null>(null);
  const homeGoTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(homeGoTimer.current), []);
  /* 手机视图下支持左右划动/拖拽推进画廊走廊（电脑端不生效） */
  useMobileHorizontalDrag(!introPlaying && !open && !homeEntry);

  const enterHomeDoor = (r: DOMRect) => {
    if (open || homeEntry) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    /* 走廊尽头这扇门带 scaleX(-1) 镜像（往右开），开门后黄色门洞在门框热区靠右（约 0.9 宽处） */
    const cx = r.left + r.width * 0.9;
    const cy = r.top + r.height * 0.5;
    const wr = wrap.getBoundingClientRect();
    setZoomOrigin(`${cx - wr.left}px ${cy - wr.top}px`);
    document.documentElement.style.overflow = "hidden";
    lenis?.stop();
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    sessionStorage.setItem("heroIntroPlayed", "1");
    setHomeEntry({ cx: cx - wr.left, cy: cy - wr.top });
    void zoomControls.start({
      scale: 3,
      x: wr.left + wr.width / 2 - cx,
      y: wr.top + wr.height / 2 - cy,
      transition: { duration: 1.15, ease: [0.55, 0, 0.68, 0.4] },
    });
    homeGoTimer.current = window.setTimeout(() => {
      document.documentElement.style.overflow = "";
      lenis?.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
      lenis?.start();
      playNavigate();
      navigate("/", { state: { from: "lab-door" } });
    }, 1300);
  };

  return (
    <div
      ref={scrollRef}
      className="relative"
      data-lab-open={open ? open.project.id : ""}
      style={{ height: `calc(${SCROLL_LEN}px + 100vh)` }}
    >
      <div
        className="sticky top-0 h-screen overflow-hidden"
        style={{ background: "#FEF0C1" }}
        onPointerMove={(e) => {
          if (!homeEntry && !isMobileView()) parallaxX.set((e.clientX / window.innerWidth - 0.5) * -14);
        }}
        onPointerLeave={() => parallaxX.set(0)}
      >
        <motion.div
          ref={wrapRef}
          className="absolute inset-0"
          animate={zoomControls}
          style={{ transformOrigin: zoomOrigin }}
        >
          {/* 假透视走廊（含入口墙）；外层套呼吸/视差偏移 */}
          <motion.div className="absolute inset-0" style={{ x: headX, y: headY }}>
            <FakeCorridor
              q={scrollYProgress}
              introZ={introZ}
              active={active}
              paintingHidden={introPlaying}
              openId={open ? open.project.id : null}
              onOpen={openProject}
              onEnterDoor={enterHomeDoor}
            />
          </motion.div>
        </motion.div>

        {/* 走门回首页：门后的暖光从门洞漫满全屏，盖住切页瞬间 */}
        {homeEntry && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50"
            style={{
              background: `radial-gradient(circle at ${homeEntry.cx}px ${homeEntry.cy}px, #FFE9B8 0%, #FBE3AC 55%, #F2EDE3 100%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.65, ease: "easeIn" }}
          />
        )}

        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {Array.from({ length: N + 1 }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full border border-white/50 transition ${
                i === active ? "bg-[#FFF6E4]" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      </div>

      {introPlaying && <LabIntro onDone={() => setIntroPlaying(false)} startAtShrink={fromMenu} />}

      {open && (
        <FlipDetail
          key={open.project.id}
          index={labProjects.findIndex((p) => p.id === open.project.id)}
          rect={open.rect}
          onClosed={closeProject}
        />
      )}
    </div>
  );
}
