import type { SceneLayer } from "./seg01Layers";

/**
 * 段02（起居区）的分层元素，2026.8.14 按新版整屋效果图更新：
 * - 软木板改成拼图前状态：完整海报（poster/tape）撤下，10 块碎片散钉在板上（PhotoPuzzle 渲染）
 * - 板右侧改为上下两层置物板：上层笔筒，下层奶壶红花
 * - 贴纸、剪刀微调位置
 *
 * 坐标是长卷素材像素（画板高 1800px = 100vh，渲染时除以 18）。
 * 新增/移动元素的坐标来自整屋效果图的模板匹配（scale 0.1005，
 * 以画家小羊为原点锚），未变动元素沿用旧坐标。
 *
 * 数组顺序即叠放顺序。
 */
export const seg02Layers: SceneLayer[] = [
  // 墙上的软木板：拼图前状态。10 块海报碎片由 PhotoPuzzle 渲染（真切片，见该组件）
  { src: "board", x: 4327, y: 165, w: 1058, h: 1166, anim: "static", dir: "seg02" },
  { src: "house-photo", x: 4434, y: 618, w: 222, h: 220, anim: "static", dir: "seg02" },
  { src: "tape-photo-a", x: 4526, y: 611, w: 35, h: 73, anim: "static", dir: "seg02" },
  { src: "bag", x: 4235, y: 344, w: 293, h: 405, anim: "static", dir: "seg02", hoverPendulum: true },
  { src: "photo-card", x: 5165, y: 340, w: 248, h: 232, anim: "static", dir: "seg02" },
  { src: "sticker", x: 5127, y: 712, w: 112, h: 160, anim: "static", dir: "seg02" },
  { src: "tape-photo-b", x: 4654, y: 850, w: 69, h: 80, anim: "static", dir: "seg02" },
  // 剪刀：黄图钉在上方，荡的时候绕图钉转
  { src: "scissors", x: 4311, y: 801, w: 276, h: 280, anim: "static", dir: "seg02", hoverPendulum: true, pivot: "45% 21%" },
  { src: "pin", x: 4420, y: 831, w: 46, h: 47, anim: "static", dir: "seg02" },

  // 软木板右侧：上下两层置物板（上层笔筒，下层奶壶红花）
  { src: "shelf", x: 5515, y: 532, w: 408, h: 78, anim: "static", dir: "seg02" },
  { src: "shelf", x: 5694, y: 1070, w: 408, h: 78, anim: "static", dir: "seg02" },
  // 奶壶里的红花：碰到以花茎底部为轴轻轻摇两下
  { src: "flowers", x: 5764, y: 642, w: 302, h: 355, anim: "static", dir: "seg02", hoverPendulum: true, pivot: "50% 100%" },
  { src: "vase", x: 5813, y: 891, w: 201, h: 194, anim: "static", dir: "seg02" },

  // 画家角：画架在最后面，颜料桶在画架右脚边
  { src: "easel", x: 5044, y: 925, w: 507, h: 695, anim: "static", dir: "seg02" },
  { src: "paint-bucket", x: 5353, y: 1526, w: 626, h: 184, anim: "static", dir: "seg02" },

  // 起居角：黄地毯、龟背竹、带泰迪熊的沙发
  { src: "rug", x: 3144, y: 1458, w: 1105, h: 246, anim: "static", dir: "seg02" },
  { src: "plant", x: 3068, y: 770, w: 530, h: 759, anim: "static", dir: "seg02" },
  { src: "sofa", x: 3383, y: 1153, w: 602, h: 483, anim: "static", dir: "seg02" },

  // 两盏蓝吊灯（灯绳顶端在画面外）
  // 挂得低的这盏 hover 时除了荡还会亮灯（光锥见 RoomStage 的 LONG_PENDANT_LIGHT）
  { src: "pendant-long", x: 3708, y: -32, w: 301, h: 681, anim: "static", dir: "seg02", hoverPendulum: true },
  { src: "pendant-short", x: 3320, y: -32, w: 301, h: 475, anim: "static", dir: "seg02", hoverPendulum: true },

  // 画家小羊坐小凳上对着画布，脚边一串颜料渍，笔筒压最上层
  { src: "painter-sheep", x: 4490, y: 1030, w: 715, h: 704, anim: "static", dir: "seg02" },
  { src: "paint-drips", x: 4426, y: 1646, w: 269, h: 56, anim: "static", dir: "seg02" },
  { src: "pencil-cup", x: 5624, y: 284, w: 193, h: 263, anim: "static", dir: "seg02" },
];
