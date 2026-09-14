import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DRINKS, drinkOf } from "../../data/drinks";
import type { DrinkChoice } from "../../state/roomState";
import { useLanguage } from "../../i18n/LanguageContext";
import HandHint from "./HandHint";
import {
  playIceClink,
  playKnifeChop,
  playMailboxOpen,
  playPour,
} from "../../audio/sfx";
import { PAPER_TAG } from "./PaperTag";

/**
 * 白圆桌调酒互动（drink 任务）：
 * 镜头推近后四步走——选一瓶（发呆汽水/慢半拍茶/晚睡莓汁）→
 * 点案板上的刀切柠檬 → 点冰桶加冰 → 把瓶子拖到杯口倒进去。
 * 倒满后浮出饮料名，盖章；成品杯（对应色液体+柠檬片+冰块）留在原位。
 *
 * 玻璃杯全程不动，选中的瓶子滑到杯旁；瓶子无光圈提示，
 * hover 时摇两下并浮出名字气泡（推近期间不限步骤）。
 * 案板是两状态素材：整颗柠檬（默认）→ 点刀切开后换成两片切片。
 * 三瓶、白纸杯、案板、水果刀这些图层由本组件接管渲染（RoomStage 里过滤）。
 * 坐标全部是长卷素材像素（画板高 1800px = 100vh）。
 */

const vh = (px: number) => `${px / 18}vh`;
const url = (name: string) => `/assets/life/seg03/${name}.webp`;

/** 桌上三瓶的原位（沿用 seg03Layers 的坐标） */
const BOTTLE_POS: Record<string, { x: number; y: number; w: number; h: number }> = {
  "sauce-bottle": { x: 8669, y: 1189, w: 89, h: 230 },
  "soda-white": { x: 8769, y: 1189, w: 90, h: 221 },
  "soda-pink": { x: 8878, y: 1189, w: 85, h: 218 },
};

/** 白纸杯：固定在原位不动 */
const CUP = { w: 101, h: 121 };
const CUP_REST = { x: 8848, y: 1428 };
/** 手绘成品杯（drink-final-a/b/c，含柠檬片和冰块）：杯底对齐纸杯杯底 */
const FINAL = { x: 8843, y: 1374, w: 148, h: 175 };
/** 选中的瓶子站到杯子左边（瓶底与杯底对齐） */
const BESIDE_X = 8726;
const BESIDE_BOTTOM = CUP_REST.y + CUP.h;

/** 案板（含柠檬和刀的两状态素材：整颗 → 切开） */
const BOARD = { x: 8978, y: 1408, w: 546, h: 227 };

/** 柠檬片（补充素材立姿图，和"柠檬空杯"上画的同款）：
    从案板翻着飞到手绘片的真实位置，落地淡出、同帧换杯图 = 交叉淡化 */
const SLICE = { w: 107, h: 106 };
const SLICE_FROM = { x: 9130, y: 1425 };
const SLICE_CUP = { x: FINAL.x + 33, y: FINAL.y + 6, rot: 0 };

/** ICE 冰桶（补充素材）滑上桌的位置：一口咩和果盘之间、垫布上 */
const BUCKET = { x: 9279, y: 1186, w: 205, h: 237 };
/** 拖拽中的冰块（补充素材，两颗一组）：从桶里直接拖出，拖拽前不显示 */
const ICE = { w: 96, h: 111 };
/** 落点对准"柠檬冰块空杯"手绘冰块的真实位置（落定即换图） */
const ICE_LAND = { x: FINAL.x + 9, y: FINAL.y + 85, w: 81, h: 94 };

/** 倒饮料的判定点（杯口上方）与吸附半径 */
const POUR_AT = { x: 8898, y: 1360 };
const SNAP = 150;
/** 倒酒时瓶子的姿势（左上角坐标 + 旋转，瓶口正好悬在杯口上方） */
const POUR_POSE = { x: 8868, y: 1342, rot: -68 };

/** 分步箭头的边长（长卷像素；推近 2 倍后屏幕上约 11vh）和加粗倍数（推近后线得跟着粗） */
const ARROW_PX = 100;
const ARROW_H = vh(ARROW_PX);
const ARROW_STROKE = 1.6;
/** 分步纸签的中线 x（长卷像素）：一口咩纸箱左半上方，右边给加冰那步的箭头留出冰桶上空 */
const STEP_TAG_X = 9105;

/** 坐标换算基准区（整张白圆桌一带） */
const BOUNDS = { x: 8560, y: 1120, w: 1420, h: 610 };

type Step = "pick" | "lemon" | "ice" | "pour" | "pouring" | "label";

interface Props {
  /** 已调好的那瓶（null = 还没调） */
  drink: DrinkChoice | null;
  /** 镜头已推近白圆桌 → 可以互动 */
  active: boolean;
  /** 倒完、名字浮现后盖章 */
  onDone: (choice: DrinkChoice) => void;
}

export default function DrinkMixer({ drink, active, onDone }: Props) {
  const { t, pick } = useLanguage();
  const done = drink !== null;

  const [step, setStep] = useState<Step>("pick");
  const [choice, setChoice] = useState<DrinkChoice | null>(null);
  const [hovered, setHovered] = useState<DrinkChoice | null>(null);
  /** 柠檬阶段的小状态：整颗上板 → 切开 → 一片飞到杯沿 */
  const [chopped, setChopped] = useState(false);
  const [chopping, setChopping] = useState(false);
  const [iced, setIced] = useState(false);
  /** 飞行贴片落定 → 杯子换成对应的手绘中途状态图（柠檬空杯/柠檬冰块空杯） */
  const [sliceLanded, setSliceLanded] = useState(false);
  const [iceLanded, setIceLanded] = useState(false);
  /** 拖拽中的瓶子（左上角，素材像素） */
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  /** 拖拽中的冰块（左上角，素材像素）与松手后飞进杯的起点 */
  const [dragIce, setDragIce] = useState<{ x: number; y: number } | null>(null);
  const iceFrom = useRef({ x: BUCKET.x, y: BUCKET.y });
  const boundsRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // 重新过一晚：全部还原
  useEffect(() => {
    if (!done) {
      setStep("pick");
      setChoice(null);
      setChopped(false);
      setChopping(false);
      setIced(false);
      setSliceLanded(false);
      setIceLanded(false);
      setDrag(null);
      setDragIce(null);
    }
  }, [done]);

  /** 屏幕坐标 → 长卷素材像素（经过镜头缩放也成立） */
  const toArt = (clientX: number, clientY: number) => {
    const r = boundsRef.current!.getBoundingClientRect();
    const s = r.width / BOUNDS.w;
    return {
      x: BOUNDS.x + (clientX - r.left) / s,
      y: BOUNDS.y + (clientY - r.top) / s,
    };
  };

  /* ---------------- 各步动作 ---------------- */

  const pickBottle = (id: DrinkChoice) => {
    if (!active || done || step !== "pick") return;
    playMailboxOpen();
    setChoice(id);
    setStep("lemon");
  };

  const chop = () => {
    if (!active || step !== "lemon" || chopping) return;
    setChopping(true);
    later(() => {
      playKnifeChop();
      setChopped(true); // 案板贴图换成切开版 + 一片飞向杯沿
    }, 180);
    later(() => setChopping(false), 620);
    // 飞行片一触到杯沿就换图，不在半空停留
    later(() => setSliceLanded(true), 1000);
    later(() => setStep("ice"), 1150);
  };

  /** 从冰桶里拖出冰块到杯口（按下才出现冰块贴片，捏在指针中心） */
  const startIceDrag = (e: React.PointerEvent) => {
    if (!active || step !== "ice" || iced) return;
    e.preventDefault();
    const at = toArt(e.clientX, e.clientY);
    const grabX = ICE.w / 2;
    const grabY = ICE.h / 2;
    setDragIce({ x: at.x - grabX, y: at.y - grabY });

    const move = (ev: PointerEvent) => {
      const q = toArt(ev.clientX, ev.clientY);
      setDragIce({ x: q.x - grabX, y: q.y - grabY });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const q = toArt(ev.clientX, ev.clientY);
      const cx = q.x - grabX + ICE.w / 2;
      const cy = q.y - grabY + ICE.h / 2;
      setDragIce(null);
      if (Math.hypot(cx - POUR_AT.x, cy - POUR_AT.y) < SNAP) {
        iceFrom.current = { x: q.x - grabX, y: q.y - grabY };
        setIced(true); // 冰块从松手处滑进杯里
        later(playIceClink, 300);
        later(() => {
          setIceLanded(true); // 落定 → 杯子换成"柠檬+冰块空杯"
          setStep("pour");
        }, 750);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startDrag = (e: React.PointerEvent) => {
    if (!active || step !== "pour" || !choice) return;
    e.preventDefault();
    setHovered(null); // 拖走后不会触发 mouseleave，手动清掉气泡
    const rest = bottleRest(choice);
    const at = toArt(e.clientX, e.clientY);
    const grabX = at.x - rest.x;
    const grabY = at.y - rest.y;
    setDrag({ x: rest.x, y: rest.y });

    const move = (ev: PointerEvent) => {
      const q = toArt(ev.clientX, ev.clientY);
      setDrag({ x: q.x - grabX, y: q.y - grabY });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const q = toArt(ev.clientX, ev.clientY);
      const spec = BOTTLE_POS[drinkOf(choice).bottle];
      const cx = q.x - grabX + spec.w / 2;
      const cy = q.y - grabY + spec.h / 2;
      setDrag(null);
      if (Math.hypot(cx - POUR_AT.x, cy - POUR_AT.y) < SNAP) {
        setStep("pouring");
        later(playPour, 500);
        later(() => setStep("label"), 2300);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // 名字浮现一拍后盖章（done 置位后本组件切到持久态渲染）
  useEffect(() => {
    if (step !== "label" || !choice || done) return;
    const t1 = window.setTimeout(() => onDone(choice), 1300);
    return () => window.clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* ---------------- 派生渲染状态 ---------------- */

  /** 选中瓶的当前应处位置（选中后滑到杯子旁边站好） */
  const bottleRest = (id: DrinkChoice) => {
    const spec = BOTTLE_POS[drinkOf(id).bottle];
    if (choice === id && !done && step !== "pick") {
      return { x: BESIDE_X, y: BESIDE_BOTTOM - spec.h };
    }
    return { x: spec.x, y: spec.y };
  };

  /** 倒完（名字浮现起）→ 换成手绘成品杯，纸杯/贴片全部让位 */
  const showFinal = done || step === "label";
  /** 中途状态杯（柠檬空杯 / 柠檬冰块空杯），和成品杯同一画布、像素级对位 */
  const stagedCup = !showFinal && sliceLanded
    ? iceLanded ? "drink-cup-lemonice" : "drink-cup-lemon"
    : null;
  const finalDrink = drink ?? choice;

  /** 拖近杯口 → 杯口亮起光晕（瓶子或冰块） */
  const dragNear = drag && choice
    ? (() => {
        const spec = BOTTLE_POS[drinkOf(choice).bottle];
        return (
          Math.hypot(
            drag.x + spec.w / 2 - POUR_AT.x,
            drag.y + spec.h / 2 - POUR_AT.y,
          ) < SNAP
        );
      })()
    : dragIce
      ? Math.hypot(
          dragIce.x + ICE.w / 2 - POUR_AT.x,
          dragIce.y + ICE.h / 2 - POUR_AT.y,
        ) < SNAP
      : false;

  const stepHint =
    step === "pick"
      ? t("life.drink.step.pick")
      : step === "lemon"
        ? t("life.drink.step.lemon")
        : step === "ice"
          ? t("life.drink.step.ice")
          : step === "pour"
            ? t("life.drink.step.pour")
            : null;

  return (
    <>
      {/* 坐标换算基准（无视觉、不拦事件） */}
      <div
        ref={boundsRef}
        className="pointer-events-none absolute"
        style={{
          left: vh(BOUNDS.x),
          top: vh(BOUNDS.y),
          width: vh(BOUNDS.w),
          height: vh(BOUNDS.h),
        }}
      />

      {/* 白纸杯：柠檬片落到杯沿之前的原始状态 */}
      {!showFinal && !stagedCup && (
        <img
          src={url("paper-cup")}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            width: vh(CUP.w),
            height: vh(CUP.h),
            left: vh(CUP_REST.x),
            top: vh(CUP_REST.y),
            zIndex: 6,
          }}
        />
      )}

      {/* 中途状态杯：柠檬空杯 → 柠檬冰块空杯；倒酒时成品图从杯底升起（同画布无缝） */}
      {stagedCup && (
        <div
          className="pointer-events-none absolute select-none"
          style={{
            left: vh(FINAL.x),
            top: vh(FINAL.y),
            width: vh(FINAL.w),
            height: vh(FINAL.h),
            zIndex: 11,
          }}
        >
          <motion.img
            key={stagedCup}
            src={url(stagedCup)}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full max-w-none"
            style={{ transformOrigin: "40% 95%" }}
            initial={{ scale: 0.93 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 15 }}
          />
          {step === "pouring" && finalDrink && (
            <motion.img
              src={url(`drink-final-${finalDrink}`)}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full max-w-none"
              initial={{ clipPath: "inset(100% 0 0 0)" }}
              animate={{ clipPath: "inset(0% 0 0 0)" }}
              transition={{ duration: 1.6, ease: "easeInOut", delay: 0.45 }}
            />
          )}
        </div>
      )}

      {/* 手绘成品杯（含柠檬片和冰块）：倒完弹出，永久留在原位 */}
      {showFinal && finalDrink && (
        <motion.img
          src={url(`drink-final-${finalDrink}`)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            left: vh(FINAL.x),
            top: vh(FINAL.y),
            width: vh(FINAL.w),
            height: vh(FINAL.h),
            transformOrigin: "40% 95%",
            zIndex: 14,
          }}
          initial={done ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 17 }}
        />
      )}

      {/* 拖拽中的冰块（按住冰桶才出现，拖拽前不显示） */}
      {dragIce && (
        <img
          src={url("ice-cubes")}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none drop-shadow-lg"
          style={{
            left: vh(dragIce.x),
            top: vh(dragIce.y),
            width: vh(ICE.w),
            transform: "rotate(-8deg) scale(1.05)",
            zIndex: 30,
          }}
        />
      )}

      {/* 松手后冰块滑进杯里：到位淡出，与换杯图交叉淡化 */}
      <AnimatePresence>
        {iced && !iceLanded && !showFinal && (
          <motion.img
            key="ice-fly"
            src={url("ice-cubes")}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              left: vh(ICE_LAND.x),
              top: vh(ICE_LAND.y),
              width: vh(ICE_LAND.w),
              zIndex: 12,
            }}
            initial={{
              x: vh(iceFrom.current.x - ICE_LAND.x),
              y: vh(iceFrom.current.y - ICE_LAND.y),
              scale: ICE.w / ICE_LAND.w,
              rotate: -8,
            }}
            animate={{ x: "0vh", y: "0vh", scale: 1, rotate: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.22 } }}
            transition={{ duration: 0.4, ease: [0.3, 1.1, 0.55, 1] }}
          />
        )}
      </AnimatePresence>

      {/* 杯沿的柠檬片（补充素材立姿图）：翻着飞到手绘位置后淡出，与换杯图交叉淡化 */}
      <AnimatePresence>
        {chopped && !sliceLanded && !showFinal && (
          <motion.img
            key="fly-slice"
            src={url("lemon-slice-up")}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              left: vh(SLICE_CUP.x),
              top: vh(SLICE_CUP.y),
              width: vh(SLICE.w),
              zIndex: 12,
            }}
            initial={{
              x: vh(SLICE_FROM.x - SLICE_CUP.x),
              y: vh(SLICE_FROM.y - SLICE_CUP.y),
              rotate: -110,
              scale: 0.75,
            }}
            animate={{ x: "0vh", y: "0vh", rotate: SLICE_CUP.rot, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.22 } }}
            transition={{ delay: 0.35, type: "spring", stiffness: 180, damping: 17 }}
          />
        )}
      </AnimatePresence>

      {/* 案板（柠檬+刀，两状态）：默认整颗柠檬，点刀切开后换成两片 */}
      <motion.img
        src={url(chopped || done ? "board-lemon-cut" : "board-lemon-whole")}
        alt=""
        draggable={false}
        className={`absolute max-w-none select-none ${
          active && step === "lemon" && !chopping
            ? "cursor-pointer"
            : "pointer-events-none"
        }`}
        style={{
          left: vh(BOARD.x),
          top: vh(BOARD.y),
          width: vh(BOARD.w),
          height: vh(BOARD.h),
          transformOrigin: "50% 85%",
          zIndex: 4,
        }}
        initial={false}
        animate={chopping ? { scale: [1, 1.035, 0.99, 1] } : { scale: 1 }}
        transition={
          chopping
            ? { duration: 0.5, times: [0, 0.35, 0.65, 1], ease: "easeOut" }
            : { duration: 0.2 }
        }
        onClick={chop}
      />

      {/* ICE 冰桶：加冰步骤滑上桌，加完留着 */}
      <AnimatePresence>
        {!done && (step === "ice" || step === "pour" || step === "pouring" || step === "label") && (
          <motion.img
            key="bucket"
            src={url("ice-bucket")}
            alt=""
            draggable={false}
            className={`absolute max-w-none select-none ${
              active && step === "ice" && !iced
                ? "cursor-grab"
                : "pointer-events-none"
            }`}
            style={{
              left: vh(BUCKET.x),
              top: vh(BUCKET.y),
              width: vh(BUCKET.w),
              zIndex: 5,
              touchAction: "none",
            }}
            initial={{ y: vh(160), opacity: 0 }}
            animate={{ y: "0vh", opacity: 1 }}
            exit={{ y: vh(160), opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            onPointerDown={startIceDrag}
          />
        )}
      </AnimatePresence>

      {/* 三瓶饮料（拖拽中的那瓶交给下面的拖拽层渲染） */}
      {DRINKS.map((d) => {
        const spec = BOTTLE_POS[d.bottle];
        const rest = bottleRest(d.id);
        const isChosen = choice === d.id;
        const dragging = drag && isChosen;
        const pouring = isChosen && !done && step === "pouring";
        const clickable = active && step === "pick";
        const draggable = active && step === "pour" && isChosen;
        return (
          <motion.div
            key={d.id}
            className={`absolute select-none ${
              clickable || draggable ? "cursor-pointer" : ""
            }`}
            style={{
              width: vh(spec.w),
              height: vh(spec.h),
              left: 0,
              top: 0,
              // 倒酒绕瓶颈转，hover 摇晃以瓶底为轴
              transformOrigin: pouring ? "50% 20%" : "50% 92%",
              // 选中的瓶子压在其他瓶子和杯子之上（倒酒时也在中途杯前面）
              zIndex: pouring ? 12 : isChosen && !done && step !== "pick" ? 13 : 9,
              opacity: dragging ? 0 : 1,
              // label 阶段瓶子正从杯口弹回原位，指针事件先关掉，
              // 免得它路过静止的鼠标时误触发 hover 气泡
              pointerEvents:
                active && !drag && !pouring && step !== "label"
                  ? "auto"
                  : "none",
              touchAction: "none",
            }}
            initial={false}
            animate={
              pouring
                ? {
                    x: vh(POUR_POSE.x),
                    y: vh(POUR_POSE.y),
                    rotate: POUR_POSE.rot,
                    scale: 1,
                  }
                : {
                    x: vh(rest.x),
                    y: vh(rest.y),
                    // hover 摇两下（无光圈提示，靠这个"活"劲儿示意可点）
                    rotate:
                      hovered === d.id && !drag ? [0, -4.5, 4, -2, 0] : 0,
                    scale: isChosen && !done && step !== "pick" ? 1.05 : 1,
                  }
            }
            transition={{
              type: "spring",
              stiffness: 210,
              damping: 20,
              rotate:
                hovered === d.id && !drag && !pouring
                  ? { duration: 0.55, ease: "easeInOut" }
                  : undefined,
            }}
            onMouseEnter={() => active && setHovered(d.id)}
            onMouseLeave={() => setHovered((h) => (h === d.id ? null : h))}
            onClick={() => pickBottle(d.id)}
            onPointerDown={draggable ? startDrag : undefined}
          >
            <img
              src={url(d.bottle)}
              alt=""
              draggable={false}
              className="h-full w-full max-w-none"
            />
            {/* hover 名字气泡（推近期间任何时候都有）：
                外层 div 做 CSS 居中，framer 不碰水平位移 */}
            <div
              className="pointer-events-none absolute left-1/2"
              style={{ bottom: "104%", transform: "translateX(-50%)" }}
            >
              <AnimatePresence>
                {active && hovered === d.id && !drag && !pouring && (
                  <motion.span
                    key="name"
                    className="font-hand block whitespace-nowrap rounded-full bg-white/95 px-3 py-0.5 text-base text-neutral-800 shadow-md"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {pick(d.name)}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}

      {/* 分步的手绘箭头：挑瓶子 → 切柠檬 → 加冰。和房间里的站点箭头同一支，
          尺寸按长卷像素给（推近时整个场景放大 2 倍，屏幕上看到的是两倍大） */}
      {/* 挑瓶子：从中间那瓶的右上方斜指下来 */}
      <HandHint
        show={active && !done && step === "pick"}
        rotate={200}
        arrowH={ARROW_H}
        bold
        stroke={ARROW_STROKE}
        style={{ left: vh(BOTTLE_POS["soda-white"].x + 24), top: vh(BOTTLE_POS["soda-white"].y - ARROW_PX - 10) }}
      />
      {/* 切柠檬：站在一口咩纸箱和柠檬盘之间那块空垫布上，斜指左下的柠檬 */}
      <HandHint
        show={active && !done && step === "lemon" && !chopping && !chopped}
        rotate={222}
        arrowH={ARROW_H}
        bold
        stroke={ARROW_STROKE}
        style={{ left: vh(9268), top: vh(1322) }}
      />
      {/* 加冰：冰桶正上方直指桶口 */}
      <HandHint
        show={active && !done && step === "ice" && !iced && !dragIce}
        rotate={180}
        arrowH={ARROW_H}
        bold
        stroke={ARROW_STROKE}
        style={{ left: vh(BUCKET.x + BUCKET.w / 2 - ARROW_PX / 2), top: vh(BUCKET.y - ARROW_PX + 14) }}
      />

      {/* 拖近杯口时：杯口亮起光晕 */}
      {drag && (
        <motion.div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: vh(POUR_AT.x - 140),
            top: vh(POUR_AT.y - 140),
            width: vh(280),
            height: vh(280),
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)",
            zIndex: 11,
          }}
          animate={{ opacity: dragNear ? 1 : 0, scale: dragNear ? 1.05 : 0.9 }}
          transition={{ duration: 0.2 }}
        />
      )}

      {/* 拖拽中的瓶子：微微倾斜抬起 */}
      {drag && choice && (
        <img
          src={url(drinkOf(choice).bottle)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none drop-shadow-lg"
          style={{
            left: vh(drag.x),
            top: vh(drag.y),
            width: vh(BOTTLE_POS[drinkOf(choice).bottle].w),
            height: vh(BOTTLE_POS[drinkOf(choice).bottle].h),
            transform: `rotate(${dragNear ? -24 : -10}deg) scale(1.05)`,
            zIndex: 30,
          }}
        />
      )}

      {/* 倒酒的液体流：从瓶口落进杯里 */}
      {!done && step === "pouring" && finalDrink && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: vh(8852),
            top: vh(1364),
            zIndex: 10,
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: vh((i % 3) * 8),
                width: vh(9 + (i % 3) * 3),
                height: vh(13 + (i % 2) * 5),
                background: drinkOf(finalDrink).color,
                boxShadow: `0 0 5px ${drinkOf(finalDrink).color}`,
              }}
              animate={{
                y: [0, vh(45), vh(90)],
                opacity: [0, 1, 0],
                scaleY: [0.5, 1.2, 1.5],
              }}
              transition={{
                duration: 0.45,
                delay: 0.4 + i * 0.07,
                repeat: 3,
                ease: "easeIn",
              }}
            />
          ))}
        </div>
      )}

      {/* 倒完：饮料名字浮现（外层 div 负责 CSS 居中，framer 只动透明度/弹跳，
          避免 x:"-50%" 在手写字体加载前按旧宽度换算错位） */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: vh(CUP_REST.x + CUP.w / 2),
          top: vh(1140),
          transform: "translateX(-50%)",
          zIndex: 35,
        }}
      >
        <AnimatePresence>
          {!done && step === "label" && finalDrink && (
            <motion.span
              key="drink-name"
              className="font-hand block whitespace-nowrap rounded-full bg-white/95 px-4 py-1 text-lg text-neutral-800 shadow-md"
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "backOut" }}
            >
              {pick(drinkOf(finalDrink).name)} ✓
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* 当前步骤的提示（跟着场景一起被镜头放大） */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: vh(STEP_TAG_X),
          top: vh(1100),
          transform: "translateX(-50%)",
          zIndex: 20,
        }}
      >
        <AnimatePresence>
          {active && !done && stepHint && (
            <motion.span
              key={`hint-${step}`}
              className="font-hand block whitespace-nowrap text-neutral-900"
              style={{ ...PAPER_TAG, fontSize: "1.6vh", lineHeight: 1.25, padding: "0.5vh 1.2vh 0.65vh" }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
            >
              {stepHint}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
