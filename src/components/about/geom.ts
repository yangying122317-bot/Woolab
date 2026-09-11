import type { CSSProperties } from "react";

/** About 页素材目录 */
export const A = "/assets/about";

export type Box = { x: number; y: number; w: number; h: number };

export const box = (b: Box): CSSProperties => ({
  position: "absolute",
  left: b.x,
  top: b.y,
  width: b.w,
  height: b.h,
});

/**
 * 噪点底色：从 Figma 的 Noise 效果导出的 256×256（2x）无缝平铺块，一块 = 128 稿单位，
 * 所以按 128·s 铺就和稿里颗粒一样细。多个元素拼一块底时传各自的 left/top（屏幕 px），
 * 让它们对到同一个平铺原点，接缝处噪点才连得上。
 */
export const NOISE_TILE = 128;
export const noiseBg = (tone: "cream" | "blue", s: number, left = 0, top = 0): CSSProperties => ({
  backgroundImage: `url(${A}/noise-${tone}.png)`,
  backgroundSize: `${NOISE_TILE * s}px ${NOISE_TILE * s}px`,
  backgroundRepeat: "repeat",
  backgroundPosition: `${-left}px ${-top}px`,
});

/* 一张相纸（稿单位）：本体 188×182；frame.webp 四周各比相纸多 4（描边溢出） */
export const CARD_W = 188;
export const CARD_H = 182;
export const FRAME_PAD = 4;
/** 相纸上的照片窗口（相对相纸） */
export const WINDOW: Box = { x: 12, y: 17, w: 162, h: 124 };
