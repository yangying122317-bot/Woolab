import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import type { TargetAndTransition } from "framer-motion";
import HandHint from "./HandHint";
import { playLightOn } from "../../audio/sfx";

/**
 * 点蜡烛互动（candle 任务）：
 * 推近蜡烛角后，把白蜡烛从烛台上拖起来、拖到小羊香薰蜡烛的罐口——
 * 拖得越远蜡烛越倾斜，火苗尖一靠近烛芯就被"吸"过去摆成凑火的姿势，烛芯先冒一小簇火；
 * 松手后白蜡烛自己弹回烛台，小羊蜡烛的火长大成完整火苗（常驻，刷新仍亮）。
 * 没凑到就松手，白蜡烛弹回原位，可以再试。
 * candle-wax / candle-holder / aroma-candle 图层和火苗由本组件接管渲染
 * （小羊蜡烛的火苗画在罐子后面）。
 * 坐标全部是长卷素材像素（画板高 1800px = 100vh）。
 */

const vh = (px: number) => `${px / 18}vh`;
const url = (name: string) => `/assets/life/seg03/${name}.webp`;

/** 白蜡烛整图（蜡体+火苗一体，补充素材/蜡烛.png） */
const GROUP = { x: 11148, y: 450, w: 122, h: 214 };

/** 凑火姿势（参考图2）：蜡烛几乎横过来悬在罐口上方，火苗尖够到烛芯尖（11396, 437）。x / y 是相对烛台位置的位移 */
const POSE = { x: 93, y: -95, rot: 72 };
/** 拖到离凑火位这么近（长卷像素）就吸过去 */
const SNAP_R = 34;
/** 吸住后拖出这么远才松开磁吸 */
const UNSNAP_R = 70;
/** 拖起来后最多倾斜到 POSE.rot：按拖离烛台的距离线性给，走到凑火位那么远就完全倾斜 */
const POSE_DIST = Math.hypot(POSE.x, POSE.y);
/** 松手回烛台的时长 */
const RETURN_MS = 700;

/** 小羊香薰蜡烛罐（画在自己火苗前面） */
const AROMA = { x: 11286, y: 437, w: 200, h: 221 };
/** 小羊蜡烛的火苗（点亮后常驻）：从罐口后面探出来，底部锚在烛芯尖（11396, 466） */
const AROMA_FLAME = { x: 11365, y: 374, w: 62, h: 92 };

/** 火苗轻微摇曳（两处火苗共用；模块级常量，避免重渲染时动画重启） */
const FLICKER: TargetAndTransition = {
  rotate: [0, 3, -2, 2, 0],
  scaleY: [1, 1.05, 0.97, 1.03, 1],
  transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
};

/** 烛芯火苗：先冒一小簇，白蜡烛放回后长大 */
const SPARK: TargetAndTransition = {
  opacity: 1,
  scale: 0.42,
  transition: { duration: 0.3, ease: "easeOut" },
};
const GROW: TargetAndTransition = {
  opacity: 1,
  scale: 1,
  transition: { duration: 0.9, ease: "easeInOut" },
};

const SNAP_SPRING = { type: "spring", stiffness: 420, damping: 30 } as const;
/** 借火提示箭头的边长（长卷像素） */
const ARROW_PX = 100;

interface Props {
  /** 已点亮（room.candle，持久态） */
  lit: boolean;
  /** 镜头已推近蜡烛角 → 可以互动 */
  active: boolean;
  /** 点亮完成（白蜡烛放回后盖章） */
  onDone: () => void;
}

export default function CandleLight({ lit, active, onDone }: Props) {
  /** 正拖着白蜡烛 */
  const [dragging, setDragging] = useState(false);
  /** 松手后白蜡烛正在飞回烛台 */
  const [returning, setReturning] = useState(false);
  /** 小羊蜡烛的火苗：凑火到位那一刻点起来；spark = 小簇，grow = 放回后长大 */
  const [flame, setFlame] = useState<"off" | "spark" | "grow">(lit ? "grow" : "off");
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  /* 白蜡烛相对烛台的位移 / 倾斜（单位：元素自己坐标系里的 px；长卷像素 × pxPerUnit） */
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rot = useMotionValue(0);
  const el = useRef<HTMLImageElement>(null);
  /** 这次拖动的起点、缩放换算（推近时整个房间被放大，指针移 1px 蜡烛只该走 1/scale px） */
  const grab = useRef<{ px: number; py: number; ox: number; oy: number; k: number; unit: number } | null>(null);
  const snapped = useRef(false);

  // 重新过一晚：熄掉
  useEffect(() => {
    if (!lit) {
      setFlame("off");
      setDragging(false);
      setReturning(false);
      snapped.current = false;
      x.set(0);
      y.set(0);
      rot.set(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit]);

  const canGrab = active && !lit && flame !== "grow" && !returning;

  const onDown = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!canGrab || !el.current) return;
    e.preventDefault();
    const rect = el.current.getBoundingClientRect();
    // 元素自己 1 个长卷像素 = 多少 px；屏幕上看到的又被祖先放大了 k 倍
    const unit = window.innerHeight / 1800;
    const k = rect.width / (GROUP.w * unit) || 1;
    grab.current = { px: e.clientX, py: e.clientY, ox: x.get(), oy: y.get(), k, unit };
    el.current.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onMove = (e: ReactPointerEvent<HTMLImageElement>) => {
    const g = grab.current;
    if (!g) return;
    // 指针位移换成长卷像素
    const dx = g.ox / g.unit + (e.clientX - g.px) / (g.k * g.unit);
    const dy = g.oy / g.unit + (e.clientY - g.py) / (g.k * g.unit);
    const toPose = Math.hypot(dx - POSE.x, dy - POSE.y);

    if (!snapped.current && toPose < SNAP_R) {
      // 火苗尖够到烛芯：吸到凑火位，烛芯冒一小簇火
      snapped.current = true;
      animate(x, POSE.x * g.unit, SNAP_SPRING);
      animate(y, POSE.y * g.unit, SNAP_SPRING);
      animate(rot, POSE.rot, SNAP_SPRING);
      if (flame === "off") {
        playLightOn();
        setFlame("spark");
      }
      return;
    }
    if (snapped.current) {
      if (toPose < UNSNAP_R) return;
      snapped.current = false;
    }
    x.set(dx * g.unit);
    y.set(dy * g.unit);
    // 拖得越远越倾斜，像手把它举起来凑过去
    rot.set(Math.min(Math.hypot(dx, dy) / POSE_DIST, 1) * POSE.rot);
  };

  const onUp = (e: ReactPointerEvent<HTMLImageElement>) => {
    if (!grab.current) return;
    grab.current = null;
    snapped.current = false;
    el.current?.releasePointerCapture(e.pointerId);
    setDragging(false);
    // 松手：白蜡烛飞回烛台；烛芯已经点着的话，火苗跟着长大，这件事就算做完了
    setReturning(true);
    const back = { duration: RETURN_MS / 1000, ease: [0.33, 1, 0.68, 1] } as const;
    animate(x, 0, back);
    animate(y, 0, back);
    animate(rot, 0, back);
    const done = flame !== "off";
    later(() => {
      setReturning(false);
      if (done) setFlame("grow");
    }, RETURN_MS);
    if (done) later(onDone, RETURN_MS + 900);
  };

  return (
    <>
      {/* 小羊蜡烛的火苗：画在罐子后面，从罐口探出；先冒一小簇，白蜡烛放回后长大 */}
      <AnimatePresence>
        {flame !== "off" && (
          <motion.div
            key="aroma-flame"
            className="pointer-events-none absolute"
            style={{
              left: vh(AROMA_FLAME.x),
              top: vh(AROMA_FLAME.y),
              width: vh(AROMA_FLAME.w),
              height: vh(AROMA_FLAME.h),
              transformOrigin: "50% 92%",
            }}
            initial={lit ? false : { opacity: 0, scale: 0.2 }}
            animate={lit ? { opacity: 1, scale: 1 } : flame === "spark" ? SPARK : GROW}
          >
            <motion.img
              src={url("candle-flame")}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full max-w-none"
              style={{ transformOrigin: "50% 90%" }}
              animate={FLICKER}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 小羊香薰蜡烛罐：压在自己的火苗前面 */}
      <img
        src={url("aroma-candle")}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          left: vh(AROMA.x),
          top: vh(AROMA.y),
          width: vh(AROMA.w),
          height: vh(AROMA.h),
        }}
      />

      {/* 白蜡烛整图：拖着它去罐口借火 */}
      <motion.img
        ref={el}
        src={url("candle-lit")}
        alt=""
        draggable={false}
        className={`absolute max-w-none select-none ${
          canGrab ? (dragging ? "cursor-grabbing" : "cursor-grab") : "pointer-events-none"
        }`}
        style={{
          left: vh(GROUP.x),
          top: vh(GROUP.y),
          width: vh(GROUP.w),
          height: vh(GROUP.h),
          transformOrigin: "50% 50%",
          zIndex: 6,
          touchAction: "none",
          x,
          y,
          rotate: rot,
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      {/* 借火提示：一支手绘箭头从左上方指着白蜡烛，暗示"拿它"（尺寸按长卷像素给，推近后是两倍大） */}
      <HandHint
        show={canGrab && !dragging && flame === "off"}
        rotate={150}
        arrowH={vh(ARROW_PX)}
        bold
        stroke={1.6}
        style={{ left: vh(GROUP.x - ARROW_PX + 8), top: vh(GROUP.y - ARROW_PX + 60), zIndex: 7 }}
      />
    </>
  );
}
