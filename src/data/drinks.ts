import type { Localized } from "../i18n/dict";
import type { DrinkChoice } from "../state/roomState";

/**
 * 调酒互动的三瓶饮料：按瓶身颜色直觉对应名字和液体色。
 * bottle 对应 seg03 的瓶子素材名；成品杯素材为 drink-cup-{id}.webp
 * （脚本用 paper-cup 合成的占位，之后画了手绘版直接替换同名文件）。
 */
export interface DrinkSpec {
  id: DrinkChoice;
  /** 桌上的瓶子素材（seg03 目录） */
  bottle: string;
  name: Localized;
  /** 液体颜色（倒出的水流、液面用同一色） */
  color: string;
}

export const DRINKS: DrinkSpec[] = [
  { id: "a", bottle: "soda-white", name: { zh: "发呆汽水", en: "Daydream Soda" }, color: "#9FD9EC" },
  { id: "b", bottle: "sauce-bottle", name: { zh: "慢半拍茶", en: "Half-Beat Tea" }, color: "#E0A34F" },
  { id: "c", bottle: "soda-pink", name: { zh: "晚睡莓汁", en: "Late-Night Berry" }, color: "#EE9DC0" },
];

export const drinkOf = (id: DrinkChoice) => DRINKS.find((d) => d.id === id)!;
