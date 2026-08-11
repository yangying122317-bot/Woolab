import type { SceneLayer } from "./seg01Layers";

/**
 * 段02（起居区）的分层元素，2026.8.10 按新版整屋设计稿翻新：
 * - 新增画家小羊（画架、颜料桶、颜料渍、笔筒）
 * - 沙发换成带泰迪熊的版本，下面加黄色椭圆地毯
 * - 吊灯换成两盏蓝色圆吊灯（高低错落）
 * - 龟背竹挪到沙发左侧；置物板 + 花瓶回到软木板右侧
 * - 小圆桌四件套（桌腿/桌面/桌布/马克杯）和地上的画笔删除
 *
 * 坐标是长卷素材像素（画板高 1800px = 100vh，渲染时除以 18）。
 * 从 Figma 整屋画板（1/4 缩尺）换算：absoluteRenderBounds × 4，再
 * 横向 -190（以软木板为锚）、纵向 -32（地板线校正）。
 *
 * 数组顺序即叠放顺序（沿用 Figma 图层从下到上）。
 */
export const seg02Layers: SceneLayer[] = [
  // 墙上的软木板与钉在上面的东西
  { src: "board", x: 4327, y: 165, w: 1058, h: 1166, anim: "static", dir: "seg02" },
  { src: "house-photo", x: 4434, y: 618, w: 222, h: 220, anim: "static", dir: "seg02" },
  { src: "tape-photo-a", x: 4526, y: 611, w: 35, h: 73, anim: "static", dir: "seg02" },
  { src: "poster", x: 4600, y: 309, w: 512, h: 590, anim: "static", dir: "seg02" },
  { src: "bag", x: 4235, y: 344, w: 293, h: 405, anim: "static", dir: "seg02", hoverPendulum: true },
  { src: "photo-card", x: 5165, y: 340, w: 248, h: 232, anim: "static", dir: "seg02" },
  { src: "sticker", x: 5180, y: 651, w: 112, h: 160, anim: "static", dir: "seg02" },
  { src: "tape-photo-b", x: 4654, y: 850, w: 69, h: 80, anim: "static", dir: "seg02" },
  { src: "tape-l", x: 4576, y: 280, w: 98, h: 125, anim: "static", dir: "seg02" },
  { src: "tape-r", x: 5040, y: 276, w: 98, h: 125, anim: "static", dir: "seg02" },
  // 剪刀：黄图钉在上方，荡的时候绕图钉转
  { src: "scissors", x: 4362, y: 900, w: 276, h: 280, anim: "static", dir: "seg02", hoverPendulum: true, pivot: "45% 21%" },
  { src: "pin", x: 4464, y: 936, w: 46, h: 47, anim: "static", dir: "seg02" },

  // 软木板右侧：置物板、笔筒、花瓶（花在瓶后面）
  { src: "shelf", x: 5512, y: 741, w: 408, h: 78, anim: "static", dir: "seg02" },
  { src: "flowers", x: 5678, y: 308, w: 302, h: 355, anim: "static", dir: "seg02" },
  { src: "vase", x: 5728, y: 561, w: 201, h: 194, anim: "static", dir: "seg02" },

  // 画家角：画架在最后面，颜料桶在画架右脚边
  { src: "easel", x: 5044, y: 925, w: 507, h: 695, anim: "static", dir: "seg02" },
  { src: "paint-bucket", x: 5353, y: 1526, w: 626, h: 184, anim: "static", dir: "seg02" },

  // 起居角：黄地毯、龟背竹、带泰迪熊的沙发
  { src: "rug", x: 3144, y: 1458, w: 1105, h: 246, anim: "static", dir: "seg02" },
  { src: "plant", x: 3068, y: 770, w: 530, h: 759, anim: "static", dir: "seg02" },
  { src: "sofa", x: 3383, y: 1153, w: 602, h: 483, anim: "static", dir: "seg02" },

  // 两盏蓝吊灯（灯绳顶端在画面外）
  { src: "pendant-long", x: 3708, y: -32, w: 301, h: 681, anim: "static", dir: "seg02", hoverPendulum: true },
  { src: "pendant-short", x: 3320, y: -32, w: 301, h: 475, anim: "static", dir: "seg02", hoverPendulum: true },

  // 画家小羊坐小凳上对着画布，脚边一串颜料渍，笔筒压最上层
  { src: "painter-sheep", x: 4490, y: 1030, w: 715, h: 704, anim: "static", dir: "seg02" },
  { src: "paint-drips", x: 4426, y: 1646, w: 269, h: 56, anim: "static", dir: "seg02" },
  { src: "pencil-cup", x: 5519, y: 492, w: 193, h: 263, anim: "static", dir: "seg02" },
];
