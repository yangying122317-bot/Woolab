/**
 * 全局开关配置。
 */
export const config = {
  /** 是否启用开场动画（每个浏览器会话只播放一次） */
  introEnabled: true,
  /**
   * 移动端首页地图的展示方式：
   * - "list"：降级为列表式导航（默认，无需竖版地图素材）
   * - "map" ：使用竖版地图素材（public/assets/map-portrait.svg）
   */
  mobileMapMode: "list" as "list" | "map",
};
