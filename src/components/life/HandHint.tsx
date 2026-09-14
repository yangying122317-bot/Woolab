import { useRef, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PAPER_TAG } from "./PaperTag";

/**
 * 手绘引导：一支手画的箭头 + （可选的）一行手写字。
 * 第一次出场是"画出来"的：箭头从尾到头擦出，字从左往右擦出；之后再出就只是淡入——
 * 同一支箭头滚出去又滚回来，不用每次都重画一遍。出来后箭头顺着指向轻轻点头。
 * 箭头用的是详情页那张 svg，颜色靠 mask 重新上。
 *
 * 只管自己长什么样，摆在哪由外面用 style 定位；箭头素材原本朝上，rotate 转到要指的方向。
 */
/** 加粗用的几层错位（像素） */
const BOLD_OFFSETS: [number, number][] = [
  [0, 0],
  [0.7, 0],
  [-0.7, 0],
  [0, 0.7],
  [0, -0.7],
];

export default function HandHint({
  show,
  text,
  rotate = 0,
  arrowH = "12vh",
  textSide = "right",
  fontSize = "3.3vh",
  color = "#262626",
  bold = false,
  tag = false,
  flip = false,
  maxWidth,
  style,
  className = "",
}: {
  show: boolean;
  /** 不传就只有箭头 */
  text?: string;
  rotate?: number;
  arrowH?: string;
  textSide?: "left" | "right" | "above" | "below";
  fontSize?: string;
  color?: string;
  /** 箭头素材是一根很细的手绘线，缩小到 8vh 以下就快看不见了：加粗是把同一张 mask 错开半像素多画几层 */
  bold?: boolean;
  /** 字垫一张奶油色小纸签（箭头不垫，还是直接画在场景里），不然压在地板 / 家具上看不清 */
  tag?: boolean;
  /** 箭头左右镜像（素材那道弧是固定朝一边弯的，有时想让它弯向另一边） */
  flip?: boolean;
  /** 字最宽多少，超过就折成两行（不传 = 一行到底）。长句压在家具上才看得清 */
  maxWidth?: string;
  style?: CSSProperties;
  className?: string;
}) {
  /* 出过一次没有：第二次起不再"画"，直接淡入 */
  const drawn = useRef(false);
  const drawThisTime = useRef(true);
  const wasShow = useRef(false);
  if (show && !wasShow.current) {
    drawThisTime.current = !drawn.current;
    drawn.current = true;
  }
  wasShow.current = show;
  const draw = drawThisTime.current;
  const column = textSide === "above" || textSide === "below";
  const reverse = textSide === "left" || textSide === "above";
  const dir = column
    ? reverse
      ? "column-reverse"
      : "column"
    : reverse
      ? "row-reverse"
      : "row";
  /* 箭头素材竖着（12 宽 31.6 高），放进一个正方形里居中，这样怎么转都不撑坏布局；
     旋转放在外层，里面的擦出 / 点头就都是顺着箭头自己的方向 */
  const arrowMask: CSSProperties = {
    position: "absolute",
    inset: 0,
    WebkitMaskImage: "url(/assets/lab/detail/arrow-front.svg)",
    maskImage: "url(/assets/lab/detail/arrow-front.svg)",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    background: color,
  };
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`pointer-events-none absolute z-30 flex items-center ${className}`}
          style={{
            flexDirection: dir,
            gap: column ? "0.6vh" : "1.2vh",
            /* 贴在热区右边缘（left:100%）时可用宽度是 0，不写这个字会被挤成一列 */
            width: "max-content",
            ...style,
          }}
          initial={{ opacity: draw ? 1 : 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3 } }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          {/* 箭头：从尾（下）到头（上）擦出来，然后顺着方向点头 */}
          <div
            className="shrink-0"
            style={{ width: arrowH, height: arrowH, transform: `rotate(${rotate}deg)${flip ? " scaleX(-1)" : ""}` }}
          >
            <motion.div
              className="relative h-full w-full"
              initial={{ clipPath: draw ? "inset(100% 0 0 0)" : "inset(0% 0 0 0)", y: 0 }}
              animate={{
                clipPath: "inset(0% 0 0 0)",
                y: ["0vh", "-0.7vh", "0vh"],
              }}
              transition={{
                clipPath: { duration: 0.5, ease: "easeOut" },
                y: {
                  delay: draw ? 0.7 : 0.2,
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
            >
              {(bold ? BOLD_OFFSETS : [[0, 0]]).map(([dx, dy]) => (
                <div key={`${dx},${dy}`} style={{ ...arrowMask, transform: `translate(${dx}px, ${dy}px)` }} />
              ))}
            </motion.div>
          </div>
          {text && (
            <motion.div
              /* pre-line：文案里写的换行照做（中文靠这个断句），再长才按 maxWidth 自动折 */
              className={`font-hand relative shrink-0 ${maxWidth ? "whitespace-pre-line" : "whitespace-nowrap"}`}
              style={{
                fontSize,
                lineHeight: 1.25,
                color,
                maxWidth,
                textWrap: maxWidth ? "balance" : undefined,
                ...(tag ? PAPER_TAG : null),
              }}
              initial={{ clipPath: draw ? "inset(-10% 100% -10% -10%)" : "inset(-10% -10% -10% -10%)" }}
              animate={{ clipPath: "inset(-10% -10% -10% -10%)" }}
              transition={{ delay: 0.3, duration: 0.5, ease: "easeInOut" }}
            >
              {text}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
