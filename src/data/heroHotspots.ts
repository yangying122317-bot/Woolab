import type { DictKey } from "../i18n/dict";

export interface HeroHotspot {
  id: string;
  /** 对应路由路径 */
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
    id: "characters",
    path: "/characters",
    labelKey: "nav.characters",
    // 门口的小羊（Figma: 热区 · 小羊）
    ...rect(829, 588, 166, 270),
  },
  {
    id: "about",
    path: "/about",
    labelKey: "nav.about",
    // 蓝色玻璃门（Figma: 热区 · 玻璃门）
    ...rect(589, 516, 269, 276),
  },
  {
    id: "lab",
    path: "/lab",
    labelKey: "nav.lab",
    // WOOLAB 招牌（Figma: 热区 · WOOLAB 招牌）
    ...rect(623, 439, 196, 63),
  },
  {
    id: "downloads",
    path: "/downloads",
    labelKey: "nav.downloads",
    // 黄色立式小黑板（Figma: 热区 · 黄色小黑板）
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
