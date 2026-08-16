import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { playPaperSnap } from "../../audio/sfx";

/**
 * 软木板拼图（photo 任务）：
 * 海报被撕成 10 块散钉在软木板上。点击软木板镜头推近后，
 * 把碎片一块块拖回它在海报里的位置——拖到位咔哒吸附、摆正锁定；
 * 放错位置就留在原地，可以继续拖。10 块全部归位后，
 * 碎片轻轻一颤化形成完整海报（两角贴上胶带），任务完成。
 *
 * 碎片素材是用脚本从完整海报上按撕纸形状真裁出来的
 * （/tmp/cut10.py，4 行 2+3+3+2 共 10 块，切线不规则、软边抗锯齿），
 * 每块的目标坐标由切割包围盒精确算出，拼对即像素级无缝衔接。
 * 坐标全部是长卷素材像素（画板高 1800px = 100vh），海报素材 1:1。
 */

const vh = (px: number) => `${px / 18}vh`;
const url = (name: string) => `/assets/life/seg02/${name}.webp`;

/** 完整海报挂在软木板上的位置（沿用旧版完成态相对板的挂点） */
const POSTER = { x: 4598, y: 307, w: 512, h: 590 };
/** 三条胶带都贴在海报前面，70% 透明度（底部那条完成前是 seg02 装饰层） */
const TAPES = [
  { src: "tape-l", x: 4576, y: 280, w: 98, h: 125 },
  { src: "tape-r", x: 5040, y: 276, w: 98, h: 125 },
  { src: "tape-photo-b", x: 4654, y: 850, w: 69, h: 80 },
];
const TAPE_OPACITY = 0.7;

/**
 * 10 块碎片。数组顺序 = 散落态叠放顺序（后面的在上层）。
 * x/y：散落态左上角（舞台坐标）；t：切割包围盒中心（海报内坐标，即目标点）；
 * rot：散落态的倾角（度），拿起来就摆正。数据由切割脚本生成。
 */
const PIECES = [
  { id: "01", x: 4644, y: 260, w: 271, h: 140, t: { x: 376.5, y: 70 }, rot: -7 },
  { id: "04", x: 5003, y: 254, w: 174, h: 151, t: { x: 420, y: 199.5 }, rot: 9 },
  { id: "02", x: 4482, y: 366, w: 176, h: 149, t: { x: 95, y: 197.5 }, rot: 12 },
  { id: "07", x: 4868, y: 436, w: 164, h: 169, t: { x: 422, y: 344.5 }, rot: -11 },
  { id: "00", x: 4498, y: 548, w: 244, h: 143, t: { x: 132, y: 71.5 }, rot: 6 },
  { id: "08", x: 5044, y: 552, w: 272, h: 176, t: { x: 136, y: 502 }, rot: -8 },
  { id: "05", x: 4756, y: 674, w: 189, h: 173, t: { x: 97.5, y: 343.5 }, rot: 14 },
  { id: "03", x: 4495, y: 771, w: 190, h: 158, t: { x: 259, y: 200 }, rot: -9 },
  { id: "09", x: 4956, y: 812, w: 247, h: 177, t: { x: 377.5, y: 501.5 }, rot: 5 },
  { id: "06", x: 4700, y: 852, w: 181, h: 157, t: { x: 263.5, y: 347.5 }, rot: -13 },
];

/** 目标中心（长卷素材像素） */
const targetOf = (p: (typeof PIECES)[number]) => ({
  x: POSTER.x + p.t.x,
  y: POSTER.y + p.t.y,
});

/** 松手时碎片中心距目标点多近算拼上（素材像素） */
const SNAP = 95;
/** 坐标换算基准区 = 碎片可以停放的范围（软木板一带） */
const BOUNDS = { x: 4270, y: 165, w: 1160, h: 1200 };

interface Props {
  /** 相片任务已完成（直接呈现完整海报） */
  done: boolean;
  /** 镜头已推近软木板 → 碎片可拖 */
  active: boolean;
  /** 10 块全部拼对、化形动画播完 */
  onDone: () => void;
}

export default function PhotoPuzzle({ done, active, onDone }: Props) {
  /** 每片当前位置（左上角，素材像素）；锁定后固定在目标位 */
  const [pos, setPos] = useState(() => PIECES.map((p) => ({ x: p.x, y: p.y })));
  /** 每片当前倾角：初始是散落倾角，拿起来一次就摆正归零 */
  const [rots, setRots] = useState(() => PIECES.map((p) => p.rot));
  const [locked, setLocked] = useState<boolean[]>(() => PIECES.map(() => done));
  const [drag, setDrag] = useState<{ idx: number; x: number; y: number } | null>(null);
  /** 化形动画：碎片淡出、完整海报浮现 */
  const [morph, setMorph] = useState(false);
  /** 刚锁定碎片的松手点（驱动吸附入位动画） */
  const landing = useRef(new Map<number, { x: number; y: number }>());
  const boundsRef = useRef<HTMLDivElement>(null);

  // 重新过一晚：碎片回到散落态
  useEffect(() => {
    if (!done) {
      setLocked((arr) => (arr.some(Boolean) ? PIECES.map(() => false) : arr));
      setPos(PIECES.map((p) => ({ x: p.x, y: p.y })));
      setRots(PIECES.map((p) => p.rot));
      setMorph(false);
      landing.current.clear();
    }
  }, [done]);

  // 全部拼对 → 停一拍开始化形，播完盖章
  const allLocked = locked.every(Boolean);
  useEffect(() => {
    if (!allLocked || done || morph) return;
    const t1 = window.setTimeout(() => setMorph(true), 550);
    const t2 = window.setTimeout(onDone, 1900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLocked]);

  /** 屏幕坐标 → 长卷素材像素（经过镜头缩放也成立） */
  const toArt = (clientX: number, clientY: number) => {
    const r = boundsRef.current!.getBoundingClientRect();
    const s = r.width / BOUNDS.w;
    return {
      x: BOUNDS.x + (clientX - r.left) / s,
      y: BOUNDS.y + (clientY - r.top) / s,
    };
  };

  const startDrag = (idx: number) => (e: React.PointerEvent) => {
    if (!active || drag || locked[idx]) return;
    e.preventDefault();
    const piece = PIECES[idx];
    const start = pos[idx];
    // 记住指尖在碎片内的抓取点，拖动时不跳位
    const at = toArt(e.clientX, e.clientY);
    const grabX = at.x - start.x;
    const grabY = at.y - start.y;
    // 拿起来就摆正，松手后也保持正的
    setRots((arr) => arr.map((v, i) => (i === idx ? 0 : v)));
    setDrag({ idx, x: start.x, y: start.y });

    const move = (ev: PointerEvent) => {
      const q = toArt(ev.clientX, ev.clientY);
      setDrag((d) => (d ? { ...d, x: q.x - grabX, y: q.y - grabY } : d));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const q = toArt(ev.clientX, ev.clientY);
      const px = q.x - grabX;
      const py = q.y - grabY;
      setDrag(null);
      const target = targetOf(piece);
      const cx = px + piece.w / 2;
      const cy = py + piece.h / 2;
      if (Math.hypot(cx - target.x, cy - target.y) < SNAP) {
        // 拼对了：从松手点吸附进目标位并旋正
        landing.current.set(idx, { x: px, y: py });
        playPaperSnap();
        setLocked((arr) => arr.map((v, i) => (i === idx ? true : v)));
      } else {
        // 没拼对：留在松手的地方（限制在软木板一带），可以再拖
        setPos((arr) =>
          arr.map((v, i) =>
            i === idx
              ? {
                  x: Math.min(Math.max(px, BOUNDS.x - 40), BOUNDS.x + BOUNDS.w - piece.w + 40),
                  y: Math.min(Math.max(py, BOUNDS.y - 20), BOUNDS.y + BOUNDS.h - piece.h + 20),
                }
              : v,
          ),
        );
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dragPiece = drag ? PIECES[drag.idx] : null;
  /** 拖着的这片已经够近了 → 目标点亮起光晕 */
  const dragNear =
    drag && dragPiece
      ? (() => {
          const t = targetOf(dragPiece);
          return (
            Math.hypot(
              drag.x + dragPiece.w / 2 - t.x,
              drag.y + dragPiece.h / 2 - t.y,
            ) < SNAP
          );
        })()
      : false;

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

      {/* 拼图中的海报虚影：告诉你往哪儿拼 */}
      <AnimatePresence>
        {active && !done && !morph && (
          <motion.div
            key="ghost"
            className="pointer-events-none absolute"
            style={{
              left: vh(POSTER.x),
              top: vh(POSTER.y),
              width: vh(POSTER.w),
              height: vh(POSTER.h),
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <img
              src={url("poster")}
              alt=""
              draggable={false}
              className="h-full w-full max-w-none opacity-15 grayscale"
            />
            <motion.div
              className="absolute rounded-lg border-2 border-dashed border-white/80"
              style={{ inset: vh(-14) }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 拖近目标时：目标点亮起光晕 */}
      {drag && dragPiece && (
        <motion.div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: vh(targetOf(dragPiece).x - 130),
            top: vh(targetOf(dragPiece).y - 130),
            width: vh(260),
            height: vh(260),
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)",
            zIndex: 25,
          }}
          animate={{ opacity: dragNear ? 1 : 0, scale: dragNear ? 1.05 : 0.9 }}
          transition={{ duration: 0.2 }}
        />
      )}

      {/* 完成 / 化形中：完整海报 + 两角胶带 */}
      {(done || morph) && (
        <>
          <motion.img
            src={url("poster")}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              left: vh(POSTER.x),
              top: vh(POSTER.y),
              width: vh(POSTER.w),
              height: vh(POSTER.h),
              zIndex: 20,
            }}
            initial={done ? false : { opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.33, 1, 0.68, 1] }}
          />
          {TAPES.map((tp) => (
            <motion.img
              key={tp.src}
              src={url(tp.src)}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: vh(tp.x),
                top: vh(tp.y),
                width: vh(tp.w),
                height: vh(tp.h),
                zIndex: 21,
              }}
              initial={done ? false : { opacity: 0, scale: 1.4 }}
              animate={{ opacity: TAPE_OPACITY, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.55, ease: "backOut" }}
            />
          ))}
        </>
      )}

      {/* 碎片 */}
      {!done &&
        PIECES.map((p, i) => {
          if (drag?.idx === i) return null;
          if (locked[i]) {
            const t = targetOf(p);
            const land = landing.current.get(i);
            const left = t.x - p.w / 2;
            const top = t.y - p.h / 2;
            // 碎片就是海报的真切片，贴回目标位即无缝衔接
            return (
              <motion.img
                key={`locked-${p.id}`}
                src={url(`piece-${p.id}`)}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  left: vh(left),
                  top: vh(top),
                  width: vh(p.w),
                  height: vh(p.h),
                  zIndex: 5,
                }}
                initial={
                  land
                    ? {
                        x: vh(land.x - left),
                        y: vh(land.y - top),
                        rotate: 2,
                        scale: 1.05,
                      }
                    : false
                }
                animate={{
                  x: "0vh",
                  y: "0vh",
                  rotate: 0,
                  scale: 1,
                  opacity: morph ? 0 : 1,
                }}
                transition={
                  morph
                    ? { duration: 0.6, ease: "easeOut" }
                    : { type: "spring", stiffness: 220, damping: 20 }
                }
              />
            );
          }
          return (
            <img
              key={`free-${p.id}`}
              src={url(`piece-${p.id}`)}
              alt=""
              draggable={false}
              className={`absolute max-w-none select-none ${
                active ? "cursor-grab" : "pointer-events-none"
              }`}
              style={{
                left: vh(pos[i].x),
                top: vh(pos[i].y),
                width: vh(p.w),
                height: vh(p.h),
                transform: rots[i] ? `rotate(${rots[i]}deg)` : undefined,
                // 拼图进行中碎片抬到装饰物（帆布袋、剪刀等）之上，保证抓得到
                zIndex: active ? 12 : undefined,
                touchAction: "none",
              }}
              onPointerDown={startDrag(i)}
            />
          );
        })}

      {/* 拖拽中的碎片：微微抬起，压在所有东西上面 */}
      {drag && dragPiece && (
        <img
          src={url(`piece-${dragPiece.id}`)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none drop-shadow-lg"
          style={{
            left: vh(drag.x),
            top: vh(drag.y),
            width: vh(dragPiece.w),
            height: vh(dragPiece.h),
            transform: "rotate(2deg) scale(1.05)",
            zIndex: 30,
          }}
        />
      )}
    </>
  );
}
