import { useEffect, useMemo, useRef, useState } from "react";
import {
  playDoorSlide,
  playLightOff,
  playLightOn,
  playMailboxClose,
  playMailboxOpen,
  playNavigate,
  startAmbient,
  stopAmbient,
} from "../audio/sfx";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
  type TargetAndTransition,
} from "framer-motion";
import { useTimeOfDay, type TimePhase } from "../timeOfDay";
import { heroHotspots } from "../data/heroHotspots";
import { config } from "../config";
import {
  INTRO_DISMISSED_EVENT,
  INTRO_PREVIEW_PATH,
  INTRO_REPLAY_EVENT,
  INTRO_SESSION_KEY,
} from "../state/intro";
import HeroCurtain, { CURTAIN_SLIDE_T } from "./HeroCurtain";
import IdentityCard from "./IdentityCard";
import { warmLife } from "./life/preload";
import { useLanguage } from "../i18n/LanguageContext";
import type { DictKey } from "../i18n/dict";

/** 原图画板尺寸（Figma 1440 x 900），所有定位按它换算成百分比 */
const FRAME_W = 1440;
const FRAME_H = 900;
const HERO_RATIO = FRAME_W / FRAME_H;

/**
 * 四个时段的"零素材"换景：只换天空渐变、整体盖一层 multiply 调色、
 * 该亮的灯默认亮起来、夜里加星星月亮。白天 = 原设计稿。
 */
const TIME_THEMES: Record<
  TimePhase,
  {
    /** 天空渐变（原稿是 #0E8DD9 → #BFEFFD 117%） */
    sky: string;
    /** 调色层颜色 + 透明度（multiply 叠在整个场景上） */
    tint: string;
    tintAlpha: number;
    /** 吊灯和门玻璃默认亮着 */
    lights: boolean;
    /** 星星 + 月亮 */
    stars: boolean;
  }
> = {
  dawn: {
    sky: "linear-gradient(to bottom, #7C8EC9 0%, #F4C6A2 68%, #FFE6BE 117%)",
    tint: "#F3B58F",
    tintAlpha: 0.16,
    lights: false,
    stars: false,
  },
  day: {
    sky: "linear-gradient(to bottom, #0E8DD9, #BFEFFD 117%)",
    tint: "#000000",
    tintAlpha: 0,
    lights: false,
    stars: false,
  },
  dusk: {
    sky: "linear-gradient(to bottom, #45489A 0%, #C77A8C 52%, #F8B46C 117%)",
    tint: "#E48A5E",
    tintAlpha: 0.28,
    lights: true,
    stars: false,
  },
  night: {
    sky: "linear-gradient(to bottom, #0A1030 0%, #1B2A5E 68%, #34508A 117%)",
    tint: "#3A4B8E",
    tintAlpha: 0.58,
    lights: true,
    stars: true,
  },
};
/** 换景的过渡时长（秒）：天空交叉淡化、调色层、灯光都用它 */
const TIME_FADE = 1.6;

/** 夜空里的星星：固定的伪随机布点（只落在画面上半部，避开建筑） */
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    left: r(1) * 100,
    top: 2 + r(2) * 40,
    size: 1.5 + r(3) * 2,
    dur: 2.2 + r(4) * 3,
    delay: r(5) * 4,
  };
});

const px = (x: number) => `${(x / FRAME_W) * 100}%`;
const py = (y: number) => `${(y / FRAME_H) * 100}%`;

/**
 * 分层素材的位置（来自 Figma 各图层的渲染边界，单位为画板像素）。
 * 若在 Figma 里挪动了元素，重新导出对应 PNG 并更新这里的数值。
 */
const SPRITES = {
  // 新云图（1024x461，比旧图更扁）：y 按"云底贴原落地线 819"折算
  cloudBig: { src: "/assets/hero-cloud-big.png", x: 0, y: 151.5, w: 1440 },
  base: { src: "/assets/hero-base.png" },
  openSign: { src: "/assets/hero-open-sign.png", x: 611.8, y: 554.9, w: 98.8 },
  /**
   * 小羊：透明动画 WebP（由手绘视频抠底合成，自带待机动作循环）。
   * 画布比原静态图（341x543 @ x828.2 y588 w170.2）四周略大，坐标已折算。
   * 脚下影子是独立静态层（与原静态图同画布），叠在身体下面。
   */
  sheep: { src: "/assets/hero-sheep-idle.webp", x: 825.2, y: 587, w: 176.2 },
  sheepShadow: {
    src: "/assets/hero-sheep-shadow.png",
    x: 828.2,
    y: 588,
    w: 170.2,
  },
  /**
   * 邮箱拆成两个部件：杆完全静止，邮筒头悬停时开盖 + 微小弹开。
   * 位置由旧整体图（x1157.6 y587.7 w116 h225）的像素分析推得：
   * 杆在整体图中 x+34、宽 43、底对齐；开盖帧与闭合帧右上角对齐。
   */
  mailbox: {
    headClosed: "/assets/hero-mailbox-head-closed.png",
    headOpen: "/assets/hero-mailbox-head-open.png",
    post: "/assets/hero-mailbox-post.png",
    headX: 1157.6,
    headY: 587.7,
    headW: 116,
    headOpenW: 130.5,
    postX: 1191.6,
    postY: 706.7,
    postW: 43,
  },
  /**
   * WOOLAB 吊灯 + 字：关灯/开灯两帧（底图中的吊灯和字已抠掉）。
   * 两帧按灯罩位置对齐：关灯帧左缘即原招牌左缘，
   * 开灯帧因光锥向两侧展开而更宽，需向左偏移。
   */
  woolab: {
    off: { src: "/assets/hero-woolab-off.png", x: 620.8, y: 358.6, w: 198.5 },
    on: { src: "/assets/hero-woolab-on.png", x: 523.3, y: 358.6, w: 394.5 },
  },
  /** 大门玻璃的亮灯帧：悬停玻璃门时屋内亮起暖黄灯光 */
  doorLit: { src: "/assets/hero-door-lit.png", x: 622.6, y: 544.7, w: 200.7 },
  /**
   * 开门动画三件套（点击大门时才挂载）：
   * open  = 门框 + 屋内暖光的底图，先盖住底图里画死的关门状态；
   * left/right = 两扇门板，在裁剪框里向两侧滑开，像滑进墙里。
   */
  doorOpen: {
    back: { src: "/assets/hero-door-open.png", x: 585.7, y: 512.7, w: 275.7 },
    left: { src: "/assets/hero-door-left.png" },
    right: { src: "/assets/hero-door-right.png" },
    /** 两扇门板的整体渲染范围（也是滑动的裁剪框），单扇宽 124.7 */
    panels: { x: 601.6, y: 527.7, w: 242.7, h: 252.7, single: 124.7 },
  },
  board: { src: "/assets/hero-board.png", x: 158.3, y: 693.2, w: 159.4 },
  bush: { src: "/assets/hero-bush.png", x: 1116, y: 763.9, w: 98.2 },
  /** 左右两丛灌木（已从底图抠出，风吹时轻轻摇摆） */
  bushLeft: { src: "/assets/hero-bush-left.png", x: 49.9, y: 726.7, w: 232.7 },
  bushRight: {
    src: "/assets/hero-bush-right.png",
    x: 1119.1,
    y: 695.8,
    w: 255.1,
  },
} as const;

/**
 * 小鸟扇翅三帧（同一画布尺寸 228x192，已对齐，直接轮播）。
 * 播放顺序：上 → 中 → 下 → 中，循环。
 */
const BIRD_FLAP_FRAMES = [
  "/assets/hero-bird-up.png",
  "/assets/hero-bird-mid.png",
  "/assets/hero-bird-down.png",
] as const;
const BIRD_FLAP_SEQ = [0, 1, 2, 1] as const;
/** 每帧停留时长（毫秒），约 7 帧/秒的卡通扇翅节奏 */
const BIRD_FLAP_MS = 140;
/** 扇翅帧 1 倍尺寸：114x96；站立帧：119x91（画板像素） */
const BIRD_FLAP_SIZE = { w: 114, h: 96 };
const BIRD_STAND = { src: "/assets/hero-bird-stand.png", w: 119, h: 91 };

/** 小鸟容器（画板像素），所有姿态在容器内底部居中对齐 */
const BIRD_BOX = { w: 120, h: 97 };

/** 首页第一屏要先下好的图（开场加载页拿这份清单等它们全部解码完，滑开时首页已经是完整的） */
export const HERO_PRELOAD: string[] = [
  SPRITES.cloudBig.src,
  SPRITES.base.src,
  SPRITES.openSign.src,
  SPRITES.sheep.src,
  SPRITES.sheepShadow.src,
  SPRITES.mailbox.headClosed,
  SPRITES.mailbox.post,
  SPRITES.woolab.off.src,
  SPRITES.woolab.on.src,
  SPRITES.board.src,
  SPRITES.bush.src,
  SPRITES.bushLeft.src,
  SPRITES.bushRight.src,
  ...BIRD_FLAP_FRAMES,
  BIRD_STAND.src,
];

/** 降落点：屋顶栏杆横杆（顶边 y≈300），花箱左侧的空档（x≈860） */
const PERCH = {
  left: `${((860 - BIRD_BOX.w / 2) / FRAME_W) * 100}%`,
  top: `${((304 - BIRD_BOX.h) / FRAME_H) * 100}%`,
};

/** 悬停时每个热区元素"轻轻活起来"的小动作 */
const HOVER_MOTION: Record<string, TargetAndTransition> = {
  // sheep（小羊）不加悬停动效，本体 WebP 自带待机动作，悬停时冒招呼气泡
  // about（WOOLAB 吊灯）不走通用微动效，悬停时开灯，见 WoolabSprite
  lab: {
    // 小黑板晃一下
    rotate: [0, -3, 2, -1, 0],
    transition: { duration: 0.8, ease: "easeInOut" },
  },
  // contact（邮箱）不走通用微动效，悬停时直接切换成打开状态，见 MailboxSprite
};

/** 悬停小羊时随机冒出的招呼语 */
const SHEEP_GREETS: DictKey[] = [
  "sheep.greet.1",
  "sheep.greet.2",
  "sheep.greet.3",
];

/** OPEN 吊牌的摆动（进场时播一次，悬停玻璃门时再播一次） */
const SIGN_SWING: TargetAndTransition = {
  rotate: [0, -7, 5, -2.5, 1, 0],
  transition: { duration: 2.4, ease: "easeInOut" },
};

/** 推镜头的焦点 = 门洞中心（占画板的百分比），也是缩放的不动点 */
const DOOR_FOCUS = {
  x: `${(723.5 / FRAME_W) * 100}%`,
  y: `${(654 / FRAME_H) * 100}%`,
};
/** 门板滑开的运动曲线：先缓起、匀速滑、末端轻收 */
const DOOR_SLIDE_EASE = [0.45, 0, 0.55, 1] as const;
const DOOR_SLIDE_DURATION = 0.55;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * 首次进场的出场动画：底图浮现后，场景物件按顺序逐个"啵"地
 * 弹出来（弹簧过冲），像把画面一件件摆上去。每个物件的弹出
 * 时刻（秒）；整段约 2 秒，播完后 OPEN 吊牌接着晃第一下。
 */
const INTRO_AT = {
  bushLeft: 0.55,
  bushRight: 0.65,
  bush: 0.75,
  board: 0.9,
  mailbox: 1.05,
  sheep: 1.25,
  woolab: 1.45,
  openSign: 1.6,
} as const;

/**
 * 出场弹出的包装层：铺满整个画布，以物件自己的落点为缩放
 * 原点从 0 弹到 1。go 之前藏着不动（等品牌开屏淡出）；
 * 不播时（非首次/减少动效）直接呈现终态。
 */
function IntroPop({
  play,
  go,
  delay,
  origin,
  zIndex,
  children,
}: {
  play: boolean;
  go: boolean;
  delay: number;
  /** 缩放原点（画布百分比坐标）：落地物用根部，吊挂物用挂点 */
  origin: string;
  /** 开场蓝布盖着时把小羊抬到布上面 */
  zIndex?: number;
  children: React.ReactNode;
}) {
  const waiting = play && !go;
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{ transformOrigin: origin, zIndex }}
      initial={play ? { scale: 0, opacity: 0 } : false}
      animate={waiting ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
      transition={
        waiting
          ? { duration: 0 }
          : {
              delay,
              type: "spring",
              stiffness: 300,
              damping: 15,
              mass: 0.9,
              opacity: { delay, duration: 0.15 },
            }
      }
    >
      {children}
    </motion.div>
  );
}

/** 小鸟站立时的中心点（占画板的比例），用于计算鼠标是否靠近 */
const PERCH_CENTER = { x: 860 / FRAME_W, y: (304 - BIRD_BOX.h / 2) / FRAME_H };
/** 惊飞触发半径：占画板宽度的比例（约 110px @1440） */
const STARTLE_RADIUS = 0.077;

/** 把"multiply 混一层 alpha=a 的颜色 hex"换成等价的 feColorMatrix：每通道乘 (1 - a + a·C) */
function tintMatrix(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  const k = (c: number) => (1 - a + (a * c) / 255).toFixed(4);
  const r = k((n >> 16) & 255);
  const g = k((n >> 8) & 255);
  const b = k(n & 255);
  return `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`;
}

/**
 * 开场蓝布盖着时小鸟的来回：右端在小羊头顶上方（小羊头顶中心 x≈913 y≈587），
 * 左端在画面左边约半屏处、稍高；每半程 2.6s，图下完后飞去栏杆 1.4s
 */
const INTRO_BIRD = {
  right: {
    left: `${((913 - BIRD_BOX.w / 2) / FRAME_W) * 100}%`,
    top: `${((587 - BIRD_BOX.h - 18) / FRAME_H) * 100}%`,
  },
  left: { left: "14%", top: "30%" },
  midTop: "44%",
  half: 2.6,
  toPerch: 1.4,
};

/** 随风飘过的叶子素材 */
const LEAF_IMGS = [
  "/assets/hero-leaf-1.png",
  "/assets/hero-leaf-2.png",
  "/assets/hero-leaf-3.png",
] as const;

export default function HeroScene() {
  // 场景环境背景音（白天/夜晚两条），离开首页时淡出
  const { phase } = useTimeOfDay();
  useEffect(() => {
    startAmbient(phase === "night" ? "night" : "day");
  }, [phase]);
  useEffect(() => () => stopAmbient(), []);

  return (
    <>
      {/* 桌面端：全屏场景 */}
      <div className="hidden h-full md:block">
        <SceneCanvas cover />
      </div>

      {/* 移动端：完整插画 + 列表导航 */}
      <div className="flex h-full flex-col md:hidden">
        <SceneCanvas cover={false} />
        <HotspotList />
      </div>
    </>
  );
}

function SceneCanvas({ cover }: { cover: boolean }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const { phase } = useTimeOfDay();
  const theme = TIME_THEMES[phase];
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /*
   * 开场加载页就是压在这个场景里的一块蓝布（HeroCurtain），小羊和小鸟被抬到布上面：
   * 加载期间小羊原地待机、小鸟在它头顶到画面中间来回飞；图下完了小鸟飞去屋顶栏杆落下，
   * 小羊朝那边探一下身，布随即整块向上拉走——房子是"露出来"的，小羊小鸟一直都在。
   * 只在桌面端整屏场景（cover）里做；/intro 预览路由不看会话标记、可反复播。
   */
  const { pathname } = useLocation();
  const introPreview = pathname === INTRO_PREVIEW_PATH;
  const [curtainRun, setCurtainRun] = useState(0);
  const [curtainUp, setCurtainUp] = useState(
    () =>
      cover &&
      (introPreview ||
        (config.introEnabled && !sessionStorage.getItem(INTRO_SESSION_KEY))),
  );
  const [curtainSlide, setCurtainSlide] = useState(false);
  const curtainUpRef = useRef(curtainUp);
  curtainUpRef.current = curtainUp;
  /** 图下完了（小鸟状态机据此收尾） */
  const curtainLoadedRef = useRef(false);
  const onCurtainDone = () => {
    setCurtainUp(false);
    setCurtainSlide(false);
  };
  /* 布盖着期间给小羊单独补的时段染色（见小羊那层的注释）；白天 alpha 为 0 不挂 */
  const sheepTintId = `hero-sheep-tint-${cover ? "d" : "m"}`;
  const sheepTint =
    curtainUp && theme.tintAlpha > 0 ? `url(#${sheepTintId})` : undefined;
  /* 首页站稳后顺手把 Life 页第一屏的图拉进缓存：推门进屋基本不用等 */
  useEffect(() => {
    if (!curtainUp) warmLife(2500);
  }, [curtainUp]);
  /* 预览入口的 REPLAY：重新盖上布、状态机重跑 */
  useEffect(() => {
    if (!introPreview || !cover) return;
    const replay = () => {
      curtainLoadedRef.current = false;
      setCurtainSlide(false);
      setCurtainUp(true);
      setCurtainRun((n) => n + 1);
    };
    window.addEventListener(INTRO_REPLAY_EVENT, replay);
    return () => window.removeEventListener(INTRO_REPLAY_EVENT, replay);
  }, [introPreview, cover]);

  // 品牌开屏还盖在上面时先按兵不动；开屏滑开的瞬间常驻小动作（吊牌晃、小鸟飞过）才开始
  const [introGo, setIntroGo] = useState(
    () => !config.introEnabled || !!sessionStorage.getItem(INTRO_SESSION_KEY),
  );
  // 首次进入主页（本次会话内）才播"物件依次弹出"的出场动画，之后进来直接呈现完整场景。
  // 有品牌开屏的那一次不弹：开屏滑开时底下要的是一张已经完整的首页，不是再弹一遍。
  const [intro] = useState(
    () =>
      !reducedMotion &&
      introGo &&
      !curtainUp &&
      !sessionStorage.getItem("heroIntroPlayed"),
  );
  useEffect(() => {
    sessionStorage.setItem("heroIntroPlayed", "1");
  }, []);
  useEffect(() => {
    if (introGo) return;
    const onDismiss = () => setIntroGo(true);
    window.addEventListener(INTRO_DISMISSED_EVENT, onDismiss);
    return () => window.removeEventListener(INTRO_DISMISSED_EVENT, onDismiss);
  }, [introGo]);

  const signControls = useAnimationControls();
  const birdControls = useAnimationControls();
  const zoomControls = useAnimationControls();
  /** 点击大门后的"开门 → 推镜头 → 进屋"过场 */
  const [entering, setEntering] = useState(false);
  const enteringRef = useRef(false);
  /** 小羊身份卡 */
  const [cardOpen, setCardOpen] = useState(false);
  /** 悬停小羊时的招呼语（每次进入热区随机换一句） */
  const [greetKey, setGreetKey] = useState<DictKey>(SHEEP_GREETS[0]);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // 场景里有画面外待命的元素（小鸟停在 106%、叶子飞出画面），
  // 它们让 overflow-hidden 容器产生了可滚动区域；浏览器在聚焦热区、
  // 推镜头缩放时会悄悄滚动容器把画面带偏——把滚动位置常驻钉死在原点。
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pin = () => {
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
    };
    pin();
    stage.addEventListener("scroll", pin);
    return () => stage.removeEventListener("scroll", pin);
  }, []);
  const [birdFlapIdx, setBirdFlapIdx] = useState(0);
  const [birdStanding, setBirdStanding] = useState(false);
  /** 素材朝左；开场来回飞往右那半程水平翻过来 */
  const [birdFacingRight, setBirdFacingRight] = useState(false);
  /** 鼠标靠近栏杆上的小鸟时置位，由状态机消费（用 ref 避免闭包读到旧值） */
  const birdStartledRef = useRef(false);
  const birdStandingRef = useRef(false);

  // 进场：OPEN 吊牌轻晃一两下后停（有出场动画时等吊牌弹出落定再晃）
  useEffect(() => {
    if (reducedMotion) return;
    if (intro && !introGo) return;
    const timer = setTimeout(
      () => signControls.start(SIGN_SWING),
      intro ? 2400 : 1200,
    );
    return () => clearTimeout(timer);
  }, [reducedMotion, signControls, intro, introGo]);

  // 小鸟：不定期从右往左飞过，飞行途中扇翅膀 + 轻微起伏
  useEffect(() => {
    if (reducedMotion) return;
    let alive = true;
    let flapTimer: ReturnType<typeof setInterval> | undefined;

    const startFlap = () => {
      let i = 0;
      flapTimer = setInterval(() => {
        i = (i + 1) % BIRD_FLAP_SEQ.length;
        setBirdFlapIdx(BIRD_FLAP_SEQ[i]);
      }, BIRD_FLAP_MS);
    };
    const stopFlap = () => clearInterval(flapTimer);

    /** 已经落到栏杆上：收翅站定 → 歇一会（鼠标靠近会惊飞）→ 起飞、往左飞出画面 */
    const perchAndLeave = async () => {
      // 收翅站定（落地顺势转回朝左，和平时停在栏杆上一个方向），轻轻下沉一下作落地缓冲
      stopFlap();
      setBirdFacingRight(false);
      setBirdStanding(true);
      birdStartledRef.current = false;
      birdStandingRef.current = true;
      await birdControls.start({
        y: [-3, 1, 0],
        transition: { duration: 0.35, ease: "easeOut" },
      });
      if (!alive) return;

      // 站着歇一会（轻微起伏持续播放）；鼠标靠近会提前惊飞
      birdControls.start({
        y: [0, -2, 0],
        transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
      });
      const stayUntil = Date.now() + rand(4000, 9000);
      while (alive && Date.now() < stayUntil && !birdStartledRef.current) {
        await sleep(120);
      }
      // 这轮已经被收掉（预览重播）就别再碰控制器，不然会把新一轮刚起的动画停掉
      if (!alive) return;
      birdControls.stop();
      const startled = birdStartledRef.current;
      birdStandingRef.current = false;

      // 起飞：展翅向上一蹬，扇着翅膀飞走（被惊飞时更急）
      setBirdStanding(false);
      startFlap();
      await birdControls.start({
        y: [0, startled ? -20 : -14],
        transition: { duration: startled ? 0.22 : 0.3, ease: "easeOut" },
      });
      if (!alive) return;
      await birdControls.start({
        left: [PERCH.left, "-40%"],
        top: [PERCH.top, `${rand(6, 11)}%`],
        y: 0,
        transition: {
          duration: startled ? 2.6 : 4.2,
          ease: startled ? "easeOut" : "easeIn",
        },
      });
    };

    (async () => {
      /* ---- 开场蓝布盖着：小鸟在小羊头顶和画面中间之间来回飞，等图下完 ---- */
      if (curtainUpRef.current) {
        // 预览重播时上一轮可能还站在栏杆上（无限起伏的动画没停），先停掉再摆位
        birdControls.stop();
        setBirdStanding(false);
        birdStandingRef.current = false;
        birdControls.set({
          left: INTRO_BIRD.right.left,
          top: INTRO_BIRD.right.top,
          opacity: 1,
          y: 0,
        });
        startFlap();
        let atLeft = false;
        while (alive && !curtainLoadedRef.current) {
          // 往左飞（素材本来朝左）
          setBirdFacingRight(false);
          atLeft = true;
          await birdControls.start({
            left: [INTRO_BIRD.right.left, INTRO_BIRD.left.left],
            top: [INTRO_BIRD.right.top, INTRO_BIRD.midTop, INTRO_BIRD.left.top],
            transition: { duration: INTRO_BIRD.half, ease: "easeInOut" },
          });
          if (!alive || curtainLoadedRef.current) break;
          // 掉头往右飞回小羊头顶
          setBirdFacingRight(true);
          atLeft = false;
          await birdControls.start({
            left: [INTRO_BIRD.left.left, INTRO_BIRD.right.left],
            top: [INTRO_BIRD.left.top, INTRO_BIRD.midTop, INTRO_BIRD.right.top],
            transition: { duration: INTRO_BIRD.half, ease: "easeInOut" },
          });
        }
        if (!alive) return;

        // 图下完了：飞去屋顶栏杆；布在小鸟快落下时开拉，栏杆刚好在它脚下露出来
        setBirdFacingRight(atLeft);
        const toPerch = birdControls.start({
          left: PERCH.left,
          top: PERCH.top,
          transition: { duration: INTRO_BIRD.toPerch, ease: "easeInOut" },
        });
        await sleep((INTRO_BIRD.toPerch - CURTAIN_SLIDE_T * 0.75) * 1000);
        if (!alive) return;
        setCurtainSlide(true);
        await toPerch;
        if (!alive) return;
        await perchAndLeave();
        if (!alive) return;
        stopFlap();
        birdControls.set({ opacity: 0 });
      }

      while (alive) {
        await sleep(rand(4000, 12000));
        if (!alive) break;
        // 夜里小鸟不出来
        if (phaseRef.current === "night") continue;

        // 起降点放在 ±35% 场景宽度之外：宽屏两侧的延伸区也看不到"凭空出现"
        const cruiseTop = rand(9, 19);
        setBirdFacingRight(false);
        setBirdStanding(false);
        birdStandingRef.current = false;
        birdControls.set({
          left: "135%",
          top: `${cruiseTop}%`,
          opacity: 1,
          y: 0,
        });
        startFlap();

        if (Math.random() < 0.5) {
          // 飞到房顶中间（带节奏起伏），落在栏杆上歇一会
          await birdControls.start({
            left: ["135%", "72%"],
            top: [
              `${cruiseTop}%`,
              `${cruiseTop - 2}%`,
              `${cruiseTop + 1.5}%`,
              "24%",
            ],
            transition: { duration: 2.6, ease: "easeOut" },
          });
          if (!alive) break;

          // 边扇翅膀边缓缓降到栏杆上
          await birdControls.start({
            left: ["72%", PERCH.left],
            top: ["24%", PERCH.top],
            transition: { duration: 1.1, ease: "easeOut" },
          });
          if (!alive) break;

          await perchAndLeave();
          if (!alive) break;
        } else {
          // 直接横穿画面：带扇翅节奏的波浪路线
          const c = cruiseTop;
          await birdControls.start({
            left: ["135%", "-40%"],
            top: [
              `${c}%`,
              `${c - 2.2}%`,
              `${c + 1.6}%`,
              `${c - 2.4}%`,
              `${c + 1.2}%`,
              `${c - 1.8}%`,
              `${c + rand(-1, 2)}%`,
            ],
            transition: { duration: rand(6.5, 9), ease: "linear" },
          });
        }
        stopFlap();
        birdControls.set({ opacity: 0 });
      }
    })();

    return () => {
      alive = false;
      stopFlap();
      birdControls.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, birdControls, curtainRun]);

  // 悬停玻璃门时，OPEN 吊牌再晃一次
  useEffect(() => {
    if (hovered === "life" && !reducedMotion) signControls.start(SIGN_SWING);
  }, [hovered, reducedMotion, signControls]);

  /**
   * 点击大门：门板向两侧滑开露出屋内暖光，
   * 镜头随即推进门里，画面被暖光填满后进入「小羊的生活」。
   */
  const enterLife = async () => {
    if (enteringRef.current) return;
    enteringRef.current = true;

    if (reducedMotion) {
      playNavigate();
      navigate("/life");
      return;
    }

    setEntering(true);
    setHovered(null);
    // 收回热区上的焦点，避免浏览器在缩放时自动滚动容器去追焦点元素
    (document.activeElement as HTMLElement | null)?.blur?.();
    playDoorSlide();

    // 独立的 OPEN 吊牌立即隐藏，由门板裁剪容器里的副本接替（跟左门板一起滑走）
    signControls.stop();

    // 等门开到大半，再起镜头往门里推
    await sleep(380);
    playNavigate();
    // 6.5 倍时门洞（画板宽 236px）正好铺满整个视口
    await zoomControls.start({
      scale: 6.5,
      transition: { duration: 0.95, ease: [0.55, 0.05, 0.75, 0.5] },
    });
    navigate("/life");
  };

  /** 悬停进入/离开热区：更新状态 + 对应音效 */
  const enterHotspot = (id: string) => {
    /* 开门过场中、开场蓝布还盖着时都不响应（布是 pointer-events-none，鼠标能穿到底下的热区） */
    if (enteringRef.current || curtainUpRef.current) return;
    setHovered(id);
    // about = WOOLAB 吊灯开灯；life = 大门玻璃亮灯
    if (id === "about" || id === "life") playLightOn();
    else if (id === "contact") playMailboxOpen();
    else if (id === "sheep")
      setGreetKey(
        SHEEP_GREETS[Math.floor(Math.random() * SHEEP_GREETS.length)],
      );
  };
  const leaveHotspot = (id: string) => {
    setHovered(null);
    if (id === "about" || id === "life") playLightOff();
    else if (id === "contact") playMailboxClose();
  };

  /** 点击/回车激活热区：小羊弹身份卡，大门走开门过场，其余直接跳转 */
  const activateHotspot = (id: string, path: string) => {
    if (enteringRef.current || curtainUpRef.current) return;
    if (id === "sheep") {
      if (!config.identityCardEnabled) return;
      playMailboxOpen();
      setCardOpen(true);
      return;
    }
    if (id === "life") {
      void enterLife();
      return;
    }
    playNavigate();
    navigate(path);
  };

  /** 树丛的摇摆：以根部为轴小幅左右摆 + 极轻微的横向压缩，像被风拂过 */
  const bushSway = (amp: number, duration: number, delay: number) =>
    reducedMotion
      ? undefined
      : {
          rotate: [0, amp, 0, -amp * 0.6, 0],
          scaleX: [1, 1.006, 1, 0.996, 1],
          transition: {
            duration,
            repeat: Infinity,
            ease: "easeInOut" as const,
            delay,
          },
        };

  /** 云的漂移：水平缓慢往复 + 极轻微的上下浮动 */
  const drift = (amount: number, duration: number) =>
    reducedMotion
      ? undefined
      : {
          x: [0, amount, 0, -amount, 0],
          y: [0, -amount * 0.3, 0, amount * 0.3, 0],
          transition: {
            duration,
            repeat: Infinity,
            ease: "easeInOut" as const,
          },
        };

  return (
    <div
      ref={stageRef}
      className={`relative overflow-hidden ${
        // 屏幕比画板（16:10）更扁时画面会超出高度：贴底对齐，
        // 只裁天空，保证地面和场景物件完整
        cover ? "flex h-full items-end justify-center" : ""
      }`}
      style={{ background: theme.sky }}
    >
      {/* 天空：按时段换渐变，新旧两层交叉淡化（渐变本身没法过渡） */}
      <AnimatePresence initial={false}>
        <motion.div
          key={phase}
          className="pointer-events-none absolute inset-0"
          style={{ background: theme.sky }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: TIME_FADE, ease: "easeInOut" }}
        >
          {theme.stars && <NightSky reducedMotion={!!reducedMotion} />}
        </motion.div>
      </AnimatePresence>

      {/* 开场蓝布：盖在场景上、小羊小鸟底下（它俩 z 30）；拉走后卸掉 */}
      {curtainUp && (
        <HeroCurtain
          key={curtainRun}
          preload={HERO_PRELOAD}
          preview={introPreview}
          slide={curtainSlide}
          onLoaded={() => {
            curtainLoadedRef.current = true;
            // 减少动效时没有小鸟那段收尾，直接拉
            if (reducedMotion) setCurtainSlide(true);
          }}
          onDone={onCurtainDone}
        />
      )}

      {/* 场景本体：按视口高度完整显示（上下不裁）；
          屏幕比画板（16:10）宽时，两侧由边缘延伸条补满，
          比画板窄时左右对称裁切。进门时整体向门洞推近 */}
      <motion.div
        className="relative shrink-0"
        animate={zoomControls}
        style={{
          transformOrigin: `${DOOR_FOCUS.x} ${DOOR_FOCUS.y}`,
          willChange: entering ? "transform" : undefined,
          ...(cover
            ? {
                aspectRatio: `${HERO_RATIO}`,
                width: `calc(100vh * ${HERO_RATIO})`,
              }
            : { aspectRatio: `${HERO_RATIO}`, width: "100%" }),
        }}
        onMouseMove={(e) => {
          // 鼠标靠近栏杆上的小鸟 → 惊飞
          if (!birdStandingRef.current || birdStartledRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const dx = (e.clientX - rect.left) / rect.width - PERCH_CENTER.x;
          const dy = (e.clientY - rect.top) / rect.height - PERCH_CENTER.y;
          // dy 按画板宽高比折算，让触发范围是圆形而不是被拉扁的椭圆
          const dist = Math.hypot(dx, dy / HERO_RATIO);
          if (dist < STARTLE_RADIUS) birdStartledRef.current = true;
        }}
      >
        {/* 云层（在建筑后面缓慢漂移）：出场时缓缓淡入 */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={intro ? { opacity: 0 } : false}
          animate={{ opacity: intro && !introGo ? 0 : 1 }}
          transition={
            intro && !introGo
              ? { duration: 0 }
              : { delay: 0.3, duration: 0.9, ease: "easeOut" }
          }
        >
          <motion.img
            src={SPRITES.cloudBig.src}
            alt=""
            className="pointer-events-none absolute select-none"
            style={{
              left: "-1.5%",
              top: py(SPRITES.cloudBig.y),
              width: "103%",
              maxWidth: "none",
            }}
            animate={drift(16, 46)}
            draggable={false}
          />
        </motion.div>

        {/* 建筑与地面（静止底图，不含树丛）；两侧接边缘延伸条补满宽屏。
            出场时从下方轻轻浮现，随后各物件依次弹出 */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={intro ? { opacity: 0, y: "3%" } : false}
          animate={
            intro && !introGo
              ? { opacity: 0, y: "3%" }
              : { opacity: 1, y: "0%" }
          }
          transition={
            intro && !introGo
              ? { duration: 0 }
              : { duration: 0.55, ease: [0.33, 1, 0.68, 1] }
          }
        >
          <img
            src={SPRITES.base.src}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
            draggable={false}
          />
          <img
            src="/assets/hero-base-edge-l.png"
            alt=""
            className="pointer-events-none absolute top-0 h-full w-auto max-w-none select-none"
            style={{ right: "100%" }}
            draggable={false}
          />
          <img
            src="/assets/hero-base-edge-r.png"
            alt=""
            className="pointer-events-none absolute top-0 h-full w-auto max-w-none select-none"
            style={{ left: "100%" }}
            draggable={false}
          />
        </motion.div>

        {/* 左右树丛：以根部为轴被风吹得轻轻摇 */}
        <IntroPop
          play={intro}
          go={introGo}
          delay={INTRO_AT.bushLeft}
          origin="11.5% 88%"
        >
          <motion.img
            src={SPRITES.bushLeft.src}
            alt=""
            className="pointer-events-none absolute select-none"
            style={{
              left: px(SPRITES.bushLeft.x),
              top: py(SPRITES.bushLeft.y),
              width: px(SPRITES.bushLeft.w),
              transformOrigin: "50% 100%",
            }}
            animate={bushSway(1, 4.6, 0)}
            draggable={false}
          />
        </IntroPop>
        <IntroPop
          play={intro}
          go={introGo}
          delay={INTRO_AT.bushRight}
          origin="86.6% 88%"
        >
          <motion.img
            src={SPRITES.bushRight.src}
            alt=""
            className="pointer-events-none absolute select-none"
            style={{
              left: px(SPRITES.bushRight.x),
              top: py(SPRITES.bushRight.y),
              width: px(SPRITES.bushRight.w),
              transformOrigin: "50% 100%",
            }}
            animate={bushSway(0.8, 5.4, 1.2)}
            draggable={false}
          />
        </IntroPop>

        {/* 点击大门后才挂载：门框 + 屋内暖光 + 向两侧滑开的门板 */}
        {entering && <DoorOpenSprite />}

        {/* 大门：悬停时屋内亮灯（在 OPEN 吊牌下层） */}
        <DoorGlowSprite lit={hovered === "life" && !entering} />

        {/* OPEN 吊牌：以挂点为轴摆动；开门过场时隐藏，由门板裁剪容器里的副本接替。
            出场时以挂点为原点弹出 */}
        <IntroPop
          play={intro}
          go={introGo}
          delay={INTRO_AT.openSign}
          origin="45.9% 62%"
        >
          <motion.img
            src={SPRITES.openSign.src}
            alt=""
            className="pointer-events-none absolute select-none"
            style={{
              left: px(SPRITES.openSign.x),
              top: py(SPRITES.openSign.y),
              width: px(SPRITES.openSign.w),
              transformOrigin: "50% 8%",
              visibility: entering ? "hidden" : "visible",
            }}
            animate={signControls}
            draggable={false}
          />
        </IntroPop>

        {/* 四个热区元素：悬停时各自轻轻动一下 */}
        <IntroPop
          play={intro}
          go={introGo}
          delay={INTRO_AT.woolab}
          origin="50% 40%"
        >
          <WoolabSprite lit={hovered === "about"} />
        </IntroPop>
        <IntroPop
          play={intro}
          go={introGo}
          delay={INTRO_AT.board}
          origin="16.5% 91%"
        >
          <HotspotSprite
            sprite={SPRITES.board}
            active={hovered === "lab"}
            motionSpec={HOVER_MOTION.lab}
            origin="50% 100%"
          />
        </IntroPop>
        <IntroPop
          play={intro}
          go={introGo}
          delay={INTRO_AT.sheep}
          origin="63.4% 91%"
          zIndex={curtainUp ? 30 : undefined}
        >
          {/* 蓝布盖着时小羊在全屏调色层上面，黄昏/夜里的染色就用一个等价的颜色矩阵单独补在它身上：
              multiply 混一层 alpha 为 a 的颜色 C，等于每个通道乘 (1 - a + a·C)，布拉走换回全屏层时颜色不跳 */}
          {curtainUp && theme.tintAlpha > 0 && (
            <svg width="0" height="0" className="absolute" aria-hidden>
              <filter id={sheepTintId} colorInterpolationFilters="sRGB">
                <feColorMatrix
                  type="matrix"
                  values={tintMatrix(theme.tint, theme.tintAlpha)}
                />
              </filter>
            </svg>
          )}
          <img
            src={SPRITES.sheepShadow.src}
            alt=""
            className="pointer-events-none absolute select-none"
            style={{
              left: px(SPRITES.sheepShadow.x),
              top: py(SPRITES.sheepShadow.y),
              width: px(SPRITES.sheepShadow.w),
              filter: sheepTint,
            }}
            draggable={false}
          />
          <img
            src={SPRITES.sheep.src}
            alt=""
            className="pointer-events-none absolute select-none"
            style={{
              left: px(SPRITES.sheep.x),
              top: py(SPRITES.sheep.y),
              width: px(SPRITES.sheep.w),
              filter: sheepTint,
            }}
            draggable={false}
          />
        </IntroPop>
        <IntroPop
          play={intro}
          go={introGo}
          delay={INTRO_AT.mailbox}
          origin="84.4% 91%"
        >
          <MailboxSprite open={hovered === "contact"} />
        </IntroPop>

        {/* 邮箱前的灌木（盖在邮箱杆前面），跟着右边树丛一起摇 */}
        <IntroPop
          play={intro}
          go={introGo}
          delay={INTRO_AT.bush}
          origin="80.9% 91%"
        >
          <motion.img
            src={SPRITES.bush.src}
            alt=""
            className="pointer-events-none absolute select-none"
            style={{
              left: px(SPRITES.bush.x),
              top: py(SPRITES.bush.y),
              width: px(SPRITES.bush.w),
              transformOrigin: "50% 100%",
            }}
            animate={bushSway(0.8, 5.4, 1.2)}
            draggable={false}
          />
        </IntroPop>

        {/* 小鸟：扇翅三帧 + 站立帧共用一个容器，底部居中对齐，切帧时脚位不变 */}
        <motion.div
          className="pointer-events-none absolute select-none"
          style={{
            width: px(BIRD_BOX.w),
            height: py(BIRD_BOX.h),
            zIndex: curtainUp ? 30 : undefined,
            /* 布盖着时小鸟和小羊一样浮在调色层上面，同样补一份时段染色 */
            filter: sheepTint,
          }}
          initial={{ left: "135%", top: "14%", opacity: 0 }}
          animate={birdControls}
        >
          <div
            className="absolute inset-0"
            style={{ transform: birdFacingRight ? "scaleX(-1)" : undefined }}
          >
            {BIRD_FLAP_FRAMES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                draggable={false}
                className="absolute bottom-0 left-1/2 -translate-x-1/2"
                style={{
                  width: `${(BIRD_FLAP_SIZE.w / BIRD_BOX.w) * 100}%`,
                  display:
                    !birdStanding && birdFlapIdx === i ? "block" : "none",
                }}
              />
            ))}
            <img
              src={BIRD_STAND.src}
              alt=""
              draggable={false}
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
              style={{
                width: `${(BIRD_STAND.w / BIRD_BOX.w) * 100}%`,
                display: birdStanding ? "block" : "none",
              }}
            />
          </div>
        </motion.div>

        {/* 随风飘过的叶子 */}
        <WindLeaves />

        {/* 时段调色层：multiply 压暗/染色整个场景，线稿保持黑；进门时褪掉。
            左右各多出 60%：宽屏两侧的边缘延伸条也要一起染，不然接缝处一深一浅两条竖带 */}
        <motion.div
          className="pointer-events-none absolute inset-y-0"
          style={{
            left: "-60%",
            right: "-60%",
            background: theme.tint,
            mixBlendMode: "multiply",
          }}
          initial={false}
          animate={{ opacity: entering ? 0 : theme.tintAlpha }}
          transition={{
            duration: entering ? 0.5 : TIME_FADE,
            ease: "easeInOut",
          }}
        />

        {/* 黄昏/夜晚：吊灯和门玻璃默认亮着，叠在调色层上面才会"发光"。
            首次进场时等物件都弹出来了再亮，像有人把灯打开 */}
        <NightLights
          on={theme.lights && !entering}
          delay={intro && !introGo ? 0 : intro ? INTRO_AT.openSign + 0.6 : 0}
          signControls={signControls}
        />

        {/* 透明热区（点击跳转 + 悬停触发上面的微动效） */}
        {heroHotspots.map((h) => (
          <div
            key={h.id}
            role="link"
            tabIndex={0}
            aria-label={t(h.labelKey)}
            className={`group absolute z-20 outline-none ${
              h.id === "sheep" && !config.identityCardEnabled
                ? "cursor-default"
                : "cursor-pointer"
            } ${entering || curtainUp ? "pointer-events-none" : ""}`}
            style={{
              left: `${h.left}%`,
              top: `${h.top}%`,
              width: `${h.width}%`,
              height: `${h.height}%`,
            }}
            onMouseEnter={() => enterHotspot(h.id)}
            onMouseLeave={() => leaveHotspot(h.id)}
            onFocus={() => enterHotspot(h.id)}
            onBlur={() => leaveHotspot(h.id)}
            onClick={() => activateHotspot(h.id, h.path)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                activateHotspot(h.id, h.path);
              }
            }}
          >
            {/* 名称标签：悬停时淡入；小羊显示打招呼而不是栏目名 */}
            <span
              className={`font-hand absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-white/95 px-4 py-1 text-lg text-neutral-800 shadow-md transition-opacity duration-300 ${
                hovered === h.id
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
            >
              {h.id === "sheep" ? t(greetKey) : t(h.labelKey)}
            </span>
          </div>
        ))}
      </motion.div>

      {/* 小羊的身份卡：点击小羊弹出，「去它家看看」直接接开门过场（config.identityCardEnabled 关着时不挂） */}
      {config.identityCardEnabled && (
        <IdentityCard
          open={cardOpen}
          onClose={() => setCardOpen(false)}
          onVisit={() => {
            setCardOpen(false);
            void enterLife();
          }}
        />
      )}

      {/* 推进门里时，画面被屋内暖光渐渐填满，再切到内页 */}
      {entering && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-40"
          style={{
            background:
              "radial-gradient(circle at 50% 60%, #FBEBB8 0%, #F6D26B 70%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5, ease: "easeIn" }}
        />
      )}
    </div>
  );
}

/** 夜空：星星轻轻闪（纯 CSS，不用素材） */
function NightSky({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      {STARS.map((st, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-[#FFF6D6]"
          style={{
            left: `${st.left}%`,
            top: `${st.top}%`,
            width: st.size,
            height: st.size,
          }}
          animate={reducedMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: st.dur,
            delay: st.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </>
  );
}

/**
 * 天黑后默认亮着的灯：门玻璃暖光 + OPEN 吊牌副本（挂在玻璃前面，
 * 跟原吊牌共用同一套摆动控制）+ WOOLAB 开灯帧。
 * 整组画在调色层之上，所以不会被压暗。
 */
function NightLights({
  on,
  delay,
  signControls,
}: {
  on: boolean;
  delay: number;
  signControls: ReturnType<typeof useAnimationControls>;
}) {
  const lit = SPRITES.doorLit;
  const sign = SPRITES.openSign;
  const w = SPRITES.woolab.on;
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={false}
      animate={{ opacity: on ? 1 : 0 }}
      transition={{
        duration: on ? TIME_FADE : 0.3,
        delay: on ? delay : 0,
        ease: "easeInOut",
      }}
    >
      <img
        src={lit.src}
        alt=""
        draggable={false}
        className="absolute select-none"
        style={{ left: px(lit.x), top: py(lit.y), width: px(lit.w) }}
      />
      <motion.img
        src={sign.src}
        alt=""
        draggable={false}
        className="absolute select-none"
        style={{
          left: px(sign.x),
          top: py(sign.y),
          width: px(sign.w),
          transformOrigin: "50% 8%",
        }}
        animate={signControls}
      />
      {/* 开灯帧直接画（和白天 hover 一样）：光锥本身就是半透明暖黄，罩在压暗的墙上就是灯亮着的样子。
          之前用 hard-light 叠，光锥两条斜边那圈稍实的像素会被提得特别亮，成了两道光边 */}
      <img
        src={w.src}
        alt=""
        draggable={false}
        className="absolute select-none"
        style={{
          left: px(w.x),
          top: py(w.y),
          width: px(w.w),
          maxWidth: "none",
        }}
      />
    </motion.div>
  );
}

/**
 * 开门状态的门：底层是门框 + 屋内暖光（盖住底图里画死的关门状态），
 * 两扇门板挂载后立即向两侧滑开，被裁剪框裁掉，看起来像滑进了墙里。
 * 门板容器里叠着亮灯的暖玻璃（保持悬停时的灯光，不回到熄灯的蓝色）
 * 和 OPEN 吊牌副本（挂在左门板上），都跟着门板一起滑、一起被裁掉。
 */
function DoorOpenSprite() {
  const d = SPRITES.doorOpen;
  const p = d.panels;
  const lit = SPRITES.doorLit;
  const sign = SPRITES.openSign;
  const slide = {
    duration: DOOR_SLIDE_DURATION,
    delay: 0.05,
    ease: DOOR_SLIDE_EASE,
  };

  /** 把画板坐标换算成相对某扇门板（宽 p.single，高 p.h）的百分比 */
  const inPanel = (panelX: number, x: number, y: number, w: number) => ({
    left: `${((x - panelX) / p.single) * 100}%`,
    top: `${((y - p.y) / p.h) * 100}%`,
    width: `${(w / p.single) * 100}%`,
    maxWidth: "none" as const,
  });
  const leftX = p.x;
  const rightX = p.x + p.w - p.single;

  const panel = (side: "left" | "right") => {
    const panelX = side === "left" ? leftX : rightX;
    return (
      <motion.div
        className={`absolute top-0 h-full overflow-hidden ${side === "left" ? "left-0" : "right-0"}`}
        style={{ width: `${(p.single / p.w) * 100}%` }}
        initial={{ x: 0 }}
        animate={{ x: side === "left" ? "-104%" : "104%" }}
        transition={slide}
      >
        <img
          src={side === "left" ? d.left.src : d.right.src}
          alt=""
          draggable={false}
          className="absolute left-0 top-0 w-full select-none"
        />
        {/* 亮灯的暖玻璃：整张亮灯帧按原位对齐，超出门板的部分被裁掉 */}
        <img
          src={lit.src}
          alt=""
          draggable={false}
          className="absolute select-none"
          style={inPanel(panelX, lit.x, lit.y, lit.w)}
        />
        {side === "left" && (
          <img
            src={sign.src}
            alt=""
            draggable={false}
            className="absolute select-none"
            style={inPanel(panelX, sign.x, sign.y, sign.w)}
          />
        )}
      </motion.div>
    );
  };

  return (
    <>
      <img
        src={d.back.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none"
        style={{
          left: px(d.back.x),
          top: py(d.back.y),
          width: px(d.back.w),
        }}
      />
      <div
        className="pointer-events-none absolute overflow-hidden"
        style={{
          left: px(p.x),
          top: py(p.y),
          width: px(p.w),
          height: py(p.h),
        }}
      >
        {panel("left")}
        {panel("right")}
      </div>
    </>
  );
}

/**
 * 随风飘过的叶子：沿固定风道飘动 ——
 * 从左上角进入，斜着掠过 WOOLAB 招牌，再拉平飘向右侧邮箱方向出画。
 * 每片叶子在这条轨迹上做少量随机偏移，出现间隔较长，保持稀疏。
 */
const LEAF_PATH = {
  left: ["-4%", "22%", "46%", "70%", "105%"],
  top: [16, 36, 52, 62, 66], // 单位：画面高度百分比
} as const;

function WindLeaves() {
  const reducedMotion = useReducedMotion();

  const leaves = useMemo(
    () =>
      Array.from({ length: 2 }, (_, i) => ({
        src: LEAF_IMGS[i % LEAF_IMGS.length],
        w: rand(1.4, 2), // 显示宽度（占画板宽度百分比）
        offset: rand(-3, 3), // 整条轨迹的垂直偏移，让两片叶子不完全重叠
        spin: (Math.random() < 0.5 ? 1 : -1) * rand(300, 480),
        duration: rand(7, 9),
        delay: rand(0, 6) + i * 5,
        repeatDelay: rand(8, 16),
      })),
    [],
  );

  if (reducedMotion) return null;

  return (
    <>
      {leaves.map((leaf, i) => (
        <motion.img
          key={i}
          src={leaf.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{ width: `${leaf.w}%`, maxWidth: "none" }}
          initial={{
            left: "-4%",
            top: `${LEAF_PATH.top[0] + leaf.offset}%`,
            rotate: 0,
            opacity: 0,
          }}
          animate={{
            left: [...LEAF_PATH.left],
            top: LEAF_PATH.top.map((t) => `${t + leaf.offset}%`),
            rotate: [0, leaf.spin * 0.5, leaf.spin],
            // 首尾淡入淡出：等待下一轮时叶子停在轨迹端点，不能被看见
            // （宽屏两侧的延伸区会露出场景边界外的位置）
            opacity: [0, 1, 1, 1, 0],
          }}
          transition={{
            duration: leaf.duration,
            delay: leaf.delay,
            repeat: Infinity,
            repeatDelay: leaf.repeatDelay,
            ease: "linear",
          }}
        />
      ))}
    </>
  );
}

function HotspotSprite({
  sprite,
  active,
  motionSpec,
  idleSpec,
  origin,
}: {
  sprite: { src: string; x: number; y: number; w: number };
  active: boolean;
  motionSpec: TargetAndTransition;
  /** 非悬停时的待机动画（如小羊的呼吸感），不传则静止 */
  idleSpec?: TargetAndTransition;
  origin: string;
}) {
  const reducedMotion = useReducedMotion();

  const idle: TargetAndTransition = idleSpec ?? { y: 0, rotate: 0, scale: 1 };

  return (
    <motion.img
      src={sprite.src}
      alt=""
      className="pointer-events-none absolute select-none"
      style={{
        left: px(sprite.x),
        top: py(sprite.y),
        width: px(sprite.w),
        transformOrigin: origin,
      }}
      animate={reducedMotion ? undefined : active ? motionSpec : idle}
      draggable={false}
    />
  );
}

/**
 * 大门玻璃亮灯：悬停玻璃门时，屋内的灯"啪嗒"亮起——
 * 暖黄玻璃帧带一点闪烁地淡入；移开时灯光快速熄灭。
 */
function DoorGlowSprite({ lit }: { lit: boolean }) {
  const d = SPRITES.doorLit;

  return (
    <motion.img
      src={d.src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute select-none"
      style={{
        left: px(d.x),
        top: py(d.y),
        width: px(d.w),
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: lit ? [0, 0.55, 0.35, 1] : 0 }}
      transition={
        lit
          ? { duration: 0.45, times: [0, 0.3, 0.5, 1], ease: "easeOut" }
          : { duration: 0.12, ease: "easeIn" }
      }
    />
  );
}

/**
 * WOOLAB 吊灯：悬停时开灯——灯罩发亮、黄色光锥洒下、字变成暖橙色。
 * 两帧按灯罩对齐；开灯帧快速淡入，关灯瞬间熄灭。
 */
function WoolabSprite({ lit }: { lit: boolean }) {
  const w = SPRITES.woolab;

  return (
    <>
      <img
        src={w.off.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none"
        style={{
          left: px(w.off.x),
          top: py(w.off.y),
          width: px(w.off.w),
          visibility: lit ? "hidden" : "visible",
        }}
      />
      <motion.img
        src={w.on.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none"
        style={{
          left: px(w.on.x),
          top: py(w.on.y),
          width: px(w.on.w),
          maxWidth: "none",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: lit ? 0.18 : 0.05, ease: "easeOut" }}
      />
    </>
  );
}

/**
 * 邮箱：杆是静止图层；邮筒头悬停时从闭合切换到打开，
 * 并带一个微小的"弹开"缩放（以头部后侧为轴心）。
 * 开盖帧和闭合帧按右上角对齐（拱顶不动，盖子朝左下翻开）。
 */
function MailboxSprite({ open }: { open: boolean }) {
  const m = SPRITES.mailbox;
  const headRight = `${((FRAME_W - (m.headX + m.headW)) / FRAME_W) * 100}%`;
  const headTop = py(m.headY);

  return (
    <>
      {/* 邮筒杆（静止） */}
      <img
        src={m.post}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none"
        style={{ left: px(m.postX), top: py(m.postY), width: px(m.postW) }}
      />

      {/* 邮筒头（悬停开盖 + 微弹） */}
      <motion.div
        className="pointer-events-none absolute"
        style={{
          right: headRight,
          top: headTop,
          width: px(m.headOpenW),
          transformOrigin: "70% 30%",
        }}
        animate={open ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <img
          src={m.headClosed}
          alt=""
          draggable={false}
          className="absolute right-0 top-0 select-none"
          style={{
            width: `${(m.headW / m.headOpenW) * 100}%`,
            visibility: open ? "hidden" : "visible",
          }}
        />
        <img
          src={m.headOpen}
          alt=""
          draggable={false}
          className="absolute right-0 top-0 w-full select-none"
          style={{ visibility: open ? "visible" : "hidden" }}
        />
      </motion.div>
    </>
  );
}

function HotspotList() {
  const { t } = useLanguage();

  return (
    <ul className="flex flex-1 flex-col gap-3 bg-[#FFF6E9] px-4 py-5">
      {/* 小羊不跳页（在场景里点它弹身份卡），列表里只放页面入口 */}
      {heroHotspots
        .filter((h) => h.path)
        .map((h) => (
          <li key={h.id}>
            <Link
              to={h.path}
              onClick={() => playNavigate()}
              className="flex items-center justify-between rounded-xl border border-[#F0E2CC] bg-white px-4 py-4 shadow-sm transition active:scale-[0.98]"
            >
              <span className="font-hand text-lg">{t(h.labelKey)}</span>
              <span aria-hidden className="text-neutral-400">
                →
              </span>
            </Link>
          </li>
        ))}
    </ul>
  );
}
