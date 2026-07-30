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
 * 长卷总宽（vh）：已接入的段落（衣帽区到起居区，约 335vh）+ 后续段落的预留区。
 * 每段画板左右都带大片留白，所以段落是按实际画到的内容首尾相接的，
 * 不按画板宽度累加——接新段时看它最右元素的位置再加预留。
 */
export const ROOM_TOTAL_VH = 595;

export const lifeStations: LifeStation[] = [
  {
    id: "tee",
    name: { zh: "衣服堆", en: "The clothes pile" },
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
    hint: { zh: "相片缺了几块。", en: "The photo is missing a few pieces." },
    intro: {
      zh: "占位：贴纸产品和这张旧相片的故事。",
      en: "Placeholder: the sticker set and the old photo's story.",
    },
    result: { zh: "相片补好了", en: "Photo restored" },
    // 段02 软木板上的那张海报（素材坐标 x4598 y407, 512x590）
    left: 255.4, top: 22.6, width: 28.4, height: 32.8,
  },
  {
    id: "drink",
    name: { zh: "小桌与饮料", en: "The little table" },
    hint: { zh: "给它调一杯今晚的饮料？", en: "Mix it a drink for tonight?" },
    intro: {
      zh: "占位：三种饮料和「一口咩」小酒杯的介绍。",
      en: "Placeholder: three drinks and the 'One Sip Baa' cup.",
    },
    result: { zh: "调好的一杯", en: "A drink, ready" },
    // 起居区之后的预留区，等对应段落素材到位再对位
    left: 335, top: 52, width: 28, height: 30,
  },
  {
    id: "candle",
    name: { zh: "床头的蜡烛", en: "The bedside candle" },
    hint: { zh: "屋里有点暗了。", en: "It's getting a bit dim." },
    intro: {
      zh: "占位：小羊香薰蜡烛的香型与制作。",
      en: "Placeholder: the sheep candle's scent and making.",
    },
    result: { zh: "一直亮着", en: "Still burning" },
    left: 445, top: 46, width: 20, height: 30,
  },
];

/** 夜晚出现的 LAB 入口（长卷尽头的门），坐标单位同站点（vh） */
export const LAB_DOOR = { left: 530, top: 28, width: 36, height: 58 };
