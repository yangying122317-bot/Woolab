/**
 * 段01（衣帽区）的分层元素。
 * 坐标与尺寸直接用素材原始像素（@2x、画板高 1800px），
 * 渲染时除以 18 换算成 vh。数组顺序即叠放顺序（前面的在下层）。
 */

export type LayerAnim =
  /** 静止 */
  | "static"
  /** 底部为轴轻轻摇（植物） */
  | "sway"
  /** 顶部为轴轻轻晃（挂着的衣服、纸张） */
  | "swing"
  /** 上浮 + 淡入淡出循环（音符） */
  | "float"
  /** 呼吸起伏（小羊） */
  | "breath"
  /** 轻微上下点动（小鸟） */
  | "bob";

export interface SceneLayer {
  /** public/assets/life/<dir>/ 下的文件名（不含扩展名） */
  src: string;
  /** 素材所在的段目录，默认 seg01 */
  dir?: "seg01" | "seg02";
  x: number;
  y: number;
  w: number;
  h: number;
  anim: LayerAnim;
  /** 循环动画的相位错开（秒） */
  delay?: number;
  /** 鼠标划过时以挂点为轴轻摆（挂杆上的衣服/衣挂） */
  hoverSwing?: boolean;
  /** 鼠标碰到时以图钉为轴荡几下再停回（钉在墙上的纸张） */
  hoverPendulum?: boolean;
  /** 摆动轴位置（CSS transform-origin），默认 "50% 3%"；图钉不在顶部中心时用 */
  pivot?: string;
}

export const seg01Layers: SceneLayer[] = [
  { src: "carpet", x: 753, y: 1497, w: 1490, h: 274, anim: "static" },
  // 窗户（含小鸟）由 RoomStage 里的 WindowAnim 帧序列动画渲染，不在此列表
  { src: "list", x: 908, y: 331, w: 293, h: 450, anim: "static", hoverPendulum: true },
  { src: "plant", x: 174, y: 1234, w: 221, h: 331, anim: "static" },
  { src: "cabinet", x: 453, y: 1243, w: 608, h: 339, anim: "static" },
  // 唱片机机身；唱片与唱臂由 RoomStage 里的 RecordPlayer 组件渲染（唱片会转）
  { src: "record-body", x: 549, y: 1115, w: 486, h: 141, anim: "static" },
  { src: "note-1", x: 920, y: 853, w: 73, h: 96, anim: "float" },
  { src: "note-2", x: 956, y: 993, w: 82, h: 76, anim: "float", delay: 1.5 },
  { src: "rack", x: 1280, y: 468, w: 839, h: 1117, anim: "static" },
  // 挂杆上的空衣挂、六件衣服、台面上叠着的蓝裤子和地上的衣服堆
  // 都由 RoomStage 里的 HangClothes 组件渲染（挂衣服互动）
  { src: "hat", x: 2060, y: 664, w: 164, h: 268, anim: "static" },
  { src: "sheep-rug", x: 2822, y: 1544, w: 487, h: 219, anim: "static" },
  { src: "slippers-1", x: 548, y: 1594, w: 206, h: 120, anim: "static" },
  { src: "slippers-2", x: 3099, y: 1540, w: 206, h: 120, anim: "static" },
  { src: "sheep-shadow", x: 2249, y: 1620, w: 279, h: 61, anim: "static" },
  { src: "mirror", x: 2321, y: 491, w: 692, h: 1068, anim: "static" },
  { src: "sheep", x: 2178, y: 1078, w: 424, h: 597, anim: "static" },
];
