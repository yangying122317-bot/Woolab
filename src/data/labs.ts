import type { Localized } from "../i18n/dict";

/**
 * 实验室项目：小羊做过的实物产品，每个项目 = 列表卡片 + 详情页。
 * 详情页固定三段：设计过程（process）→ 实物产品（product）→ 下载（download），
 * 三段都是可选字段，缺了就不渲染对应段落。
 *
 * 生活页四个互动完成后解锁的介绍，最终会链到这里对应的项目详情。
 */

export interface LabProject {
  id: string;
  title: Localized;
  description: Localized;
  /** 项目配图（放在 public/assets/lab/ 下） */
  image: string;
  /** 设计过程：按顺序渲染的图文步骤 */
  process?: { title: Localized; text: Localized; image?: string }[];
  /** 实物产品展示 */
  product?: { image: string; caption: Localized };
  /** 下载/获取（href 为空 = 占位按钮"即将开放"） */
  download?: { label: Localized; href?: string };
  /** 可选外部链接（老字段，保留） */
  link?: string;
}

export const labProjects: LabProject[] = [
  {
    id: "tee",
    title: { zh: "印花 T 恤", en: "Printed Tee" },
    description: {
      zh: "占位：小羊的第一件印花 T 恤。",
      en: "Placeholder: the sheep's first printed tee.",
    },
    image: "/assets/lab/lab-1.svg",
    process: [
      {
        title: { zh: "草图", en: "Sketch" },
        text: { zh: "占位：图案最初的几版草图。", en: "Placeholder: early sketches." },
      },
      {
        title: { zh: "定稿", en: "Final art" },
        text: { zh: "占位：确定印花和位置。", en: "Placeholder: final print and placement." },
      },
      {
        title: { zh: "印制", en: "Printing" },
        text: { zh: "占位：打样与印刷过程。", en: "Placeholder: sampling and printing." },
      },
    ],
    product: {
      image: "/assets/lab/lab-1.svg",
      caption: { zh: "占位：成品实拍。", en: "Placeholder: product photo." },
    },
    download: { label: { zh: "印花壁纸", en: "Print wallpaper" } },
  },
  {
    id: "sticker",
    title: { zh: "贴纸套装", en: "Sticker Set" },
    description: {
      zh: "占位：一套小羊日常贴纸。",
      en: "Placeholder: a set of everyday sheep stickers.",
    },
    image: "/assets/lab/lab-2.svg",
    process: [
      {
        title: { zh: "选题", en: "Ideas" },
        text: { zh: "占位：挑选贴纸的主题瞬间。", en: "Placeholder: picking the moments." },
      },
      {
        title: { zh: "绘制", en: "Drawing" },
        text: { zh: "占位：逐张绘制与调整。", en: "Placeholder: drawing one by one." },
      },
    ],
    product: {
      image: "/assets/lab/lab-2.svg",
      caption: { zh: "占位：成品实拍。", en: "Placeholder: product photo." },
    },
    download: { label: { zh: "表情包", en: "Emoji pack" } },
  },
  {
    id: "drink",
    title: { zh: "「一口咩」小酒杯", en: "'One Sip Baa' Cup" },
    description: {
      zh: "占位：小羊的迷你小酒杯。",
      en: "Placeholder: the sheep's tiny cup.",
    },
    image: "/assets/lab/lab-1.svg",
    process: [
      {
        title: { zh: "造型", en: "Shape" },
        text: { zh: "占位：杯型和容量的推敲。", en: "Placeholder: shaping the cup." },
      },
      {
        title: { zh: "打样", en: "Sampling" },
        text: { zh: "占位：材质与打样过程。", en: "Placeholder: material and samples." },
      },
    ],
    product: {
      image: "/assets/lab/lab-1.svg",
      caption: { zh: "占位：成品实拍。", en: "Placeholder: product photo." },
    },
  },
  {
    id: "candle",
    title: { zh: "小羊香薰蜡烛", en: "Sheep Scented Candle" },
    description: {
      zh: "占位：点亮房间的那支蜡烛。",
      en: "Placeholder: the candle that lights the room.",
    },
    image: "/assets/lab/lab-2.svg",
    process: [
      {
        title: { zh: "香型", en: "Scent" },
        text: { zh: "占位：香味的选择与配比。", en: "Placeholder: choosing the scent." },
      },
      {
        title: { zh: "翻模", en: "Molding" },
        text: { zh: "占位：小羊造型的翻模过程。", en: "Placeholder: molding the sheep." },
      },
    ],
    product: {
      image: "/assets/lab/lab-2.svg",
      caption: { zh: "占位：成品实拍。", en: "Placeholder: product photo." },
    },
  },
];
