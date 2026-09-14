import { Fragment, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { MotionValue, TargetAndTransition } from "framer-motion";
import { lifeStations } from "../../data/lifeStations";
import type { LifeStation } from "../../data/lifeStations";
import { seg01Layers } from "../../data/seg01Layers";
import type { SceneLayer } from "../../data/seg01Layers";
import { seg02Layers } from "../../data/seg02Layers";
import { seg03Layers } from "../../data/seg03Layers";
import PhotoPuzzle from "./PhotoPuzzle";
import DrinkMixer from "./DrinkMixer";
import CandleLight from "./CandleLight";
import HandHint from "./HandHint";
import { isStationDone } from "../../state/roomState";
import type { DrinkChoice, RoomState } from "../../state/roomState";
import { useLanguage } from "../../i18n/LanguageContext";
import type { DictKey } from "../../i18n/dict";
import {
  playLightOff,
  playLightOn,
  playMailboxClose,
  playMailboxOpen,
  playWater,
} from "../../audio/sfx";

interface Props {
  room: RoomState;
  /** 漫游态可点击站点；专注态期间禁用 */
  interactive: boolean;
  /** 唱片机开着（屋里的背景音在放）；点唱片切换 */
  music: boolean;
  onToggleMusic: () => void;
  /**
   * 引导：entry = 第一次进门时指一下墙上的清单；
   * hints = 站点旁的箭头现在能不能出（滚进画面就自己出，但清单抽屉开着 / 正在指清单时先让一让）
   */
  guide: { entry: boolean; hints: boolean };
  onOpen: (station: LifeStation, el: HTMLElement) => void;
  /** 点墙上挂着的清单 → 打开「今晚的小事」 */
  onChecklist: () => void;
  /** 每次清单面板收回去 +1：墙上那张晃两下（"它就住在这儿"） */
  listKick: number;
  /** 六件衣服都挂上挂杆 → tee 任务完成 */
  onTeeDone: () => void;
  /** 镜头已推近软木板 → 拼图碎片可拖 */
  photoActive: boolean;
  /** 11 片碎片拼完、化形动画播完 → photo 任务完成 */
  onPhotoDone: () => void;
  /** 镜头已推近白圆桌 → 调酒互动可用（含完成后回看时的 hover 名字） */
  drinkActive: boolean;
  /** 倒完饮料、名字浮现后 → drink 任务完成 */
  onDrinkDone: (choice: DrinkChoice) => void;
  /** 镜头已推近蜡烛角 → 点蜡烛互动可用 */
  candleActive: boolean;
  /** 小羊蜡烛点亮、白蜡烛回正后 → candle 任务完成 */
  onCandleDone: () => void;
  /** 彩蛋：换装动画播完，小羊穿上了白T牛仔裤 */
  onDressed: () => void;
  /** 作画动画阶段（拼图完成 → 拉回 → 原位播小羊作画） */
  paint: PaintPhase;
  /** 作画动画播完 → 弹清单盖章 */
  onPaintEnd: () => void;
  /** 走进 LAB 门：门已开好，交给页面推镜头进门洞并跳转（传门洞屏幕矩形） */
  onEnterLab: (doorRect: DOMRect) => void;
}


/** 敞开的 LAB 门（门打开素材，横楣与关门图对齐：关门 x11654 - 素材内偏移 390） */
const LAB_OPEN = { x: 11264, y: 319, w: 1093, h: 1229 };

/** 白圆桌上交给 DrinkMixer 渲染的图层（调酒互动的道具） */
const DRINK_TAKEN = new Set([
  "sauce-bottle",
  "soda-white",
  "soda-pink",
  "paper-cup",
  "fruit-knife",
  // 案板换成含柠檬和刀的两状态素材（整颗→切开），由 DrinkMixer 渲染
  "bread-board",
]);

/** 素材像素 → vh（画板高 1800px = 100vh） */
const vh = (px: number) => `${px / 18}vh`;

/** 图层素材路径（按段分目录存放） */
const layerUrl = (layer: SceneLayer) =>
  `/assets/life/${layer.dir ?? "seg01"}/${layer.src}.webp`;

/** 各动画类型的循环参数：幅度都很小，只求"活着"的感觉 */
function layerMotion(layer: SceneLayer): {
  animate?: TargetAndTransition;
  transformOrigin?: string;
} {
  const delay = layer.delay ?? 0;
  switch (layer.anim) {
    case "sway":
      return {
        transformOrigin: "50% 100%",
        animate: {
          rotate: [0, 1.6, 0, -1.6, 0],
          transition: { duration: 5.5, repeat: Infinity, ease: "easeInOut", delay },
        },
      };
    case "swing":
      return {
        transformOrigin: "50% 4%",
        animate: {
          rotate: [0, 1.8, 0, -1.8, 0],
          transition: { duration: 4.6, repeat: Infinity, ease: "easeInOut", delay },
        },
      };
    case "float":
      return {
        animate: {
          y: [6, -22],
          opacity: [0, 1, 1, 0],
          transition: { duration: 3, repeat: Infinity, ease: "easeOut", delay },
        },
      };
    case "breath":
      return {
        transformOrigin: "50% 100%",
        animate: {
          scaleY: [1, 1.015, 1],
          transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay },
        },
      };
    case "bob":
      return {
        animate: {
          y: [0, -5, 0],
          transition: {
            duration: 2.2,
            repeat: Infinity,
            repeatDelay: 1.6,
            ease: "easeInOut",
            delay,
          },
        },
      };
    default:
      return {};
  }
}

/** 窗户动画：视频完整24帧，窗格画面逐帧对位贴进完整窗框素材（整窗左移，左扇被画面左缘裁掉） */
const WINDOW_RECT = { x: -148, y: 247, w: 866, h: 710 };
const WINDOW_FRAMES = 24;
const WINDOW_FPS = 5;
/** 乒乓循环：正放到尾再倒放回头，避免首尾帧接不上产生跳变 */
const WINDOW_CYCLE = WINDOW_FRAMES * 2 - 2;
const windowFrameSrc = (i: number) =>
  `/assets/life/seg01/window-anim/f${String(i).padStart(2, "0")}.webp`;

function WindowAnim() {
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 窗户滚出视野时停播，省掉不可见区域的开销
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => setTick((t) => (t + 1) % WINDOW_CYCLE),
      1000 / WINDOW_FPS,
    );
    return () => clearInterval(id);
  }, [running]);

  const frame = tick < WINDOW_FRAMES ? tick : WINDOW_CYCLE - tick;
  // 所有帧常驻 DOM 只切换透明度，避免每次换帧重新解码图片
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute select-none"
      style={{
        left: vh(WINDOW_RECT.x),
        top: vh(WINDOW_RECT.y),
        width: vh(WINDOW_RECT.w),
        height: vh(WINDOW_RECT.h),
      }}
    >
      {Array.from({ length: WINDOW_FRAMES }, (_, i) => (
        <img
          key={i}
          src={windowFrameSrc(i)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full max-w-none"
          style={{ opacity: i === frame ? 1 : 0 }}
        />
      ))}
    </div>
  );
}

/**
 * 唱片机的唱片与唱臂（素材像素坐标）：
 * 唱片整张静态摆着（保留底部厚度），完整盘面（Group 313 导出）
 * 拉成正圆后 rotate 旋转，再 scaleY 压回透视椭圆叠在上面；
 * 唱臂静态叠在转动的盘面上。机身在 seg01Layers 里。
 */
const RECORD_DISC = { x: 572, y: 1098, w: 306, h: 90 };
/** 旋转盘面：离线预渲染的 36 帧序列（浏览器实时变换会周期性发糊） */
const RECORD_FACE = { x: 574, y: 1098, w: 302, h: 78 };
const RECORD_ARM = { x: 779, y: 1058, w: 191, h: 129 };
const RECORD_FRAMES = 36;
const RECORD_FPS = 6; // 36帧 ÷ 6fps = 6秒一圈
const recordFrameSrc = (i: number) =>
  `/assets/life/seg01/record-anim/f${String(i).padStart(2, "0")}.webp`;

function RecordPlayer({
  playing,
  interactive,
  onToggle,
}: {
  /** 唱片在转（= 屋里的背景音开着）；默认不转，点唱片才开 */
  playing: boolean;
  interactive: boolean;
  onToggle: () => void;
}) {
  const [frame, setFrame] = useState(0);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 滚出视野时停播（省 CPU，音乐不停）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = playing && inView;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => setFrame((f) => (f + 1) % RECORD_FRAMES),
      1000 / RECORD_FPS,
    );
    return () => clearInterval(id);
  }, [running]);

  return (
    <>
      <img
        src="/assets/life/seg01/record-disc.webp"
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          left: vh(RECORD_DISC.x),
          top: vh(RECORD_DISC.y),
          width: vh(RECORD_DISC.w),
          height: vh(RECORD_DISC.h),
        }}
      />
      {/* 盘面帧序列：全部常驻 DOM 只切透明度，避免换帧重新解码 */}
      <div
        ref={ref}
        className="pointer-events-none absolute select-none"
        style={{
          left: vh(RECORD_FACE.x),
          top: vh(RECORD_FACE.y),
          width: vh(RECORD_FACE.w),
          height: vh(RECORD_FACE.h),
        }}
      >
        {Array.from({ length: RECORD_FRAMES }, (_, i) => (
          <img
            key={i}
            src={recordFrameSrc(i)}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full max-w-none"
            style={{ opacity: i === frame ? 1 : 0 }}
          />
        ))}
      </div>
      <img
        src="/assets/life/seg01/record-arm.webp"
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          left: vh(RECORD_ARM.x),
          top: vh(RECORD_ARM.y),
          width: vh(RECORD_ARM.w),
          height: vh(RECORD_ARM.h),
        }}
      />
      {/* 点唱片：开 / 关音乐（热区盖住唱片 + 唱臂） */}
      <div
        role="button"
        tabIndex={0}
        aria-label={playing ? "Stop the record" : "Play the record"}
        aria-pressed={playing}
        className={`absolute outline-none ${interactive ? "cursor-pointer" : "pointer-events-none"}`}
        style={{
          left: vh(RECORD_DISC.x - 20),
          top: vh(RECORD_ARM.y - 30),
          width: vh(RECORD_ARM.x + RECORD_ARM.w - RECORD_DISC.x + 30),
          height: vh(RECORD_DISC.y + RECORD_DISC.h - RECORD_ARM.y + 40),
          zIndex: 5,
        }}
        onClick={() => interactive && onToggle()}
        onKeyDown={(e) => {
          if (interactive && (e.key === "Enter" || e.key === " ")) onToggle();
        }}
      />
    </>
  );
}

/**
 * 柜子的推拉门（素材像素坐标）：
 * 静止时左右两扇都关着（书本格也盖住）；hover 哪扇，
 * 哪扇就滑到另一边叠在另一扇上，露出后面的柜格，移开滑回。
 * 素材端已把柜子底图上画的门挖成柜腔，两扇门是独立贴片（右扇为镜像）。
 * 感应区固定在各自关着的位置，门滑走后 hover 状态不会跟着抖。
 */
const CABINET_DOOR = { leftX: 542, rightX: 792, y: 1278, w: 232, h: 202 };
/** 一扇门滑到另一边的行程 */
const CABINET_DOOR_TRAVEL = CABINET_DOOR.rightX - CABINET_DOOR.leftX;

function CabinetDoor({ interactive }: { interactive: boolean }) {
  const [hovered, setHovered] = useState<"l" | "r" | null>(null);

  const doors = [
    { id: "l" as const, src: "cabinet-door-l", closedX: CABINET_DOOR.leftX, shift: CABINET_DOOR_TRAVEL },
    { id: "r" as const, src: "cabinet-door-r", closedX: CABINET_DOOR.rightX, shift: -CABINET_DOOR_TRAVEL },
  ];

  return (
    <>
      {doors.map((d) => (
        <motion.img
          key={d.id}
          src={`/assets/life/seg01/${d.src}.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            left: vh(d.closedX),
            top: vh(CABINET_DOOR.y),
            width: vh(CABINET_DOOR.w),
            height: vh(CABINET_DOOR.h),
            // 滑动的那扇叠在另一扇上面
            zIndex: hovered === d.id ? 1 : 0,
          }}
          initial={false}
          animate={{ x: hovered === d.id ? vh(d.shift) : "0vh" }}
          transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
        />
      ))}
      {doors.map((d) => (
        <div
          key={`zone-${d.id}`}
          className="absolute"
          style={{
            left: vh(d.closedX),
            top: vh(CABINET_DOOR.y),
            width: vh(CABINET_DOOR.w),
            height: vh(CABINET_DOOR.h),
            pointerEvents: interactive ? "auto" : "none",
          }}
          onMouseEnter={() => setHovered(d.id)}
          onMouseLeave={() => setHovered((h) => (h === d.id ? null : h))}
        />
      ))}
    </>
  );
}

/** 挂杆感应区（素材像素坐标）：盖住挂着的衣服和衣挂 */
const SWING_ZONE = { x: 1290, y: 630, w: 850, h: 480 };
/** 鼠标离开时推到远处，让所有摆动回零 */
const MOUSE_AWAY = 1e6;

/**
 * 挂着的衣物：鼠标划过时像被手拨开——以挂点为轴倾斜，
 * 离鼠标越近摆得越大，方向背离鼠标，移开后弹回。
 */
function SwingSprite({
  layer,
  mouseX,
}: {
  layer: SceneLayer;
  mouseX: MotionValue<number>;
}) {
  const cx = layer.x + layer.w / 2;
  const rotate = useSpring(
    useTransform(mouseX, (mx: number) => {
      const d = (mx - cx) / 18; // 距离（vh）
      const influence = Math.exp(-(d * d) / (2 * 12 * 12));
      return (d < 0 ? 1 : -1) * 8 * influence;
    }),
    { stiffness: 150, damping: 11 },
  );
  return (
    <motion.img
      src={layerUrl(layer)}
      alt=""
      draggable={false}
      className="pointer-events-none absolute max-w-none select-none"
      style={{
        left: vh(layer.x),
        top: vh(layer.y),
        width: vh(layer.w),
        height: vh(layer.h),
        transformOrigin: "50% 5%",
        rotate,
      }}
    />
  );
}

/**
 * 钉在墙上的纸张：鼠标碰到时以顶部图钉为轴荡几下，
 * 幅度逐次衰减后自然停回。从哪边碰就先往哪边荡。
 * 传入 onClick 时可点击（墙上的清单 → 今晚的小事）。
 */
function PendulumSprite({
  layer,
  onClick,
  kick = 0,
}: {
  layer: SceneLayer;
  onClick?: () => void;
  /** 外面递进来的"晃一下"信号（每次 +1）：清单面板刚收回去时用 */
  kick?: number;
}) {
  const controls = useAnimationControls();
  const swingBy = (dir: number, amp = 6) =>
    controls.start({
      rotate: [amp * dir, -amp * 0.75 * dir, amp * 0.5 * dir, -amp * 0.25 * dir, amp * 0.1 * dir, 0],
      transition: { duration: 1.8, ease: "easeInOut" },
    });
  const swing = (e: React.MouseEvent<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    swingBy(e.clientX < r.left + r.width / 2 ? 1 : -1);
  };
  /* 面板收回去了：荡两下再停 */
  useEffect(() => {
    if (kick) void swingBy(1, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kick]);
  return (
    <motion.img
      src={layerUrl(layer)}
      alt=""
      draggable={false}
      onMouseEnter={swing}
      onClick={onClick}
      className={`absolute max-w-none select-none ${onClick ? "cursor-pointer" : ""}`}
      style={{
        left: vh(layer.x),
        top: vh(layer.y),
        width: vh(layer.w),
        height: vh(layer.h),
        transformOrigin: layer.pivot ?? "50% 3%",
      }}
      animate={controls}
    />
  );
}

/**
 * 布帘：鼠标碰到就整幅往右边拢过去（以右边那条边为轴横向收拢），
 * 露出柜子里的碗碟，移开后弹回来盖上。感应区固定在布帘
 * 原本盖住的位置，拉开后 hover 状态不会跟着抖。
 */
function LiftSprite({
  layer,
  interactive,
}: {
  layer: SceneLayer;
  interactive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rect = {
    left: vh(layer.x),
    top: vh(layer.y),
    width: vh(layer.w),
    height: vh(layer.h),
  };
  return (
    <>
      <motion.img
        src={layerUrl(layer)}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{ ...rect, transformOrigin: "100% 50%" }}
        initial={false}
        animate={{ scaleX: open ? 0.22 : 1 }}
        transition={
          open
            ? { type: "spring", stiffness: 320, damping: 24 }
            : { type: "spring", stiffness: 170, damping: 16 }
        }
      />
      <div
        className="absolute"
        style={{ ...rect, pointerEvents: interactive ? "auto" : "none" }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      />
    </>
  );
}

/**
 * 冰箱：鼠标碰到就打开门（换成 fridge-open 素材，门朝右开），
 * 移开后关上。两张素材左对齐、同高，直接同位换图。
 */
function FridgeHover({ layer }: { layer: SceneLayer }) {
  const [open, setOpen] = useState(false);
  return (
    <img
      src={`/assets/life/seg03/${open ? "fridge-open" : "fridge"}.webp`}
      alt=""
      draggable={false}
      className="absolute max-w-none select-none"
      style={{
        left: vh(layer.x),
        top: vh(layer.y),
        width: vh(open ? 887 : layer.w),
        height: vh(layer.h),
      }}
      onMouseEnter={() => {
        setOpen(true);
        playMailboxOpen();
      }}
      onMouseLeave={() => {
        setOpen(false);
        playMailboxClose();
      }}
    />
  );
}

function SceneSprite({ layer }: { layer: SceneLayer }) {
  const { animate, transformOrigin } = layerMotion(layer);
  return (
    <motion.img
      src={layerUrl(layer)}
      alt=""
      draggable={false}
      className="pointer-events-none absolute max-w-none select-none"
      style={{
        left: vh(layer.x),
        top: vh(layer.y),
        width: vh(layer.w),
        height: vh(layer.h),
        transformOrigin,
      }}
      animate={animate}
    />
  );
}

/* ---------------- 换装彩蛋（把白T拖给小羊） ---------------- */

/**
 * 换装帧覆盖 镜子+小羊+影子 的区域（模板匹配定位，帧里 1px = 素材 1.4px；
 * 帧已裁掉四周空白，故在视频画面基础上偏移了 107×144 像素）。播放时隐掉
 * 这三个图层和被穿走的帽子/白T/牛仔裤，结束后定格在最后一帧（dress-still）。
 */
const DRESS_RECT = { x: 2168.4, y: 486.8, w: 849.8, h: 1191.4 };
const DRESS_FRAMES = 61;
const DRESS_FPS = 12;
const dressFrameSrc = (i: number) =>
  `/assets/life/seg01/dress-anim/f${String(i).padStart(2, "0")}.webp`;
/** 松手位置落在小羊身上算触发（素材像素包围盒） */
const SHEEP_ZONE = { x: 2130, y: 1030, w: 520, h: 680 };

function DressAnim({ onEnd }: { onEnd: () => void }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (frame >= DRESS_FRAMES - 1) {
      const t = window.setTimeout(onEnd, 400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setFrame(frame + 1), 1000 / DRESS_FPS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  return (
    <div
      className="pointer-events-none absolute select-none"
      style={{
        left: vh(DRESS_RECT.x),
        top: vh(DRESS_RECT.y),
        width: vh(DRESS_RECT.w),
        height: vh(DRESS_RECT.h),
      }}
    >
      {Array.from({ length: DRESS_FRAMES }, (_, i) => (
        <img
          key={i}
          src={dressFrameSrc(i)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full max-w-none"
          style={{ opacity: i === frame ? 1 : 0 }}
        />
      ))}
    </div>
  );
}

/**
 * 作画动画（photo 任务的收尾）：拼图完成、镜头拉回后，
 * 画家小羊在原位把画布上的瓶花画出来。帧覆盖 小羊+画架 两个图层
 * （模板匹配定位：小羊按 0.985 缩放精确锚定；画架在视频里比场景略小，
 * 切换瞬间的微跳属素材构图差异）。播完定格最后一帧（画好的橙色瓶花
 * 成为 photo 任务的持久痕迹，刷新仍在）。
 */
const PAINT_RECT = { x: 4490, y: 914.3, w: 1073, h: 828.3 };
const PAINT_FRAMES = 42;
const PAINT_FPS = 12;
const paintFrameSrc = (i: number) =>
  `/assets/life/seg02/paint-anim/f${String(i).padStart(2, "0")}.webp`;
/** 作画动画的阶段：wait = 已完成拼图、镜头拉回中（静态层先留着） */
export type PaintPhase = "idle" | "wait" | "play";

function PaintAnim({ playing, onEnd }: { playing: boolean; onEnd: () => void }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!playing) return;
    if (frame >= PAINT_FRAMES - 1) {
      const t = window.setTimeout(onEnd, 400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setFrame(frame + 1), 1000 / PAINT_FPS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, playing]);

  return (
    <div
      className="pointer-events-none absolute select-none"
      style={{
        left: vh(PAINT_RECT.x),
        top: vh(PAINT_RECT.y),
        width: vh(PAINT_RECT.w),
        height: vh(PAINT_RECT.h),
        // wait 阶段隐藏挂载：42 帧先进 DOM 解码，play 时切换不闪帧
        visibility: playing ? "visible" : "hidden",
      }}
    >
      {Array.from({ length: PAINT_FRAMES }, (_, i) => (
        <img
          key={i}
          src={paintFrameSrc(i)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full max-w-none"
          style={{ opacity: i === frame ? 1 : 0 }}
        />
      ))}
    </div>
  );
}

/* ---------------- 挂衣服互动（tee 任务） ---------------- */

/**
 * 六件衣服，每件两种形态：flat（叠着放在堆里 / 拖拽时）和
 * hung（挂在衣架上，含衣架）。数组顺序 = 拿的顺序（堆顶先拿）；
 * pile 是它叠着时的位置（素材像素坐标）——蓝裤子单独叠在
 * 衣架底箱的台面上，紫裤子默认已挂在杆上，其余四件堆在地上。
 * hung.hook 是挂钩中心距贴图左边的像素，对位到槽位中心。
 */
const HANG_PIECES = [
  { id: "polo",   hung: { w: 267, h: 404, y: 671, hook: 147 }, flat: { w: 310, h: 158 }, pile: { x: 1720, y: 1425 } },
  { id: "yellow", hung: { w: 262, h: 404, y: 668, hook: 142 }, flat: { w: 291, h: 175 }, pile: { x: 1855, y: 1450 } },
  { id: "stripe", hung: { w: 289, h: 401, y: 670, hook: 150 }, flat: { w: 366, h: 218 }, pile: { x: 1665, y: 1462 } },
  { id: "jeans",  hung: { w: 207, h: 407, y: 668, hook: 124 }, flat: { w: 360, h: 201 }, pile: { x: 1602, y: 1240 } },
  { id: "white",  hung: { w: 262, h: 404, y: 668, hook: 142 }, flat: { w: 394, h: 212 }, pile: { x: 1580, y: 1490 } },
  { id: "purple", hung: { w: 210, h: 328, y: 668, hook: 124 }, flat: { w: 223, h: 128 }, pile: { x: 1618, y: 1428 } },
];
type HangPiece = (typeof HANG_PIECES)[number];

/** 完成态的排列（槽位 → 衣服下标）：白T、条纹、黄T、Polo、蓝裤、紫裤 */
const DONE_ORDER = [4, 2, 1, 0, 3, 5];

/** 挂杆上六个挂点的中心 x（对应衣架顶上六颗铆钉的节奏） */
const HANG_SLOTS = [1441, 1534, 1627, 1720, 1813, 1906];
/** 空衣挂素材的挂钩中心距左边 92px */
const HANGER_HOOK = 92;
/** 衣服堆热区（盖住台面上的蓝裤子 + 地上五件的包围盒） */
const PILE = { x: 1560, y: 1220, w: 700, h: 500 };
/** 松手时距最近空挂点多远以内算挂上（素材像素） */
const SNAP_X = 110;

/** 挂好的衣服：从落点滑到挂点晃两下停稳，之后跟随挂杆感应区轻摆 */
function LandedPiece({
  piece,
  cx,
  fromX,
  fromY,
  mouseX,
}: {
  piece: HangPiece;
  cx: number;
  fromX?: number;
  fromY?: number;
  mouseX: MotionValue<number>;
}) {
  const rotate = useSpring(
    useTransform(mouseX, (mx: number) => {
      const d = (mx - cx) / 18;
      const influence = Math.exp(-(d * d) / (2 * 12 * 12));
      return (d < 0 ? 1 : -1) * 8 * influence;
    }),
    { stiffness: 150, damping: 11 },
  );
  const hasFrom = fromX !== undefined && fromY !== undefined;
  return (
    <motion.div
      className="pointer-events-none absolute select-none"
      style={{
        left: vh(cx - piece.hung.hook),
        top: vh(piece.hung.y),
        width: vh(piece.hung.w),
        height: vh(piece.hung.h),
        transformOrigin: "50% 5%",
      }}
      initial={
        hasFrom
          ? { x: vh(fromX! - cx), y: vh(fromY! - piece.hung.y), rotate: -5 }
          : false
      }
      animate={{ x: "0vh", y: "0vh", rotate: hasFrom ? [-5, 5, -3, 1.5, 0] : 0 }}
      transition={{ duration: 0.9, ease: [0.33, 1, 0.68, 1] }}
    >
      <motion.img
        src={`/assets/life/seg01/hung-${piece.id}.webp`}
        alt=""
        draggable={false}
        className="h-full w-full max-w-none"
        style={{ transformOrigin: "50% 5%", rotate }}
      />
    </motion.div>
  );
}

/** 换装彩蛋会被小羊穿走的两件：白T和牛仔裤 */
const WHITE_IDX = 4;
const JEANS_IDX = 3;

function HangClothes({
  done,
  interactive,
  hintOn,
  mouseX,
  onDone,
  canDress,
  dressActive,
  onDress,
}: {
  done: boolean;
  interactive: boolean;
  /** 用户停下来了 → 该出引导（拖衣服上杆 / 白T给小羊） */
  hintOn: boolean;
  mouseX: MotionValue<number>;
  onDone: () => void;
  /** 挂满且还没换装 → 挂着的白T可以拖给小羊 */
  canDress: boolean;
  /** 换装动画播放中或已换装 → 白T/牛仔裤已被穿走，只剩空衣挂 */
  dressActive: boolean;
  onDress: () => void;
}) {
  const { t } = useLanguage();
  /* 衣帽区在不在画面里（滚走了就别出引导） */
  const anchorRef = useRef<HTMLDivElement>(null);
  const inView = useInView(anchorRef, { amount: 0.5 });
  /** 初始态：紫裤子默认挂在最右槽位，其余五件待挂 */
  const INIT: (number | null)[] = [null, null, null, null, null, 5];
  /** 每个槽位挂的是哪件（衣服下标）；已完成时按示意图排布 */
  const [hung, setHung] = useState<(number | null)[]>(() =>
    done ? [...DONE_ORDER] : [...INIT],
  );
  /** 刚落位的槽位（落点坐标，驱动入位动画） */
  const landing = useRef<{ slot: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ piece: number; x: number; y: number } | null>(null);
  const [flyback, setFlyback] = useState<{ piece: number; x: number; y: number; key: number } | null>(null);
  /** 彩蛋：把挂着的白T拖在手里（长卷素材像素坐标） */
  const [dressDrag, setDressDrag] = useState<{ x: number; y: number } | null>(null);
  const pileRef = useRef<HTMLDivElement>(null);

  // 重新过一晚：衣服回到初始态（紫裤子留在挂杆上）
  useEffect(() => {
    if (!done) {
      setHung((h) =>
        h.every((v, i) => v === INIT[i]) ? h : [...INIT],
      );
      landing.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  /** 下一件可拿的 = 堆里最上面那件（取用顺序即数组顺序） */
  const nextPiece = HANG_PIECES.findIndex((_, p) => !hung.includes(p));

  /** 屏幕坐标 → 长卷素材像素坐标（以衣服堆热区为基准换算） */
  const toArt = (clientX: number, clientY: number) => {
    const r = pileRef.current!.getBoundingClientRect();
    const s = r.width / PILE.w;
    return { x: PILE.x + (clientX - r.left) / s, y: PILE.y + (clientY - r.top) / s };
  };

  const startDrag = (e: React.PointerEvent) => {
    if (!interactive || nextPiece < 0 || drag) return;
    e.preventDefault();
    const piece = nextPiece;
    const hungNow = [...hung];
    const p = toArt(e.clientX, e.clientY);
    setDrag({ piece, x: p.x, y: p.y });

    const move = (ev: PointerEvent) => {
      const q = toArt(ev.clientX, ev.clientY);
      setDrag((d) => (d ? { ...d, x: q.x, y: q.y } : d));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const q = toArt(ev.clientX, ev.clientY);
      setDrag(null);
      // 找最近的空挂点
      let slot = -1;
      let best = SNAP_X;
      HANG_SLOTS.forEach((cx, i) => {
        if (hungNow[i] !== null) return;
        const d = Math.abs(q.x - cx);
        if (d < best) {
          best = d;
          slot = i;
        }
      });
      if (slot >= 0 && q.y > 520 && q.y < 1280) {
        landing.current = { slot, x: q.x, y: q.y };
        hungNow[slot] = piece;
        setHung(hungNow);
        if (hungNow.every((v) => v !== null)) onDone();
      } else {
        setFlyback({ piece, x: q.x, y: q.y, key: Date.now() });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dragPiece = drag ? HANG_PIECES[drag.piece] : null;
  /** 还叠在堆里的：没挂上、不在手里、也不在飞回途中 */
  const inPile = (p: number) =>
    !hung.includes(p) && drag?.piece !== p && flyback?.piece !== p;

  /** 彩蛋：从挂杆上拖起白T，丢到小羊身上换装，丢空了荡回原位 */
  const whiteSlot = hung.indexOf(WHITE_IDX);
  const whitePiece = HANG_PIECES[WHITE_IDX];
  const startDressDrag = (e: React.PointerEvent) => {
    if (!canDress || dressDrag || whiteSlot < 0) return;
    e.preventDefault();
    const zone = e.currentTarget.getBoundingClientRect();
    const s = zone.width / whitePiece.hung.w;
    const zoneArtX = HANG_SLOTS[whiteSlot] - whitePiece.hung.hook;
    const toArt2 = (cx: number, cy: number) => ({
      x: zoneArtX + (cx - zone.left) / s,
      y: whitePiece.hung.y + (cy - zone.top) / s,
    });
    const p = toArt2(e.clientX, e.clientY);
    setDressDrag(p);

    const move = (ev: PointerEvent) => {
      const q = toArt2(ev.clientX, ev.clientY);
      setDressDrag((d) => (d ? q : d));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const q = toArt2(ev.clientX, ev.clientY);
      setDressDrag(null);
      const onSheep =
        q.x > SHEEP_ZONE.x &&
        q.x < SHEEP_ZONE.x + SHEEP_ZONE.w &&
        q.y > SHEEP_ZONE.y &&
        q.y < SHEEP_ZONE.y + SHEEP_ZONE.h;
      if (onSheep) {
        onDress();
      } else {
        // 没丢中：白T从松手处荡回挂点
        landing.current = { slot: whiteSlot, x: q.x, y: q.y };
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <>
      {/* 空挂点的衣架（挂上衣服后被衣服自带的衣架取代；被小羊穿走的又剩回空衣挂） */}
      {HANG_SLOTS.map((cx, i) => {
        const p = hung[i];
        const empty =
          p === null ||
          (dressActive && (p === WHITE_IDX || p === JEANS_IDX)) ||
          (dressDrag !== null && p === WHITE_IDX);
        return (
          empty && (
            <SwingSprite
              key={`slot-hanger-${i}`}
              layer={{
                src: "hanger",
                x: cx - HANGER_HOOK,
                y: 671,
                w: 154,
                h: 160,
                anim: "static",
              }}
              mouseX={mouseX}
            />
          )
        );
      })}

      {/* 拖拽时空挂点的落点提示光晕 */}
      {drag &&
        HANG_SLOTS.map((cx, i) => {
          if (hung[i] !== null) return null;
          const near = Math.abs(drag.x - cx) < SNAP_X;
          return (
            <motion.div
              key={`slot-glow-${i}`}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: vh(cx - 90),
                top: vh(640),
                width: vh(180),
                height: vh(180),
                background:
                  "radial-gradient(closest-side, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%)",
              }}
              animate={{ opacity: near ? 1 : 0.35, scale: near ? 1.1 : 1 }}
              transition={{ duration: 0.2 }}
            />
          );
        })}

      {/* 已挂上的衣服（被小羊穿走的、拖在手里的白T不渲染） */}
      {hung.map((piece, slot) => {
        if (piece === null) return null;
        if (dressActive && (piece === WHITE_IDX || piece === JEANS_IDX)) return null;
        if (dressDrag && piece === WHITE_IDX) return null;
        const land = landing.current?.slot === slot ? landing.current : null;
        return (
          <LandedPiece
            key={`landed-${slot}`}
            piece={HANG_PIECES[piece]}
            cx={HANG_SLOTS[slot]}
            fromX={land?.x}
            fromY={land?.y}
            mouseX={mouseX}
          />
        );
      })}

      {/* 衣服堆：还没拿走的衣服叠着（渲染顺序倒过来，先拿的在最上层） */}
      {[...HANG_PIECES.keys()].reverse().map(
        (p) =>
          inPile(p) && (
            <img
              key={`pile-${HANG_PIECES[p].id}`}
              src={`/assets/life/seg01/flat-${HANG_PIECES[p].id}.webp`}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: vh(HANG_PIECES[p].pile.x),
                top: vh(HANG_PIECES[p].pile.y),
                width: vh(HANG_PIECES[p].flat.w),
                height: vh(HANG_PIECES[p].flat.h),
              }}
            />
          ),
      )}

      {/* 没挂上：飞回堆里原来的位置 */}
      <AnimatePresence>
        {flyback && (
          <motion.img
            key={flyback.key}
            src={`/assets/life/seg01/flat-${HANG_PIECES[flyback.piece].id}.webp`}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width: vh(HANG_PIECES[flyback.piece].flat.w),
              height: vh(HANG_PIECES[flyback.piece].flat.h),
              left: 0,
              top: 0,
            }}
            initial={{
              x: vh(flyback.x - HANG_PIECES[flyback.piece].flat.w / 2),
              y: vh(flyback.y - HANG_PIECES[flyback.piece].flat.h / 2),
              rotate: -5,
              scale: 0.95,
            }}
            animate={{
              x: vh(HANG_PIECES[flyback.piece].pile.x),
              y: vh(HANG_PIECES[flyback.piece].pile.y),
              rotate: 0,
              scale: 1,
            }}
            transition={{ duration: 0.45, ease: [0.33, 1, 0.68, 1] }}
            onAnimationComplete={() => setFlyback(null)}
          />
        )}
      </AnimatePresence>

      {/* 拖拽中的衣服：叠着的形态跟着指尖 */}
      {drag && dragPiece && (
        <img
          src={`/assets/life/seg01/flat-${dragPiece.id}.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none drop-shadow-lg"
          style={{
            left: vh(drag.x - dragPiece.flat.w / 2),
            top: vh(drag.y - dragPiece.flat.h / 2),
            width: vh(dragPiece.flat.w),
            height: vh(dragPiece.flat.h),
            transform: "rotate(-5deg) scale(0.95)",
          }}
        />
      )}

      {/* 彩蛋拖拽中：白T（连衣架）拎在手里，小羊身上亮起落点提示 */}
      {dressDrag && (
        <>
          <motion.div
            className="pointer-events-none absolute rounded-full"
            style={{
              left: vh(SHEEP_ZONE.x + SHEEP_ZONE.w / 2 - 260),
              top: vh(SHEEP_ZONE.y + SHEEP_ZONE.h / 2 - 260),
              width: vh(520),
              height: vh(520),
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.8), rgba(255,255,255,0) 70%)",
            }}
            animate={{
              opacity:
                dressDrag.x > SHEEP_ZONE.x &&
                dressDrag.x < SHEEP_ZONE.x + SHEEP_ZONE.w &&
                dressDrag.y > SHEEP_ZONE.y &&
                dressDrag.y < SHEEP_ZONE.y + SHEEP_ZONE.h
                  ? 1
                  : 0.35,
            }}
            transition={{ duration: 0.2 }}
          />
          <img
            src="/assets/life/seg01/hung-white.webp"
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none drop-shadow-lg"
            style={{
              left: vh(dressDrag.x - whitePiece.hung.hook),
              top: vh(dressDrag.y - 20),
              width: vh(whitePiece.hung.w),
              height: vh(whitePiece.hung.h),
              transform: "rotate(-4deg)",
              transformOrigin: "50% 5%",
            }}
          />
        </>
      )}

      {/* 彩蛋热区：挂满后盖在挂着的白T上，可拎起来拖给小羊 */}
      {canDress && whiteSlot >= 0 && !dressDrag && (
        <div
          className="absolute cursor-grab"
          style={{
            left: vh(HANG_SLOTS[whiteSlot] - whitePiece.hung.hook),
            top: vh(whitePiece.hung.y),
            width: vh(whitePiece.hung.w),
            height: vh(whitePiece.hung.h),
            touchAction: "none",
            zIndex: 5,
          }}
          onPointerDown={startDressDrag}
        />
      )}

      {/* 衣服堆热区：还有衣服没挂完时可拖 */}
      {!done && (
        <div
          ref={pileRef}
          className={`absolute ${interactive && nextPiece >= 0 && !drag ? "cursor-grab" : ""}`}
          style={{
            left: vh(PILE.x),
            top: vh(PILE.y),
            width: vh(PILE.w),
            height: vh(PILE.h),
            touchAction: "none",
          }}
          onPointerDown={startDrag}
        />
      )}

      {/* 在不在画面里的探针：盖住衣服堆到挂杆这一块 */}
      <div
        ref={anchorRef}
        className="pointer-events-none absolute"
        style={{ left: vh(1440), top: vh(660), width: vh(820), height: vh(1060) }}
      />

      {/* 引导 1：衣服还没挂完——写在衣架中间的空当里（衣服堆上方、挂着的衣服下方），箭头往上指挂钩 */}
      <HandHint
        show={hintOn && inView && !done && nextPiece >= 0 && !drag}
        text={t("life.guide.hang")}
        rotate={6}
        arrowH="7vh"
        fontSize="2.8vh"
        maxWidth="22vh"
        tag
        bold
        textSide="left"
        /* 字在左、箭头在右：按右边缘定位，中英文字长不一样箭头也钉在右边那几个挂钩下面 */
        style={{ left: vh(2020), top: vh(1000), translate: "-100% 0" }}
      />
      {/* 引导 2：挂满了、还没换装——写在衣架上方的空墙上，箭头斜着指向右下的小羊 */}
      <HandHint
        show={hintOn && inView && canDress && whiteSlot >= 0 && !dressDrag}
        text={t("life.guide.dress")}
        rotate={135}
        arrowH="7vh"
        fontSize="2.8vh"
        maxWidth="20vh"
        tag
        bold
        textSide="left"
        style={{ left: vh(2020), top: vh(300), translate: "-100% 0" }}
      />
    </>
  );
}

/* ---------------- 浇水彩蛋（hover 水壶，它自己飞去浇花） ---------------- */

const KETTLE = { x: 11007, y: 1462, w: 332, h: 186 };
/** 浇水位：蓝凳盆栽的左上方，壶嘴正对着叶子（按用户示意图定位） */
const KETTLE_POUR = { x: 11056, y: 861 };

/** 从壶嘴落下的一小串水珠（跟着水壶一起转） */
function WaterStream() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${82 + (i % 3) * 4}%`,
            top: "16%",
            width: vh(8 + (i % 3) * 3),
            height: vh(12 + (i % 2) * 4),
            background: "rgba(140, 205, 230, 0.9)",
            boxShadow: "0 0 5px rgba(170, 225, 245, 0.7)",
          }}
          animate={{
            x: [0, 14, 26],
            y: [0, 36, 88],
            opacity: [0, 1, 0],
            scaleY: [0.5, 1.15, 1.4],
          }}
          transition={{
            duration: 0.5,
            delay: i * 0.07,
            repeat: Infinity,
            ease: "easeIn",
          }}
        />
      ))}
    </>
  );
}

/**
 * 隐藏彩蛋，无任何指引：鼠标碰到地上的水壶，它自己飞到
 * 蓝凳盆栽的左上方，倾一倾壶身浇一小股水，浇完飞回原位。
 * 绿植本体不动。
 */
function Watering({ interactive }: { interactive: boolean }) {
  const [phase, setPhase] = useState<"rest" | "up" | "pour" | "back">("rest");

  // 到位后开始倒水，一小会儿后收工回家
  useEffect(() => {
    if (phase !== "pour") return;
    playWater();
    const t = window.setTimeout(() => setPhase("back"), 1400);
    return () => window.clearTimeout(t);
  }, [phase]);

  const atPour = phase === "up" || phase === "pour";

  return (
    <>
      <motion.div
        className="pointer-events-none absolute select-none"
        style={{
          left: 0,
          top: 0,
          width: vh(KETTLE.w),
          height: vh(KETTLE.h),
          // 以壶身中后部为轴倾斜，壶嘴朝下倒
          transformOrigin: "40% 55%",
          zIndex: 5,
        }}
        initial={false}
        animate={{
          x: vh(atPour ? KETTLE_POUR.x : KETTLE.x),
          y: vh(atPour ? KETTLE_POUR.y : KETTLE.y),
          rotate: phase === "pour" ? 20 : 0,
        }}
        transition={
          phase === "up"
            ? { duration: 0.6, ease: [0.33, 1, 0.68, 1] }
            : phase === "back"
              ? { duration: 0.55, ease: [0.45, 0, 0.55, 1] }
              : { type: "spring", stiffness: 240, damping: 18 }
        }
        onAnimationComplete={() => {
          if (phase === "up") setPhase("pour");
          else if (phase === "back") setPhase("rest");
        }}
      >
        <img
          src="/assets/life/seg03/kettle.webp"
          alt=""
          draggable={false}
          className="h-full w-full max-w-none"
        />
        {phase === "pour" && <WaterStream />}
      </motion.div>

      {/* 触发区：钉在水壶原位，飞走期间失效，回来后可再摸 */}
      <div
        className="absolute"
        style={{
          left: vh(KETTLE.x),
          top: vh(KETTLE.y),
          width: vh(KETTLE.w),
          height: vh(KETTLE.h),
          pointerEvents: interactive && phase === "rest" ? "auto" : "none",
        }}
        onMouseEnter={() => interactive && phase === "rest" && setPhase("up")}
      />
    </>
  );
}

/**
 * 房间长卷：无缝平铺的墙面地板打底，分段的场景素材依次贴上去。
 * 当前已接入段01（衣帽区）；后续段落到位后按同样方式往右拼。
 * 互动物件的分层素材没到之前，站点仍用虚线框叠在画面上示意。
 */

/* ---------------- 站点热区 + 停下来时出的手绘引导 ---------------- */

/**
 * 引导摆在站点哪：
 * - 软木板贴着屏幕上沿，只能从左边指过来，压低一点避开吊灯；
 * - 圆桌上方是咖啡机和台面，字抬到冰箱顶上的空墙，箭头斜着往左下指回桌子；
 * - 蜡烛架子上头是空墙，正上方指下来。
 */
/** 站点箭头的大小（以前 12vh 太抢，现在只要能看见指哪就行） */
const SPOT_ARROW = "8vh";
/**
 * 站点引导：箭头指到哪（相对站点热区的位置 + 朝向，素材原本朝上）+ 一句写在小纸签上的话放箭头哪一边。
 * 不指热区中心，指具体那件东西——散落的碎片 / 桌上的酒瓶 / 小羊蜡烛罐。
 */
const SPOT_HINT: Record<
  string,
  { rotate: number; flip?: boolean; at: React.CSSProperties; text: DictKey; textSide: "left" | "right" | "above" | "below"; maxWidth: string }
> = {
  /* 软木板右边缘，箭头指向左边散落的碎片；纸签挂在箭头下面、骑在板子边上（右边是花瓶和搁板，放不下） */
  photo: {
    rotate: -90,
    at: { left: "calc(100% - 3vh)", top: "34%" },
    text: "life.guide.photo",
    textSide: "below",
    maxWidth: "21vh",
  },
  /* 桌子左端那三瓶的正上方，箭头指下去，字在箭头上面（字比箭头宽，整体按中线对齐，箭头才不会被字挤偏） */
  drink: {
    rotate: 180,
    at: { left: `calc(12% + ${SPOT_ARROW} / 2)`, bottom: "100%", marginBottom: "0.5vh", translate: "-50% 0" },
    text: "life.guide.drink",
    textSide: "above",
    maxWidth: "28vh",
  },
  /* 小羊蜡烛罐正上方，箭头指下去（镜像一下让弧弯向字那边）；上面就是屏幕顶，字放箭头左边那块空墙（冰箱顶上方） */
  candle: {
    rotate: 180,
    flip: true,
    at: { right: `calc(34% - ${SPOT_ARROW})`, bottom: "100%", marginBottom: "0.5vh" },
    text: "life.guide.candle",
    textSide: "left",
    maxWidth: "34vh",
  },
};

function StationSpot({
  station: s,
  done,
  interactive,
  hintOn,
  onOpen,
}: {
  station: LifeStation;
  done: boolean;
  interactive: boolean;
  hintOn: boolean;
  onOpen: (station: LifeStation, el: HTMLElement) => void;
}) {
  const { pick, t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  /* 滚到画面里就出箭头（不等人停下来）；鼠标已经放上去了就不用指了 */
  const inView = useInView(ref, { amount: 0.6 });
  const [hovered, setHovered] = useState(false);
  const spot = SPOT_HINT[s.id] ?? SPOT_HINT.candle;
  return (
    <div
      ref={ref}
      data-station={s.id}
      role="button"
      tabIndex={0}
      aria-label={pick(s.name)}
      className={`group absolute outline-none ${interactive ? "cursor-pointer" : "pointer-events-none"}`}
      style={{
        left: `${s.left}vh`,
        top: `${s.top}vh`,
        width: `${s.width}vh`,
        height: `${s.height}vh`,
        /* 拼图碎片 / 桌上东西的精灵带 z-index，箭头和纸签要压在它们上面 */
        zIndex: 15,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        /* 做完的站点再点就不推近了，没别的反应 */
        if (!interactive || done) return;
        onOpen(s, e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (interactive && !done && (e.key === "Enter" || e.key === " ")) {
          onOpen(s, e.currentTarget);
        }
      }}
    >
      {/* 没做完 + 滚进画面 → 一支小箭头指着那件东西 + 纸签上一句"要做什么"（怎么做推近了再说） */}
      <HandHint
        show={!done && interactive && hintOn && inView && !hovered}
        text={t(spot.text)}
        textSide={spot.textSide}
        maxWidth={spot.maxWidth}
        fontSize="2.8vh"
        tag
        rotate={spot.rotate}
        flip={spot.flip}
        arrowH={SPOT_ARROW}
        bold
        style={spot.at}
      />
    </div>
  );
}

export default function RoomStage({ room, interactive, music, onToggleMusic, guide, onOpen, onChecklist, listKick, onTeeDone, photoActive, onPhotoDone, drinkActive, onDrinkDone, candleActive, onCandleDone, onDressed, paint, onPaintEnd, onEnterLab }: Props) {
  const { t } = useLanguage();
  // 挂杆感应区内的鼠标位置（素材像素坐标），离开时归位到远处
  const swingMouseX = useMotionValue(MOUSE_AWAY);

  /* CHEERS 吊灯：hover 灯体时亮起（光锥淡入），移开熄灭 */
  const [cheersLit, setCheersLit] = useState(false);

  /* LAB 门直通：任务没完成也能点门——灯牌亮、门开，镜头推进门洞进 LAB。
     瞬时状态不持久化，从 LAB 返回时门恢复关闭，任务进度不受影响 */
  const [doorOpen, setDoorOpen] = useState(false);
  /** 门热区悬停（气泡显隐；项目里 group-hover 变体失效，改状态驱动） */
  const [labHover, setLabHover] = useState(false);
  const labOpened = room.candle || doorOpen;
  const labNavTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(labNavTimer.current), []);
  const enterLab = (e: React.MouseEvent) => {
    if (doorOpen) return;
    // 热区点击后立刻卸载，位置要在此刻取好（之后元素就不在文档里了）
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    playLightOn();
    setDoorOpen(true);
    // 等灯牌亮、门开完（0.25s 延迟 + 0.45s 开门），再交给镜头推进门洞
    labNavTimer.current = window.setTimeout(() => onEnterLab(rect), 820);
  };

  /* 换装彩蛋：播放中 / 已换装时，镜子+小羊+影子由动画帧或定格接管 */
  const [dressPlaying, setDressPlaying] = useState(false);
  const dressActive = dressPlaying || room.dressed;
  const canDress =
    isStationDone(room, "tee") && !room.dressed && !dressPlaying && interactive;

  // 白T变成可拖时预热动画帧，触发时不卡顿
  useEffect(() => {
    if (!canDress) return;
    for (let i = 0; i < DRESS_FRAMES; i++) {
      const im = new Image();
      im.src = dressFrameSrc(i);
      im.decode?.().catch(() => {});
    }
  }, [canDress]);

  /* 作画动画：play 时帧接管小羊+画架；photo 完成后定格最后一帧 */
  const paintStill = isStationDone(room, "photo") && paint === "idle";
  const paintHidden = paint === "play" || paintStill;

  // 推近软木板开拼时预热作画帧，拉回后播放不卡顿
  useEffect(() => {
    if (!photoActive || isStationDone(room, "photo")) return;
    for (let i = 0; i < PAINT_FRAMES; i++) {
      const im = new Image();
      im.src = paintFrameSrc(i);
      im.decode?.().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoActive]);

  return (
    <>
      {/* 墙面 + 地板：无缝平铺，长卷多长它就铺多长；右边多铺一截，长卷尽头就算和视口边差一点也不露底 */}
      <div
        className="absolute inset-y-0 left-0"
        style={{
          right: "-10vw",
          backgroundImage: "url(/assets/life/room-bg-tile.webp)",
          backgroundSize: "auto 100%",
          backgroundRepeat: "repeat-x",
        }}
      />

      {/* 窗户：帧序列动画（窗景 + 小鸟） */}
      <WindowAnim />

      {/* 段01 · 衣帽区：分层元素依次叠放，部分带常驻小动画。
          换装后：镜子/小羊/影子交给动画帧或定格，帽子被戴走淡出 */}
      {seg01Layers
        .filter(
          (l) =>
            !(dressActive && ["mirror", "sheep", "sheep-shadow"].includes(l.src)),
        )
        .map((layer, i) =>
          layer.src === "hat" ? (
            <motion.img
              key={`${layer.src}-${i}`}
              src={`/assets/life/seg01/${layer.src}.webp`}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: vh(layer.x),
                top: vh(layer.y),
                width: vh(layer.w),
                height: vh(layer.h),
              }}
              animate={{ opacity: dressActive ? 0 : 1 }}
              transition={{ duration: 0.5 }}
            />
          ) : layer.src.startsWith("note-") ? (
            /* 唱片机上飘的音符：唱片转起来才有 */
            <motion.div
              key={`${layer.src}-${i}`}
              className="pointer-events-none absolute inset-0"
              initial={false}
              animate={{ opacity: music ? 1 : 0 }}
              transition={{ duration: 0.6 }}
            >
              <SceneSprite layer={layer} />
            </motion.div>
          ) : layer.hoverSwing ? (
            <SwingSprite key={`${layer.src}-${i}`} layer={layer} mouseX={swingMouseX} />
          ) : layer.hoverPendulum ? (
            <PendulumSprite
              key={`${layer.src}-${i}`}
              layer={layer}
              onClick={
                layer.src === "list" && interactive ? onChecklist : undefined
              }
              {...(layer.src === "list" ? { kick: listKick } : {})}
            />
          ) : (
            <SceneSprite key={`${layer.src}-${i}`} layer={layer} />
          ),
        )}

      {/* 引导 0：第一次进门，指一下墙上挂着的清单 */}
      <HandHint
        show={guide.entry && interactive}
        text={t("life.guide.list")}
        rotate={-80}
        arrowH="8vh"
        fontSize="2.8vh"
        bold
        textSide="right"
        style={{ left: vh(1200), top: vh(292) }}
      />

      {/* 段02 · 起居区：软木板、单人沙发、小圆桌、吊灯、落地植物。
          挂着的（吊灯、帆布袋）和钉着的（相片、贴纸）鼠标碰到会荡两下。
          海报碎片由 PhotoPuzzle 接管（紧贴软木板之上，保持原叠放层级） */}
      {seg02Layers.map((layer, i) =>
        layer.src === "board" ? (
          <Fragment key={`s2-${layer.src}-${i}`}>
            <SceneSprite layer={layer} />
            <PhotoPuzzle
              done={isStationDone(room, "photo")}
              active={photoActive}
              onDone={onPhotoDone}
            />
          </Fragment>
        ) : layer.src === "tape-photo-b" && isStationDone(room, "photo") ? (
          // 拼图完成后这条胶带由 PhotoPuzzle 贴到海报前面（70% 透明度）
          null
        ) : (layer.src === "painter-sheep" || layer.src === "easel") &&
          paintHidden ? (
          // 作画动画播放中/定格后，小羊+画架由帧序列接管
          null
        ) : layer.hoverPendulum ? (
          <PendulumSprite key={`s2-${layer.src}-${i}`} layer={layer} />
        ) : (
          <SceneSprite key={`s2-${layer.src}-${i}`} layer={layer} />
        ),
      )}

      {/* 作画动画：拼图完成拉回后，小羊原位画出瓶花；播完定格（刷新仍在） */}
      {(paint === "wait" || paint === "play") && (
        <PaintAnim playing={paint === "play"} onEnd={onPaintEnd} />
      )}
      {paintStill && (
        <img
          src={paintFrameSrc(PAINT_FRAMES - 1)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            left: vh(PAINT_RECT.x),
            top: vh(PAINT_RECT.y),
            width: vh(PAINT_RECT.w),
            height: vh(PAINT_RECT.h),
          }}
        />
      )}

      {/* 段03 · 厨房 + 蜡烛角 + LAB 门：
          吊挂的（橙吊灯、厨具、CHEERS 牌、LAB 灯牌）鼠标碰到会荡两下；
          厨房柜的布帘碰到会被撩起来；
          白圆桌上的三瓶/纸杯/水果刀由 DrinkMixer 接管（调酒互动） */}
      {seg03Layers.map((layer, i) =>
        layer.src === "kettle" ||
        DRINK_TAKEN.has(layer.src) ? null : layer.src === "lemon-plate" ? (
          <Fragment key={`s3-${layer.src}-${i}`}>
            <SceneSprite layer={layer} />
            <DrinkMixer
              drink={room.drink}
              active={drinkActive}
              onDone={onDrinkDone}
            />
          </Fragment>
        ) : layer.src === "pendant-light" ? (
          // CHEERS 吊灯的光锥：hover 灯体时淡入
          <motion.img
            key={`s3-${layer.src}`}
            src={layerUrl(layer)}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              left: vh(layer.x),
              top: vh(layer.y),
              width: vh(layer.w),
              height: vh(layer.h),
            }}
            initial={false}
            animate={{ opacity: cheersLit ? 1 : 0 }}
            transition={{ duration: cheersLit ? 0.25 : 0.5 }}
          />
        ) : layer.src === "pendant-cheers" ? (
          // 灯体不摇摆，只负责 hover 亮灯
          <img
            key={`s3-${layer.src}`}
            src={layerUrl(layer)}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              left: vh(layer.x),
              top: vh(layer.y),
              width: vh(layer.w),
              height: vh(layer.h),
            }}
            onMouseEnter={() => {
              setCheersLit(true);
              playLightOn();
            }}
            onMouseLeave={() => {
              setCheersLit(false);
              playLightOff();
            }}
          />
        ) : layer.src === "fridge" ? (
          <FridgeHover key={`s3-${layer.src}`} layer={layer} />
        ) : layer.src === "candle-wax" ? (
          // 白蜡烛（火苗+蜡+烛台）与点蜡烛互动整组交给 CandleLight
          <CandleLight
            key="s3-candle-light"
            lit={isStationDone(room, "candle")}
            active={candleActive}
            onDone={onCandleDone}
          />
        ) : layer.src === "candle-holder" || layer.src === "aroma-candle" ? null : layer.src === "lab-sign" ? (
          // LAB 灯牌：点蜡烛后亮灯（不摇摆）
          <div
            key="s3-lab-sign"
            className="pointer-events-none absolute select-none"
            style={{
              left: vh(layer.x),
              top: vh(layer.y),
              width: vh(layer.w),
              height: vh(layer.h),
            }}
          >
            <img
              src={layerUrl(layer)}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full max-w-none"
            />
            <motion.img
              src="/assets/life/seg03/lab-sign-lit.webp"
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full max-w-none"
              initial={false}
              animate={{ opacity: labOpened ? 1 : 0 }}
              transition={{
                // 蜡烛流程等演完再亮；点门直通则立即亮
                delay: room.candle ? 1.2 : 0,
                duration: 0.5,
              }}
            />
          </div>
        ) : layer.src === "lab-door" ? (
          // LAB 门：点蜡烛后换成敞开的门（带门后暖光），点门进 LAB
          <Fragment key="s3-lab-door">
            <motion.img
              src={layerUrl(layer)}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: vh(layer.x),
                top: vh(layer.y),
                width: vh(layer.w),
                height: vh(layer.h),
              }}
              initial={false}
              animate={{ opacity: labOpened ? 0 : 1 }}
              transition={{ delay: room.candle ? 1.6 : doorOpen ? 0.25 : 0, duration: 0.45 }}
            />
            <motion.img
              src="/assets/life/seg03/lab-door-open.webp"
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: vh(LAB_OPEN.x),
                top: vh(LAB_OPEN.y),
                width: vh(LAB_OPEN.w),
                height: vh(LAB_OPEN.h),
              }}
              initial={false}
              animate={{ opacity: labOpened ? 1 : 0 }}
              transition={{ delay: room.candle ? 1.6 : doorOpen ? 0.25 : 0, duration: 0.45 }}
            />
          </Fragment>
        ) : layer.hoverPendulum ? (
          <PendulumSprite key={`s3-${layer.src}-${i}`} layer={layer} />
        ) : layer.hoverLift ? (
          <LiftSprite key={`s3-${layer.src}-${i}`} layer={layer} interactive={interactive} />
        ) : (
          <SceneSprite key={`s3-${layer.src}-${i}`} layer={layer} />
        ),
      )}


      {/* 换装彩蛋：播放中放帧序列，播完定格最后一帧（穿好白T牛仔裤照镜子） */}
      {dressPlaying && (
        <DressAnim
          onEnd={() => {
            onDressed();
            setDressPlaying(false);
          }}
        />
      )}
      {room.dressed && !dressPlaying && (
        <img
          src="/assets/life/seg01/dress-still.webp"
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            left: vh(DRESS_RECT.x),
            top: vh(DRESS_RECT.y),
            width: vh(DRESS_RECT.w),
            height: vh(DRESS_RECT.h),
          }}
        />
      )}

      {/* 挂衣服互动：从衣服堆拖到挂杆，挂满六件完成 tee 任务；
          之后白T可以拖给小羊换装（彩蛋） */}
      <HangClothes
        done={isStationDone(room, "tee")}
        interactive={interactive}
        hintOn={interactive && guide.hints}
        mouseX={swingMouseX}
        onDone={onTeeDone}
        canDress={canDress}
        dressActive={dressActive}
        onDress={() => setDressPlaying(true)}
      />

      {/* 唱片机：转动的唱片 + 唱臂 */}
      <RecordPlayer playing={music} interactive={interactive} onToggle={onToggleMusic} />

      {/* 柜子的推拉门：可以拖着左右滑 */}
      <CabinetDoor interactive={interactive} />

      {/* 浇水彩蛋：鼠标碰到地上的水壶，它自己飞去给蓝凳上的绿植浇水 */}
      <Watering interactive={interactive} />

      {/* 挂杆感应区：鼠标划过时拨动衣服/衣挂 */}
      <div
        className="absolute"
        style={{
          left: vh(SWING_ZONE.x),
          top: vh(SWING_ZONE.y),
          width: vh(SWING_ZONE.w),
          height: vh(SWING_ZONE.h),
        }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = SWING_ZONE.x + ((e.clientX - r.left) / r.width) * SWING_ZONE.w;
          swingMouseX.set(px);
        }}
        onMouseLeave={() => swingMouseX.set(MOUSE_AWAY)}
      />

      {/* 互动站点（拼图 / 小桌 / 蜡烛）；tee 是场景内挂衣互动，不走这里 */}
      {lifeStations
        .filter((s) => s.id !== "tee")
        .map((s) => (
          <StationSpot
            key={s.id}
            station={s}
            done={isStationDone(room, s.id)}
            interactive={interactive}
            hintOn={guide.hints}
            onOpen={onOpen}
          />
        ))}

      {/* LAB 门直通：任务没完成时点关着的门，也会亮灯牌开门进 LAB */}
      {!room.candle && !doorOpen && interactive && (
        <div
          className="absolute"
          style={{
            left: vh(11654),
            top: vh(319),
            width: vh(704),
            height: vh(1106),
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={enterLab}
            onMouseEnter={() => setLabHover(true)}
            onMouseLeave={() => setLabHover(false)}
            aria-label={t("life.lab.door")}
            className="block h-full w-full cursor-pointer"
          >
            <span
              className="font-hand pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-4 py-1 text-lg text-neutral-800 shadow-md transition-opacity duration-300"
              style={{ opacity: labHover ? 1 : 0 }}
            >
              {t("life.lab.door")} →
            </span>
          </button>
        </div>
      )}

      {/* LAB 入口：点蜡烛后门开着，点门进 LAB */}
      <AnimatePresence>
        {room.candle && (
          <motion.div
            className="absolute"
            style={{
              left: vh(11654),
              top: vh(319),
              width: vh(704),
              height: vh(1106),
              zIndex: 10,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 2.1, duration: 0.4 }}
          >
            <button
              type="button"
              onClick={(e) => {
                setLabHover(false); // 推镜头时气泡别跟着放大
                onEnterLab(e.currentTarget.getBoundingClientRect());
              }}
              onMouseEnter={() => setLabHover(true)}
              onMouseLeave={() => setLabHover(false)}
              aria-label={t("life.lab.door")}
              className="block h-full w-full cursor-pointer"
            >
              <span
                className="font-hand pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-4 py-1 text-lg text-neutral-800 shadow-md transition-opacity duration-300"
                style={{ opacity: labHover ? 1 : 0 }}
              >
                {t("life.lab.door")} →
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
