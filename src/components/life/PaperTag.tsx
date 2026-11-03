import type { CSSProperties, ReactNode } from "react";
import { isMobileView } from "../../device";

/**
 * 奶油色小纸签：Life 页里所有"贴在屏幕上"的字都垫这一张——
 * 推近后的操作说明、调酒的分步提示。手绘黑细边 + 一点硬阴影，微微歪一下，
 * 和场景里手写在墙上的引导是一家的（HandHint 的 tag 也是这套样子）。
 */
export const PAPER_TAG: CSSProperties = {
  padding: "1vh 1.8vh 1.2vh",
  background: "#F7E6CB",
  border: "0.22vh solid #111",
  borderRadius: "0.4vh",
  boxShadow: "0.2vh 0.3vh 0 rgba(0,0,0,0.22)",
  rotate: "-1.5deg",
};

export default function PaperTag({
  children,
  fontSize = "2.6vh",
  style,
  className = "",
}: {
  children: ReactNode;
  fontSize?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const mobile = isMobileView();
  return (
    <span
      className={`font-hand block text-center text-neutral-900 ${
        mobile ? "whitespace-normal" : "whitespace-nowrap"
      } ${className}`}
      style={{
        ...PAPER_TAG,
        fontSize: mobile && fontSize === "2.6vh" ? "2.45vh" : fontSize,
        padding: mobile ? "0.9vh 1.9vh 1.05vh" : PAPER_TAG.padding,
        maxWidth: mobile ? "88%" : undefined,
        textWrap: mobile ? "balance" : undefined,
        lineHeight: 1.25,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
