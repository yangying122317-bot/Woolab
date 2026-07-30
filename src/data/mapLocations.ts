import type { DictKey } from "../i18n/dict";

export interface MapLocation {
  id: string;
  /** 对应路由路径 */
  path: string;
  /** 导航名称在语言字典中的 key（改名去 src/i18n/dict.ts） */
  labelKey: DictKey;
  /** 地图上的位置，相对于地图容器的百分比坐标 */
  x: number;
  y: number;
}

/**
 * 首页地图上的地点。调整位置只需修改 x / y（0-100）。
 */
export const mapLocations: MapLocation[] = [
  { id: "life", path: "/life", labelKey: "nav.life", x: 30, y: 38 },
  { id: "about", path: "/about", labelKey: "nav.about", x: 55, y: 22 },
  // Stories 暂时隐藏，需要时取消下面这行注释即可（路由仍然保留）
  // { id: "stories", path: "/stories", labelKey: "nav.stories", x: 72, y: 45 },
  { id: "lab", path: "/lab", labelKey: "nav.lab", x: 44, y: 62 },
  { id: "news", path: "/news", labelKey: "nav.news", x: 66, y: 55 },
  // Downloads 暂时下线，恢复时取消注释（路由仍然保留）
  // { id: "downloads", path: "/downloads", labelKey: "nav.downloads", x: 18, y: 68 },
  { id: "contact", path: "/contact", labelKey: "nav.contact", x: 82, y: 72 },
];
