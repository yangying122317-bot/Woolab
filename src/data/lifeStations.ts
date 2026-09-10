import type { Localized } from "../i18n/dict";

/**
 * 「小羊的生活」四个互动站点的配置（原型骨架版）。
 * 正式插画到位后，只需要更新坐标和素材，交互结构不变。
 */

export type StationId = "tee" | "photo" | "drink" | "candle";

export interface LifeStation {
  id: StationId;
  /** 站点名（漫游态的标签） */
  name: Localized;
  /** 「今晚的小事」清单上写的那一行 */
  task: Localized;
  /** 小羊口吻的邀请语（专注态里未完成时显示） */
  hint: Localized;
  /** 完成后解锁的项目简介（占位文案） */
  intro: Localized;
  /** 完成后留在房间里的痕迹说明（占位结果物） */
  result: Localized;
  /**
   * 在长卷中的位置，单位全部是 vh（视口高度的 1%）。
   * 素材画板高 1800px(@2x) 铺满视口高，所以 1vh = 素材里的 18px，
   * 从素材坐标换算：值 = px / 18。left 从长卷最左边算起。
   */
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 长卷总宽（vh）：衣帽区 → 起居区 → 厨房/蜡烛角/LAB 门，
 * 到段03 最右侧的白沙发为止（舞台 12322px / 18 ≈ 685vh）。
 */
export const ROOM_TOTAL_VH = 733;

export const lifeStations: LifeStation[] = [
  {
    id: "tee",
    name: { zh: "衣服堆", en: "The clothes pile" },
    task: { zh: "挂起来，穿上白 T 恤。", en: "Hang it up. Put on the white tee." },
    hint: { zh: "衣服堆里好像埋着什么……", en: "Something's buried in the pile…" },
    intro: {
      zh: "占位：这件 T 恤的印花、面料和它的来历。",
      en: "Placeholder: the print, fabric and story of this tee.",
    },
    result: { zh: "小羊穿上了它", en: "It's wearing it now" },
    // 段01 里地上的衣服堆（素材坐标 x1571 y1449, 675x287，四周留点击余量）
    left: 84, top: 77, width: 44, height: 22,
  },
  {
    id: "photo",
    name: { zh: "墙上的相片", en: "The photo on the wall" },
    task: { zh: "帮 Meelo 画完那张海报。", en: "Help Meelo finish the poster." },
    hint: { zh: "相片缺了几块。", en: "The photo is missing a few pieces." },
    intro: {
      zh: "占位：贴纸产品和这张旧相片的故事。",
      en: "Placeholder: the sticker set and the old photo's story.",
    },
    result: { zh: "相片补好了", en: "Photo restored" },
    // 段02 软木板：拼图前散落的碎片区（舞台 4527,224 起，约 740x800）
    left: 251.5, top: 12.4, width: 41, height: 46,
  },
  {
    id: "drink",
    name: { zh: "小桌与饮料", en: "The little table" },
    task: { zh: "调一杯一口咩。", en: "Make a One Sip" },
    hint: { zh: "给它调一杯今晚的饮料？", en: "Mix it a drink for tonight?" },
    intro: {
      zh: "占位：三种饮料和「一口咩」小酒杯的介绍。",
      en: "Placeholder: three drinks and the 'One Sip Baa' cup.",
    },
    result: { zh: "调好的一杯", en: "A drink, ready" },
    // 段03 厨房的白圆桌：酱瓶汽水、一口咩、面包板柠檬盘都在桌上（舞台 8560,1120 起）
    left: 475.5, top: 62.2, width: 79, height: 33.5,
  },
  {
    id: "candle",
    name: { zh: "床头的蜡烛", en: "The bedside candle" },
    task: { zh: "点亮蜡烛。", en: "Light the candle" },
    hint: {
      zh: "借白蜡烛的火，点亮小羊蜡烛。",
      en: "Borrow the white candle's flame to light the sheep candle.",
    },
    intro: {
      zh: "占位：小羊香薰蜡烛的香型与制作。",
      en: "Placeholder: the sheep candle's scent and making.",
    },
    result: { zh: "一直亮着", en: "Still burning" },
    // 段03 蜡烛角的置物板：白蜡烛 + 小羊香薰蜡烛（舞台 11090,430 起）
    left: 616, top: 24, width: 22, height: 18,
  },
];

/** 夜晚出现的 LAB 入口（段03 的绿门），坐标单位同站点（vh） */
export const LAB_DOOR = { left: 647.5, top: 17.7, width: 39, height: 61.5 };
