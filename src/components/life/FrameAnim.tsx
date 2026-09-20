import { useEffect, useRef, type CSSProperties } from "react";

/**
 * 逐帧动画（换装、作画那种几十张 webp 的序列）统一走这里：先把所有帧解码成 ImageBitmap 存在内存里，
 * 播放时逐帧画到一块 canvas 上。
 *
 * 之前是几十个 <img> 叠着切 opacity——Chrome 没事，Safari 会把当前看不见的大图的解码结果丢掉，
 * 轮到它显示时再异步重新解码，中间空一两帧，整段动画就一闪一闪。canvas 的像素是自己攥着的，不会被丢。
 */

type Frame = ImageBitmap | HTMLImageElement;
const cache = new Map<string, Promise<Frame>>();

function loadFrame(src: string): Promise<Frame> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise<Frame>((resolve, reject) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        if (typeof createImageBitmap === "function") {
          createImageBitmap(im).then(resolve, () => resolve(im));
        } else {
          resolve(im);
        }
      };
      im.onerror = () => reject(new Error(src));
      im.src = src;
    });
    p.catch(() => cache.delete(src));
    cache.set(src, p);
  }
  return p;
}

/** 提前把整段的帧解码好（触发条件快满足时调），播的时候就不等网络 */
export function warmFrames(srcs: string[]) {
  for (const s of srcs) void loadFrame(s).catch(() => {});
}

export default function FrameAnim({
  srcs,
  fps,
  playing = true,
  onEnd,
  holdMs = 400,
  className = "",
  style,
}: {
  /** 按顺序的帧地址 */
  srcs: string[];
  fps: number;
  /** false = 先挂着不播（帧照样解码好、画出第一帧），变 true 开始播 */
  playing?: boolean;
  /** 最后一帧画出来再停 holdMs 后调 */
  onEnd?: () => void;
  holdMs?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<(Frame | null)[]>([]);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const draw = (i: number) => {
    const c = canvasRef.current;
    const f = framesRef.current[i];
    if (!c || !f) return false;
    const w = "naturalWidth" in f ? f.naturalWidth : f.width;
    const h = "naturalHeight" in f ? f.naturalHeight : f.height;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(f, 0, 0);
    return true;
  };

  /* 解码所有帧；第一帧到了先画上，免得 playing 之前是空的 */
  useEffect(() => {
    let alive = true;
    framesRef.current = srcs.map(() => null);
    srcs.forEach((s, i) => {
      loadFrame(s)
        .then((f) => {
          if (!alive) return;
          framesRef.current[i] = f;
          if (i === 0) draw(0);
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs]);

  /* 播放：按 fps 走表；某一帧还没解码完就在这帧多等一拍，不跳帧 */
  useEffect(() => {
    if (!playing) return;
    let alive = true;
    let i = 0;
    let timer = 0;
    const step = 1000 / fps;
    const tick = () => {
      if (!alive) return;
      if (draw(i)) {
        if (i >= srcs.length - 1) {
          timer = window.setTimeout(() => alive && onEndRef.current?.(), holdMs);
          return;
        }
        i += 1;
      }
      timer = window.setTimeout(tick, step);
    };
    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, srcs, fps]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute select-none ${className}`}
      style={style}
      aria-hidden
    />
  );
}
