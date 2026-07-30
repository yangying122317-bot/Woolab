import type { SceneLayer } from "./seg01Layers";

/**
 * 段02（起居区）的分层元素：软木板、单人沙发、小圆桌、吊灯、落地植物、置物架。
 *
 * 坐标同样是长卷的素材像素（画板高 1800px = 100vh，渲染时除以 18）。
 * 从 Figma 画板换算：节点的 absoluteRenderBounds × 4，再
 * - 纵向 -32（设计稿地板线在 1451，站点平铺底图在 1419，整段上移踩到地上）
 * - 横向 +3510，让这一段紧跟在衣帽区的拖鞋后面，中间只留一段约 27vh 的空墙
 *   （画板本身左右都有大片留白，两段画板首尾相接会空出一屏多，所以往前收）
 *
 * 数组顺序即叠放顺序（沿用 Figma 图层从下到上）。
 */
export const seg02Layers: SceneLayer[] = [
  // 墙上的软木板与钉在上面的东西
  { src: "board", x: 4327, y: 265, w: 1058, h: 1078, anim: "static", dir: "seg02" },
  { src: "house-photo", x: 4434, y: 717, w: 223, h: 220, anim: "static", dir: "seg02", hoverPendulum: true },
  { src: "tape-photo-a", x: 4526, y: 711, w: 35, h: 73, anim: "static", dir: "seg02" },
  { src: "poster", x: 4598, y: 407, w: 512, h: 590, anim: "static", dir: "seg02" },
  { src: "bag", x: 4235, y: 444, w: 293, h: 405, anim: "static", dir: "seg02", hoverPendulum: true },
  { src: "photo-card", x: 5165, y: 438, w: 248, h: 232, anim: "static", dir: "seg02", hoverPendulum: true },
  { src: "sticker", x: 5180, y: 751, w: 112, h: 160, anim: "static", dir: "seg02", hoverPendulum: true },
  { src: "tape-photo-b", x: 4654, y: 950, w: 69, h: 80, anim: "static", dir: "seg02" },

  // 落地植物（玻璃瓶插的龟背竹）与它的影子：静止不摇
  { src: "plant-shadow", x: 5354, y: 1486, w: 282, h: 65, anim: "static", dir: "seg02" },
  { src: "plant", x: 5248, y: 777, w: 530, h: 759, anim: "static", dir: "seg02" },

  // 贴海报的两条胶带、板上的剪刀和图钉
  { src: "tape-l", x: 4576, y: 380, w: 98, h: 125, anim: "static", dir: "seg02" },
  { src: "tape-r", x: 5040, y: 376, w: 98, h: 125, anim: "static", dir: "seg02" },
  { src: "scissors", x: 4338, y: 889, w: 276, h: 280, anim: "static", dir: "seg02", hoverPendulum: true, pivot: "44% 20%" },
  { src: "pin", x: 4437, y: 923, w: 46, h: 47, anim: "static", dir: "seg02" },

  // 家具：单人沙发、置物架、小圆桌（桌腿在桌面之下）
  { src: "sofa", x: 3838, y: 1102, w: 539, h: 501, anim: "static", dir: "seg02" },
  // 置物板 + 花瓶挪到镜子和吊灯之间的空墙上
  { src: "shelf", x: 3202, y: 859, w: 410, h: 107, anim: "static", dir: "seg02" },
  { src: "table-leg", x: 4617, y: 1402, w: 305, h: 296, anim: "static", dir: "seg02" },
  { src: "table-top", x: 4328, y: 1231, w: 864, h: 209, anim: "static", dir: "seg02" },

  // 桌面与架上的小东西
  { src: "vase", x: 3261, y: 435, w: 302, h: 439, anim: "static", dir: "seg02" },
  { src: "cloth", x: 4625, y: 1244, w: 521, h: 307, anim: "static", dir: "seg02" },
  { src: "brush", x: 5241, y: 1551, w: 284, h: 218, anim: "static", dir: "seg02" },
  { src: "mug", x: 4695, y: 1185, w: 166, h: 141, anim: "static", dir: "seg02" },

  // 吊灯（灯绳顶端在画面外）
  { src: "lamp", x: 3794, y: -35, w: 350, h: 503, anim: "static", dir: "seg02", hoverPendulum: true },
];
