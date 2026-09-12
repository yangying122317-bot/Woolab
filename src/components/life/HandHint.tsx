import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * 手绘引导：一支手画的箭头 + 一行手写字。
 * 出场是"画出来"的：箭头从尾到头擦出，字从左往右擦出；出来后箭头顺着指向轻轻点头。
 * 箭头用的是详情页那张 svg，颜色靠 mask 重新上。
 *
 * 只管自己长什么样，摆在哪由外面用 style 定位；箭头素材原本朝上，rotate 转到要指的方向。
 */
export default function HandHint({
  show,
  text,
  rotate = 0,
  arrowH = "12vh",
  textSide = "right",
  fontSize = "3.3vh",
  color = "#262626",
  tag = false,
  style,
  className = "",
}: {
  show: boolean;
  text: string;
  rotate?: number;
  arrowH?: string;
  textSide?: "left" | "right" | "above" | "below";
  fontSize?: string;
  color?: string;
  /** 贴在屏幕上（不在场景里）时垫一张奶油色小纸签，不然压在地板 / 家具上看不清 */
  tag?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
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
    width: "100%",
    height: "100%",
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
            ...(tag
              ? {
                  padding: "1vh 1.6vh 1.2vh",
                  background: "#F7E6CB",
                  border: "0.22vh solid #111",
                  borderRadius: "0.4vh",
                  boxShadow: "0.2vh 0.3vh 0 rgba(0,0,0,0.22)",
                  rotate: "-2deg",
                }
              : null),
            ...style,
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          {/* 箭头：从尾（下）到头（上）擦出来，然后顺着方向点头 */}
          <div
            className="shrink-0"
            style={{ width: arrowH, height: arrowH, transform: `rotate(${rotate}deg)` }}
          >
            <motion.div
              style={arrowMask}
              initial={{ clipPath: "inset(100% 0 0 0)", y: 0 }}
              animate={{
                clipPath: "inset(0% 0 0 0)",
                y: ["0vh", "-0.7vh", "0vh"],
              }}
              transition={{
                clipPath: { duration: 0.5, ease: "easeOut" },
                y: {
                  delay: 0.7,
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
            />
          </div>
          <div className="relative">
            <motion.span
              className="font-hand block whitespace-nowrap"
              style={{ fontSize, lineHeight: 1.2, color }}
              initial={{ clipPath: "inset(-10% 100% -10% 0)" }}
              animate={{ clipPath: "inset(-10% 0% -10% 0)" }}
              transition={{ delay: 0.3, duration: 0.5, ease: "easeInOut" }}
            >
              {text}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
