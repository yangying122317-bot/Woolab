import type { DictKey } from "../i18n/dict";

export interface HeroHotspot {
  id: string;
  /** 对应路由路径；小羊不跳页（点击弹身份卡），path 为空字符串 */
  path: string;
  /** 名称在语言字典中的 key */
  labelKey: DictKey;
  /**
   * 热区在场景图中的位置和大小，
   * 均为相对于原图（1440 x 900）的百分比（0-100）。
   * 与 Figma 画板「首页主视觉 · WOOLAB 小屋」中的分组一一对应。
   */
  left: number;
  top: number;
  width: number;
  height: number;
}

const FRAME_W = 1440;
const FRAME_H = 900;

/** 把 Figma 里的像素坐标换算成百分比 */
function rect(x: number, y: number, w: number, h: number) {
  return {
    left: (x / FRAME_W) * 100,
    top: (y / FRAME_H) * 100,
    width: (w / FRAME_W) * 100,
    height: (h / FRAME_H) * 100,
  };
}

/**
 * 首页场景图上的可点击热区。
 * 坐标来自 Figma 文件 yang 中对应分组的包围盒，
 * 若在 Figma 中移动了元素，把新的 x/y/w/h 填进来即可。
 */
export const heroHotspots: HeroHotspot[] = [
  {
    id: "sheep",
    path: "",
    labelKey: "nav.characters",
    // 门口的小羊（Figma: 热区 · 小羊）：hover 打招呼，点击弹身份卡
    ...rect(829, 588, 166, 270),
  },
  {
    id: "life",
    path: "/life",
    labelKey: "nav.life",
    // 蓝色玻璃门（Figma: 热区 · 玻璃门）：开门过场 → 屋内看小羊的生活
    ...rect(589, 516, 269, 276),
  },
  {
    id: "about",
    path: "/about",
    labelKey: "nav.about",
    // WOOLAB 招牌 + 上方吊灯（悬停任一处都开灯）：品牌故事
    ...rect(623, 359, 196, 143),
  },
  {
    id: "lab",
    path: "/lab",
    labelKey: "nav.lab",
    // 黄色立式小黑板（Figma: 热区 · 黄色小黑板）：实验室
    ...rect(161, 696, 154, 121),
  },
  {
    id: "contact",
    path: "/contact",
    labelKey: "nav.contact",
    // 橙色邮箱（Figma: 热区 · 橙色邮箱）
    ...rect(1161, 591, 109, 218),
  },
];
