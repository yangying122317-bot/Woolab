import type { SceneLayer } from "./seg01Layers";

/**
 * 段03（厨房 · 蜡烛角 · LAB 门）的分层元素。
 *
 * 坐标同样是长卷素材像素（画板高 1800px = 100vh，渲染时除以 18）。
 * 从 Figma 整屋画板（1/4 缩尺）换算：absoluteRenderBounds × 4，再
 * - 横向 -190（以软木板为锚对齐已上线的起居区）
 * - 纵向 -32（沿用地板线校正）
 *
 * 数组顺序即叠放顺序（沿用 Figma 图层从下到上）。
 * 蜡烛火焰（candle-flame.webp, 舞台位 10324,450,56x97）不在此列，
 * 由 RoomStage 按「点蜡烛」完成状态条件渲染。
 */
export const seg03Layers: SceneLayer[] = [
  { src: "side-cabinet", x: 11571, y: 1193, w: 447, h: 339, anim: "static", dir: "seg03" },
  { src: "purple-plant-a", x: 11681, y: 1058, w: 141, h: 147, anim: "static", dir: "seg03" },
  { src: "purple-plant-b", x: 11581, y: 882, w: 355, h: 303, anim: "static", dir: "seg03" },
  { src: "top-cupboard", x: 6331, y: 41, w: 1087, h: 458, anim: "static", dir: "seg03" },
  { src: "tile-wall", x: 6331, y: 745, w: 3055, h: 595, anim: "static", dir: "seg03" },
  { src: "kitchen-floor", x: 6297, y: 1385, w: 3655, h: 199, anim: "static", dir: "seg03" },
  { src: "floor-tiles", x: 6286, y: 1385, w: 3642, h: 185, anim: "static", dir: "seg03" },
  { src: "counter-b", x: 8140, y: 1013, w: 1213, h: 481, anim: "static", dir: "seg03" },
  { src: "floor-line", x: 6332, y: 1565, w: 3625, h: 62, anim: "static", dir: "seg03" },
  // 挂杆上的厨具：设计稿里排在灶台/高柜/立柱之下，荡起来时会被柜体边框遮住
  { src: "utensil-clip", x: 6466, y: 409, w: 140, h: 279, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "utensil-spoon", x: 6620, y: 408, w: 86, h: 295, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "utensil-spatula", x: 6719, y: 407, w: 134, h: 289, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "utensil-glove", x: 7012, y: 415, w: 188, h: 239, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "utensil-scoop", x: 7224, y: 414, w: 95, h: 240, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "stove", x: 6459, y: 984, w: 1249, h: 531, anim: "static", dir: "seg03" },
  { src: "counter-a", x: 7564, y: 925, w: 664, h: 629, anim: "static", dir: "seg03" },
  // 厨房柜开放格上的黄格纹小帘子（挡住柜内餐具）；鼠标碰到会被撩起来
  { src: "curtain", x: 7612, y: 1010, w: 565, h: 449, anim: "static", dir: "seg03", hoverLift: true },
  { src: "pot", x: 6601, y: 806, w: 340, h: 213, anim: "static", dir: "seg03" },
  { src: "cabinet-tall", x: 6335, y: -32, w: 690, h: 1682, anim: "static", dir: "seg03" },
  { src: "pillar-l", x: 6287, y: -32, w: 86, h: 1707, anim: "static", dir: "seg03" },
  { src: "pillar-shadow", x: 9808, y: -32, w: 121, h: 1603, anim: "static", dir: "seg03" },
  { src: "pillar-r", x: 9907, y: -32, w: 86, h: 1707, anim: "static", dir: "seg03" },
  { src: "cabinet-inner", x: 6403, y: 1329, w: 557, h: 246, anim: "static", dir: "seg03" },
  { src: "fridge", x: 9296, y: 442, w: 572, h: 1096, anim: "static", dir: "seg03" },
  { src: "spice-jar", x: 7224, y: 866, w: 102, h: 185, anim: "static", dir: "seg03" },
  { src: "cutting-board", x: 7288, y: 994, w: 303, h: 97, anim: "static", dir: "seg03" },
  { src: "carrot-basket", x: 7630, y: 666, w: 440, h: 282, anim: "static", dir: "seg03" },
  { src: "board-carrots", x: 7336, y: 958, w: 224, h: 83, anim: "static", dir: "seg03" },
  { src: "coffee-machine", x: 8258, y: 722, w: 284, h: 342, anim: "static", dir: "seg03" },
  { src: "coffee-cup", x: 8560, y: 961, w: 137, h: 97, anim: "static", dir: "seg03" },
  // 大圆桌重导为未裁剪版：桌腿延伸到画面底部之外（原先被画板边缘截断）
  { src: "big-table", x: 8170, y: 1240, w: 1540, h: 1031, anim: "static", dir: "seg03" },
  { src: "glasses", x: 9109, y: 1488, w: 375, h: 159, anim: "static", dir: "seg03" },
  { src: "lemon-a", x: 8543, y: 1248, w: 73, h: 91, anim: "static", dir: "seg03" },
  { src: "lemon-b", x: 8705, y: 1273, w: 73, h: 91, anim: "static", dir: "seg03" },
  { src: "lemon-c", x: 8655, y: 1305, w: 73, h: 91, anim: "static", dir: "seg03" },
  { src: "lemon-d", x: 8780, y: 1226, w: 73, h: 91, anim: "static", dir: "seg03" },
  { src: "bottle-a", x: 9457, y: 1409, w: 116, h: 188, anim: "static", dir: "seg03" },
  { src: "table-board", x: 8312, y: 1368, w: 453, h: 241, anim: "static", dir: "seg03" },
  { src: "board-lemon", x: 8465, y: 1407, w: 205, h: 131, anim: "static", dir: "seg03" },
  { src: "kitchen-window", x: 7523, y: -32, w: 949, h: 543, anim: "static", dir: "seg03" },
  { src: "couch", x: 11748, y: 1070, w: 574, h: 550, anim: "static", dir: "seg03" },
  // CHEERS 牌改挂在冰箱门上（蓝图钉钉住）
  { src: "cheers-sign", x: 9462, y: 686, w: 337, h: 347, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "bottle-b", x: 8783, y: 815, w: 97, h: 244, anim: "static", dir: "seg03" },
  { src: "bottle-c", x: 8887, y: 807, w: 97, h: 253, anim: "static", dir: "seg03" },
  { src: "bottle-d", x: 9059, y: 826, w: 92, h: 238, anim: "static", dir: "seg03" },
  { src: "bottle-e", x: 9163, y: 921, w: 100, h: 141, anim: "static", dir: "seg03" },
  { src: "knife", x: 8642, y: 1460, w: 296, h: 167, anim: "static", dir: "seg03" },
  // 门整体下移 30px：底边压到蓝地板起始线（1418），落地更实
  { src: "lab-door", x: 10799, y: 319, w: 703, h: 1105, anim: "static", dir: "seg03" },
  { src: "pendant-a", x: 8712, y: -32, w: 224, h: 406, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "pendant-b", x: 9124, y: -32, w: 224, h: 406, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "cushion", x: 12007, y: 1181, w: 315, h: 234, anim: "static", dir: "seg03" },
  { src: "stool", x: 10476, y: 1170, w: 332, h: 445, anim: "static", dir: "seg03" },
  { src: "candle-shelf", x: 10236, y: 649, w: 408, h: 78, anim: "static", dir: "seg03" },
  { src: "aroma-candle", x: 10424, y: 437, w: 200, h: 221, anim: "static", dir: "seg03" },
  { src: "candle-wax", x: 10296, y: 537, w: 104, h: 127, anim: "static", dir: "seg03" },
  { src: "candle-holder", x: 10288, y: 526, w: 121, h: 90, anim: "static", dir: "seg03" },
  { src: "kettle", x: 10188, y: 1462, w: 332, h: 186, anim: "static", dir: "seg03" },
  { src: "potted-plant", x: 10560, y: 894, w: 337, h: 328, anim: "static", dir: "seg03" },
  { src: "lab-sign", x: 10963, y: 89, w: 381, h: 169, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "pendant-c", x: 11960, y: -32, w: 301, h: 660, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "ice-bucket", x: 9032, y: 1139, w: 217, h: 265, anim: "static", dir: "seg03" },
  { src: "lemon-plate", x: 8764, y: 1288, w: 316, h: 196, anim: "static", dir: "seg03" },
  { src: "lemon-bowl", x: 9123, y: 1314, w: 351, h: 300, anim: "static", dir: "seg03" },
];
