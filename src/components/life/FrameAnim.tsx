import { useLayoutEffect, useRef, type CSSProperties } from "react";

/**
 * 逐帧动画（换装、作画那种几十张 webp 的序列）统一走这里：先把所有帧解码成 ImageBitmap 存在内存里，
 * 播放时逐帧画到一块 canvas 上。
 *
 * 之前是几十个 <img> 叠着切 opacity——Chrome 没事，Safari 会把当前看不见的大图的解码结果丢掉，
 * 轮到它显示时再异步重新解码，中间空一两帧，整段动画就一闪一闪。canvas 的像素是自己攥着的，不会被丢。
 */

type Frame = ImageBitmap | HTMLImageElement;
const cache = new Map<string, Promise<Frame>>();
const syncCache = new Map<string, Frame>();

/** 同时只解码两帧。一进 Life 就铺开几十帧时，Safari 会把请求或位图丢掉，动画就停在空画布上。 */
const MAX_CONCURRENT = 2;
let running = 0;
const pending: Array<{ src: string; run: () => void }> = [];

function isDead(frame: Frame): boolean {
  if ("close" in frame && !("naturalWidth" in frame)) return frame.width === 0;
  return false;
}

function liveFrame(src: string): Frame | undefined {
  const frame = syncCache.get(src);
  if (!frame) return;
  if (!isDead(frame)) return frame;
  syncCache.delete(src);
  cache.delete(src);
  return;
}

function pump() {
  while (running < MAX_CONCURRENT && pending.length > 0) {
    const job = pending.shift();
    if (!job) return;
    running += 1;
    job.run();
  }
}

function enqueue(src: string, run: () => void, urgent: boolean) {
  const at = pending.findIndex((job) => job.src === src);
  if (at >= 0) pending.splice(at, 1);
  if (urgent) pending.unshift({ src, run });
  else pending.push({ src, run });
  pump();
}

function finish() {
  running = Math.max(0, running - 1);
  pump();
}

function loadFrame(src: string, urgent = false): Promise<Frame> {
  const ready = liveFrame(src);
  if (ready) return Promise.resolve(ready);
  const existing = cache.get(src);
  if (existing) {
    if (urgent) {
      const at = pending.findIndex((job) => job.src === src);
      if (at > 0) {
        const [job] = pending.splice(at, 1);
        if (job) pending.unshift(job);
      }
    }
    return existing;
  }
  const task = new Promise<Frame>((resolve, reject) => {
    const attempt = (n: number) => {
      const im = new Image();
      im.decoding = "async";
      const fail = () => {
        if (n < 4) {
          window.setTimeout(() => attempt(n + 1), 350 * (n + 1));
          return;
        }
        finish();
        reject(new Error(src));
      };
      im.onload = () => {
        const done = (frame: Frame) => {
          if (isDead(frame)) {
            fail();
            return;
          }
          syncCache.set(src, frame);
          finish();
          resolve(frame);
        };
        if (typeof createImageBitmap === "function") {
          createImageBitmap(im).then(done, () => done(im));
        } else {
          done(im);
        }
      };
      im.onerror = fail;
      im.src = src;
    };
    enqueue(src, () => attempt(0), urgent);
  });
  task.catch(() => {
    if (cache.get(src) === task) cache.delete(src);
  });
  cache.set(src, task);
  return task;
}

/** 提前把整段的帧解码好（触发条件快满足时调），播的时候就不等网络 */
export function warmFrames(srcs: string[]) {
  for (const src of srcs) void loadFrame(src).catch(() => {});
}

export default function FrameAnim({
  srcs,
  fps,
  playing = true,
  onShow,
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
  /** 第一帧真正画到画布上时调。换装用它决定何时藏起原来的小羊。 */
  onShow?: () => void;
  /** 最后一帧画出来再停 holdMs 后调 */
  onEnd?: () => void;
  holdMs?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<(Frame | null)[]>([]);
  const onEndRef = useRef(onEnd);
  const onShowRef = useRef(onShow);
  onEndRef.current = onEnd;
  onShowRef.current = onShow;

  const draw = (i: number) => {
    const c = canvasRef.current;
    const f = framesRef.current[i];
    if (!c || !f || isDead(f)) return false;
    const w = "naturalWidth" in f ? f.naturalWidth : f.width;
    const h = "naturalHeight" in f ? f.naturalHeight : f.height;
    if (w === 0 || h === 0) return false;
    try {
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(f, 0, 0);
      return true;
    } catch {
      framesRef.current[i] = null;
      syncCache.delete(srcs[i]);
      cache.delete(srcs[i]);
      return false;
    }
  };

  /* 解码所有帧；若已在同步缓存里，在浏览器绘制前（useLayoutEffect）直接画上第 1 帧，杜绝空闪 */
  useLayoutEffect(() => {
    let alive = true;
    framesRef.current = srcs.map((s) => syncCache.get(s) ?? null);
    if (framesRef.current[0]) draw(0);
    srcs.forEach((s, i) => {
      if (framesRef.current[i]) return;
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
      /* 动画卸载时释放第 2 帧起的 ImageBitmap 显存（保留第 1 帧在 syncCache 供下次 0ms 瞬切），防止 Safari 显存超标崩溃 */
      framesRef.current.forEach((f, i) => {
        if (i === 0 || !f) return;
        const s = srcs[i];
        syncCache.delete(s);
        cache.delete(s);
        if ("close" in f && typeof f.close === "function") {
          try {
            f.close();
          } catch {
            /* ignore */
          }
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs]);

  /* 播放：按 fps 走表；某一帧还没解码完就在这帧多等一拍，不跳帧 */
  useLayoutEffect(() => {
    if (!playing) return;
    let alive = true;
    let i = 0;
    let shown = false;
    let timer = 0;
    const waiting = new Set<number>();
    const step = 1000 / fps;
    const ensure = (index: number) => {
      if (!alive || waiting.has(index)) return;
      const current = framesRef.current[index];
      if (current && !isDead(current)) return;
      framesRef.current[index] = null;
      waiting.add(index);
      void loadFrame(srcs[index], true)
        .then((frame) => {
          if (!alive) return;
          framesRef.current[index] = frame;
          waiting.delete(index);
        })
        .catch(() => {
          window.setTimeout(() => {
            waiting.delete(index);
            if (alive) ensure(index);
          }, 800);
        });
    };
    const tick = () => {
      if (!alive) return;
      if (!draw(i)) ensure(i);
      else {
        if (i === 0 && !shown) {
          shown = true;
          onShowRef.current?.();
        }
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
