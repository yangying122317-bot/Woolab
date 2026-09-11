import { useLayoutEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { A, box, type Box } from "./geom";

/**
 * 一段手写字：按 \n 手动断行，行错开、从下往上冒出来（和 Lab 详情那段话一样）；
 * *星号* 包起来的词画圈、_下划线_ 包起来的词划线，等行出完再擦出来。
 * 圈 / 划线的位置按实际文字量出来，所以要画的词得落在同一行里。
 */

export type Deco = "circle" | "underline";
type Seg = { text: string; deco: Deco | null };

export function parseMarks(text: string): Seg[] {
  const out: Seg[] = [];
  const re = /\*([^*]+)\*|_([^_]+)_/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), deco: null });
    out.push({ text: m[1] ?? m[2], deco: m[1] !== undefined ? "circle" : "underline" });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), deco: null });
  return out;
}

/** 手绘圈 / 划线素材的高宽比 */
export const CIRCLE_AR = 31 / 68;
export const UNDERLINE_AR = 49 / 684;

/** 相邻两行错开多少 */
export const LINE_DELAY = 0.14;
/** 行出完、圈和划线开始擦的时间 */
export const decoDelay = (text: string, delay: number) => delay + (text.split("\n").length - 1) * LINE_DELAY + 0.45;

const lineAnim: Variants = {
  hidden: { y: "115%", opacity: 0 },
  show: (d: number) => ({ y: "0%", opacity: 1, transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] } }),
};

const wipe = {
  hidden: { clipPath: "inset(-6px 100% -6px -6px)" },
  shown: { clipPath: "inset(-6px -6px -6px -6px)" },
};

export default function MarkedText({
  text,
  cx,
  y,
  w,
  className,
  fontSize,
  lineHeight = 1.3,
  color,
  tone,
  delay,
}: {
  text: string;
  /** 文字块中线 / 顶边 / 宽度（父级坐标系） */
  cx: number;
  y: number;
  w: number;
  className: string;
  fontSize: number;
  lineHeight?: number;
  color: string;
  /** 圈和划线用深色还是白色那套素材 */
  tone: "dark" | "light";
  delay: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const markRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const [decos, setDecos] = useState<{ kind: Deco; box: Box }[]>([]);
  const lines = text.split("\n").map(parseMarks);
  const decoAt = decoDelay(text, delay);

  /*
   * 沿 offsetParent 链累加到文字块——行在做位移动画时带 transform，会被当成 offsetParent，
   * 直接读 getBoundingClientRect 会量到动画中途的位置。手写字体是异步加载的，加载完再量一次。
   */
  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const b = boxRef.current;
      if (!b) return;
      const out: { kind: Deco; box: Box }[] = [];
      markRefs.current.forEach((m, key) => {
        const kind = key.split(":")[0] as Deco;
        let l = 0;
        let t = 0;
        let node: HTMLElement | null = m;
        while (node && node !== b) {
          l += node.offsetLeft;
          t += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        const mw = m.offsetWidth;
        const mh = m.offsetHeight;
        if (kind === "circle") {
          /* 圈按素材比例放：短词（比如两个汉字）按宽度算会矮到圈不住字，用行高兜个底 */
          const cw = Math.max(mw + fontSize * 1.3, (mh + 4) / CIRCLE_AR);
          const ch = cw * CIRCLE_AR;
          out.push({ kind, box: { x: l + mw / 2 - cw / 2, y: t + mh / 2 - ch / 2 + 1, w: cw, h: ch } });
        } else {
          /* 划线贴在字的底下，两头各多出一点 */
          const uw = mw * 1.06;
          const uh = uw * UNDERLINE_AR;
          out.push({ kind, box: { x: l + mw / 2 - uw / 2, y: t + mh - uh * 0.35, w: uw, h: uh } });
        }
      });
      setDecos(out);
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      alive = false;
    };
  }, [text, w, fontSize]);

  const suffix = tone === "light" ? "white" : "dark";
  const circleSrc = tone === "light" ? `${A}/circle-white.png` : `${A}/circle-l.png`;

  return (
    <div
      ref={boxRef}
      className={`${className} absolute text-center`}
      style={{ left: cx - w / 2, top: y, width: w, fontSize, lineHeight, color }}
    >
      {lines.map((segs, li) => (
        /* 每行一个裁切盒，行从盒底升上来；上下各留 2px 别切到手写体的出头，左右放宽——只裁上下，长句别被切掉两头 */
        <div key={li} className="overflow-hidden" style={{ margin: "-2px -80px", padding: "2px 80px" }}>
          <motion.span
            className="block whitespace-nowrap"
            custom={delay + li * LINE_DELAY}
            variants={lineAnim}
            initial="hidden"
            animate="show"
          >
            {segs.map((sg, i) =>
              sg.deco ? (
                <span
                  key={i}
                  ref={(el) => {
                    const key = `${sg.deco}:${li}:${i}`;
                    if (el) markRefs.current.set(key, el);
                    else markRefs.current.delete(key);
                  }}
                >
                  {sg.text}
                </span>
              ) : (
                <span key={i}>{sg.text}</span>
              ),
            )}
          </motion.span>
        </div>
      ))}
      {decos.map((d, i) => (
        <motion.img
          key={`${d.kind}${i}`}
          src={d.kind === "circle" ? circleSrc : `${A}/underline-${suffix}.png`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={box(d.box)}
          initial={wipe.hidden}
          animate={wipe.shown}
          transition={{ duration: d.kind === "circle" ? 0.45 : 0.4, delay: decoAt + i * 0.12, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
