import { motion } from "framer-motion";

/**
 * 互动点指引：一颗轻轻呼吸的奶白小光点 + 向外扩散淡出的圆环，
 * 像游戏里的可互动提示。挂在目标位置的中心，完成后不再显示。
 */
export default function HintPing() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2">
      <motion.span
        className="absolute rounded-full border-2 border-[#FFB627]"
        style={{
          width: "4.4vh",
          height: "4.4vh",
          left: "-2.2vh",
          top: "-2.2vh",
          boxShadow: "0 0 10px rgba(255,182,39,0.45)",
        }}
        animate={{ scale: [0.45, 1.5], opacity: [0.85, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      />
      <motion.span
        className="absolute rounded-full bg-[#FFC93F]"
        style={{
          width: "1.9vh",
          height: "1.9vh",
          left: "-0.95vh",
          top: "-0.95vh",
          border: "0.35vh solid #FFFDF6",
          boxShadow:
            "0 0 12px rgba(255,190,50,0.9), 0 1px 3px rgba(0,0,0,0.22)",
        }}
        animate={{ scale: [1, 1.25, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
