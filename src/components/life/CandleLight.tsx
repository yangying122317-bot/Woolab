import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { TargetAndTransition } from "framer-motion";
import HintPing from "./HintPing";
import { playLightOn } from "../../audio/sfx";

/**
 * 点蜡烛互动（candle 任务）：
 * 推近蜡烛角后点白蜡烛，白蜡烛被"拿起来"——离开烛台，
 * 悬到小羊香薰蜡烛的烛芯旁，倾斜着把火凑上去；烛芯先冒一小簇火，
 * 白蜡烛放回烛台后火苗长大成完整火苗（常驻，刷新仍亮）。
 * candle-wax / candle-holder / aroma-candle 图层和火苗由本组件接管渲染
 * （小羊蜡烛的火苗画在罐子后面）。
 * 坐标全部是长卷素材像素（画板高 1800px = 100vh）。
 */

const vh = (px: number) => `${px / 18}vh`;
const url = (name: string) => `/assets/life/seg03/${name}.webp`;

/** 白蜡烛整图（蜡体+火苗一体，补充素材/蜡烛.png） */
const GROUP = { x: 11148, y: 450, w: 122, h: 214 };

/** 凑火姿势（参考图2）：蜡烛几乎横过来悬在罐口上方，火苗尖够到烛芯尖（11396, 437） */
const POSE = { x: 93, y: -95, rot: 72 };
/** 借火全程时长（拿起 → 凑火 → 停一拍 → 放回） */
const LIGHT_MS = 2400;

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

/** 拿起 → 移到烛芯旁凑火 → 停一拍 → 放回 */
const LIGHTING_KF: TargetAndTransition = {
  x: ["0vh", vh(14), vh(POSE.x), vh(POSE.x), vh(14), "0vh"],
  y: ["0vh", vh(-95), vh(POSE.y), vh(POSE.y), vh(-95), "0vh"],
  rotate: [0, 14, POSE.rot, POSE.rot, 14, 0],
  transition: {
    duration: LIGHT_MS / 1000,
    times: [0, 0.2, 0.4, 0.62, 0.84, 1],
    ease: "easeInOut",
  },
};

const REST: TargetAndTransition = { x: "0vh", y: "0vh", rotate: 0 };

/** 烛芯火苗：先冒一小簇，白蜡烛放回后长大 */
const GROW_KF: TargetAndTransition = {
  opacity: [0, 1, 1, 1],
  scale: [0.2, 0.42, 0.42, 1],
  transition: { duration: 1.7, times: [0, 0.15, 0.62, 1], ease: "easeInOut" },
};

interface Props {
  /** 已点亮（room.candle，持久态） */
  lit: boolean;
  /** 镜头已推近蜡烛角 → 可以互动 */
  active: boolean;
  /** 点亮完成（白蜡烛放回后盖章） */
  onDone: () => void;
}

export default function CandleLight({ lit, active, onDone }: Props) {
  /** 借火动画进行中 */
  const [lighting, setLighting] = useState(false);
  /** 小羊蜡烛的火苗（凑火到位那一刻点起来） */
  const [flame, setFlame] = useState(lit);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // 重新过一晚：熄掉
  useEffect(() => {
    if (!lit) {
      setLighting(false);
      setFlame(false);
    }
  }, [lit]);

  const light = () => {
    if (!active || lit || lighting || flame) return;
    setLighting(true);
    later(() => {
      playLightOn();
      setFlame(true); // 凑火到位，烛芯先冒一小簇
    }, LIGHT_MS * 0.46);
    later(() => setLighting(false), LIGHT_MS);
    later(onDone, LIGHT_MS + 700);
  };

  return (
    <>
      {/* 小羊蜡烛的火苗：画在罐子后面，从罐口探出；先冒一小簇，白蜡烛放回后长大 */}
      <AnimatePresence>
        {flame && (
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
            animate={lit ? { opacity: 1, scale: 1 } : GROW_KF}
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

      {/* 白蜡烛整图：点它借火，被拿起来凑到烛芯旁 */}
      <motion.img
        src={url("candle-lit")}
        alt=""
        draggable={false}
        className={`absolute max-w-none select-none ${
          active && !flame && !lighting ? "cursor-pointer" : "pointer-events-none"
        }`}
        style={{
          left: vh(GROUP.x),
          top: vh(GROUP.y),
          width: vh(GROUP.w),
          height: vh(GROUP.h),
          transformOrigin: "50% 50%",
          zIndex: 6,
        }}
        initial={false}
        animate={lighting ? LIGHTING_KF : REST}
        onClick={light}
      />

      {/* 借火提示 */}
      {active && !flame && !lighting && (
        <div
          className="pointer-events-none absolute"
          style={{ left: vh(GROUP.x + GROUP.w * 0.55), top: vh(GROUP.y + 125) }}
        >
          <HintPing />
        </div>
      )}
    </>
  );
}
