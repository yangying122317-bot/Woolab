import type { SceneLayer } from "./seg01Layers";

/**
 * 段03（厨房 · 蜡烛角 · LAB 门），2026.8.14 按新版整屋效果图大改：
 * - 删掉瓷砖墙、左右立柱、高柜（含柜内层板）、灰色厨房地板条、旧吊柜、
 *   旧窗、旧橙色吊灯、旧料理台 counter-b 和桌上旧物（酒瓶/冰桶/纸杯组/
 *   柠檬散粒/餐板/刀等）
 * - 窗户挪到左侧白墙；新蓝底吊柜 + 两根挂杆；灶台群整体右移 548
 * - 新增 CHEERS 挂牌 + 常亮蓝吊灯（灯体 pendant-cheers + 光晕 pendant-light）
 * - 咖啡机搬到棕色边桌（coffee-table），配马克杯和铁罐
 * - 淡蓝新冰箱右移；白圆桌黄布重新摆盘（酱瓶/汽水/一口咩六连包/
 *   面包板水果刀/柠檬盘等）
 * - 地上加一段橙底白菱格地毯（kitchen-rug，floor-tiles 裁切的短款）
 * - 蜡烛角、蓝凳绿植、水壶、LAB 门、边柜、白沙发整体右移约 861
 *
 * 坐标是长卷素材像素（画板高 1800px = 100vh，渲染时除以 18）。
 * 全部来自整屋效果图的模板匹配（scale 0.1005，以画家小羊为原点锚），
 * 成簇平移的元素按簇内旧相对关系微调对齐。
 *
 * 数组顺序即叠放顺序。
 * 蜡烛火焰（candle-flame.webp，舞台位 11181,450,56x97）不在此列，
 * 由 RoomStage 常驻渲染（含摇曳动画）。
 * 灶台左脚的小绿植复用尽头边柜那盆（purple-plant-a/b，0.84 倍缩放）。
 */
export const seg03Layers: SceneLayer[] = [
  // 墙面：窗户（白墙上）、蓝底吊柜和两根挂杆
  { src: "kitchen-window", x: 6082, y: 115, w: 925, h: 626, anim: "static", dir: "seg03" },
  { src: "top-cupboard", x: 7286, y: 65, w: 1086, h: 362, anim: "static", dir: "seg03" },
  { src: "rail-long", x: 7206, y: 493, w: 549, h: 46, anim: "static", dir: "seg03" },
  { src: "rail-short", x: 7774, y: 493, w: 349, h: 46, anim: "static", dir: "seg03" },
  // 挂杆上的厨具：碰到会荡两下
  { src: "utensil-clip", x: 7276, y: 503, w: 140, h: 280, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "utensil-spoon", x: 7425, y: 493, w: 87, h: 295, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "utensil-spatula", x: 7525, y: 503, w: 135, h: 289, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "utensil-glove", x: 7784, y: 513, w: 189, h: 239, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "utensil-scoop", x: 7992, y: 513, w: 96, h: 241, anim: "static", dir: "seg03", hoverPendulum: true },

  // CHEERS 挂牌 + 上方的蓝吊灯（hover 亮灯：光锥顶端藏在灯泡后，压在挂牌上）
  { src: "cheers-sign", x: 8789, y: 433, w: 385, h: 394, anim: "static", dir: "seg03", hoverPendulum: true },
  { src: "pendant-light", x: 8631, y: 302, w: 720, h: 408, anim: "static", dir: "seg03" },
  { src: "pendant-cheers", x: 8838, y: -373, w: 301, h: 720, anim: "static", dir: "seg03" },

  // 灶台群（相对旧版整体 +548）
  { src: "stove", x: 7007, y: 984, w: 1249, h: 531, anim: "static", dir: "seg03" },
  { src: "pot", x: 7149, y: 806, w: 340, h: 214, anim: "static", dir: "seg03" },
  { src: "spice-jar", x: 7772, y: 866, w: 103, h: 185, anim: "static", dir: "seg03" },
  { src: "cutting-board", x: 7836, y: 994, w: 304, h: 97, anim: "static", dir: "seg03" },
  { src: "board-carrots", x: 7884, y: 958, w: 224, h: 84, anim: "static", dir: "seg03" },
  { src: "counter-a", x: 8112, y: 925, w: 664, h: 630, anim: "static", dir: "seg03" },
  // 厨房柜开放格上的蓝格纹小帘子；鼠标碰到会往上掀开
  { src: "curtain", x: 8160, y: 1010, w: 565, h: 449, anim: "static", dir: "seg03", hoverLift: true },
  { src: "carrot-basket", x: 8178, y: 666, w: 440, h: 282, anim: "static", dir: "seg03" },

  // 灶台左脚地上的小绿植（复用尽头边柜那盆，盆底落在地面 1547）
  { src: "purple-plant-a", x: 6838, y: 1424, w: 119, h: 123, anim: "static", dir: "seg03" },
  { src: "purple-plant-b", x: 6754, y: 1276, w: 298, h: 255, anim: "static", dir: "seg03" },

  // 地上的红色方格地毯（右端延伸到白圆桌桌布底下）
  { src: "kitchen-rug", x: 7196, y: 1547, w: 2229, h: 167, anim: "static", dir: "seg03" },

  // 淡蓝冰箱（在咖啡桌后面，左下角被桌子右端挡住）
  { src: "fridge", x: 10032, y: 443, w: 669, h: 1105, anim: "static", dir: "seg03" },

  // 咖啡角：棕色边桌 + 咖啡机（机身自带托盘杯）+ 马克杯 + 铁罐
  { src: "coffee-table", x: 9077, y: 1020, w: 1025, h: 482, anim: "static", dir: "seg03" },
  { src: "coffee-machine", x: 9316, y: 712, w: 284, h: 343, anim: "static", dir: "seg03" },
  { src: "mug", x: 9664, y: 970, w: 137, h: 98, anim: "static", dir: "seg03" },
  { src: "tin-can", x: 9823, y: 930, w: 101, h: 141, anim: "static", dir: "seg03" },

  // 白圆桌黄布和桌上的东西
  { src: "big-table", x: 8560, y: 1209, w: 1414, h: 1030, anim: "static", dir: "seg03" },
  { src: "placemat", x: 9216, y: 1450, w: 520, h: 157, anim: "static", dir: "seg03" },
  { src: "sauce-bottle", x: 8669, y: 1189, w: 89, h: 230, anim: "static", dir: "seg03" },
  { src: "soda-white", x: 8769, y: 1189, w: 90, h: 221, anim: "static", dir: "seg03" },
  { src: "soda-pink", x: 8878, y: 1189, w: 85, h: 218, anim: "static", dir: "seg03" },
  { src: "yikoumie-pack", x: 8997, y: 1139, w: 286, h: 253, anim: "static", dir: "seg03" },
  { src: "lemon-stand", x: 9405, y: 1130, w: 351, h: 301, anim: "static", dir: "seg03" },
  { src: "blue-towel", x: 9226, y: 1249, w: 47, h: 129, anim: "static", dir: "seg03" },
  { src: "paper-cup", x: 8848, y: 1428, w: 101, h: 121, anim: "static", dir: "seg03" },
  { src: "bread-board", x: 8978, y: 1408, w: 420, h: 226, anim: "static", dir: "seg03" },
  { src: "fruit-knife", x: 9042, y: 1434, w: 293, h: 138, anim: "static", dir: "seg03" },
  { src: "lemon-plate", x: 9505, y: 1408, w: 317, h: 197, anim: "static", dir: "seg03" },

  // 蜡烛角（相对旧版整体约 +861）
  { src: "candle-shelf", x: 11097, y: 649, w: 409, h: 79, anim: "static", dir: "seg03" },
  { src: "aroma-candle", x: 11286, y: 437, w: 200, h: 221, anim: "static", dir: "seg03" },
  { src: "candle-wax", x: 11157, y: 537, w: 105, h: 127, anim: "static", dir: "seg03" },
  { src: "candle-holder", x: 11147, y: 526, w: 122, h: 90, anim: "static", dir: "seg03" },

  // LAB 门 + 灯牌
  { src: "lab-door", x: 11654, y: 319, w: 704, h: 1106, anim: "static", dir: "seg03" },
  // LAB 灯牌：不摇摆，点蜡烛后换亮灯图（RoomStage 处理）
  { src: "lab-sign", x: 11823, y: 89, w: 382, h: 170, anim: "static", dir: "seg03" },

  // 蓝凳绿植 + 地上的水壶（画在 LAB 门前面；水壶由浇水彩蛋组件接管渲染）
  { src: "stool", x: 11296, y: 1170, w: 332, h: 445, anim: "static", dir: "seg03" },
  { src: "potted-plant", x: 11376, y: 894, w: 337, h: 329, anim: "static", dir: "seg03" },
  { src: "kettle", x: 11007, y: 1462, w: 332, h: 186, anim: "static", dir: "seg03" },

  // 尽头的休息角：边柜绿植、白沙发、青色吊灯
  { src: "side-cabinet", x: 12432, y: 1193, w: 448, h: 339, anim: "static", dir: "seg03" },
  { src: "purple-plant-a", x: 12542, y: 1058, w: 142, h: 147, anim: "static", dir: "seg03" },
  { src: "purple-plant-b", x: 12442, y: 882, w: 355, h: 304, anim: "static", dir: "seg03" },
  { src: "couch", x: 12609, y: 1070, w: 574, h: 550, anim: "static", dir: "seg03" },
  { src: "cushion", x: 12868, y: 1181, w: 316, h: 235, anim: "static", dir: "seg03" },
  { src: "pendant-c", x: 12818, y: -32, w: 301, h: 660, anim: "static", dir: "seg03", hoverPendulum: true },
];
