import type { Localized } from "../i18n/dict";

/**
 * 实验室项目：小羊做过的实物产品，每个项目 = 列表卡片 + 详情页。
 * 详情页固定三段：设计过程（process）→ 实物产品（product）→ 下载（download），
 * 三段都是可选字段，缺了就不渲染对应段落。
 *
 * 生活页四个互动完成后解锁的介绍，最终会链到这里对应的项目详情。
 */

export interface Lookbook {
  /** 货号（左上标签） */
  sku: string;
  /** 产品名（右上标签） */
  productName: string;
  /** 顶部手写标题 */
  closet: string;
  /** 通栏主图：两张（左背面、右正面，各约 3:2 横图），或一张已经拼好的横图（strip） */
  photos: { back: string; front: string } | { strip: string };
  /** 页头下面那段话，按行拆开（打开时逐行出现） */
  lines: { zh: string[]; en: string[] };
  /**
   * 那段话里要画手绘装饰的词（原样写，要和某一行里的文字完全对上）：
   * underline 画下划线（可以好几个词）、circle 画圈。位置是渲染后量出来的，换行、改字不用调坐标。
   */
  marks?: { underline?: string[]; circle?: string };
  /** 产品表：五行 标签 / 内容（标签每个产品自己定，比如 T 恤是 FIT，贴纸是 TYPE） */
  sheet: { label: string; value: string }[];
  /**
   * 拼贴里的小图，都是 Figma 里直接导出的成品（带描边 / 胶带 / 调色）：
   * 左背面印花（竖）、右正面小标（横）、斜贴的拍立得
   */
  crops: { back: string; front: string };
  polaroid: string;
  /** 邮票贴纸（可缺） */
  postage?: string;
  /** 两句手写标注：左下 / 右下 */
  notes: { left: string; right: string };
  /**
   * 通栏照片上的两句手写标注（默认左 "Back" / 右 "Front"，位置是 T 恤 01 那张的）：
   * 可以改字、改位置（照片稿子 799 宽的坐标，字的左上角），填 false 不要这句。
   * 箭头跟着字走：back 的往右下指；front 的默认往左下指，flip = true 改成往右下指。
   */
  captions?: {
    front?: { text?: string; x?: number; y?: number; flip?: boolean } | false;
    back?: { text?: string; x?: number; y?: number } | false;
  };
}

export interface LabProject {
  id: string;
  title: Localized;
  description: Localized;
  /** 项目配图（放在 public/assets/lab/ 下） */
  image: string;
  /**
   * 详情页里那只画框（屏中钉着的主角，最后落到底部画框墙上）：
   * label 是框顶上的手写名字；frame 是连框带画的整张图（各产品框型不一样，自己带框），
   * 没有 frame 就用 art（框里的画）套统一的金框，都没填渲染占位。
   */
  wall?: { label: string; frame?: string; art?: string };
  /** 详情页信息条：年份 / 类别 */
  year?: string;
  category?: Localized;
  /**
   * 详情 lookbook（四个项目共用一套骨架）：一个项目可以有好几件，详情页一件接一件往下讲，
   * 每件都是 那段话 → 拼贴 → 通栏照片。没填的项目详情页渲染占位块。图片都放 public/assets/lab/detail/ 下。
   */
  looks?: Lookbook[];
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
      zh: "围绕 Meelo 的日常穿着：正面只留一个小标，背面是更满的印花，整件放松、不赶时间。",
      en: "Built around Meelo’s everyday look, with a minimal front and a fuller back graphic, keeping the mood relaxed and unhurried.",
    },
    image: "/assets/lab/lab-1.svg",
    wall: { label: "Meelo's Closet", art: "/assets/lab/detail/frame-sheep.webp" },
    year: "2026",
    category: { zh: "T 恤", en: "T-shirt" },
    looks: [
      {
        sku: "T-SHIRT 01",
        productName: "Little Lamb",
        closet: "Meelo's Closet",
        photos: {
          back: "/assets/lab/detail/photo-back.webp",
          front: "/assets/lab/detail/photo-front.webp",
        },
        lines: {
          zh: ["围绕 Meelo 的日常穿着：", "正面只留一个小标，背面是更满的印花，", "整件放松、不赶时间。"],
          en: [
            "Built around Meelo’s everyday look, with a minimal front and a",
            "fuller back graphic, keeping the mood relaxed and unhurried.",
          ],
        },
        marks: { underline: ["Meelo’s everyday look"], circle: "mood relaxed and" },
        sheet: [
          { label: "NAME:", value: "Little Lamb T-shirt" },
          { label: "FIT:", value: "Relaxed fit" },
          { label: "MATERIAL:", value: "Cotton" },
          { label: "COLOR:", value: "Off white" },
          { label: "PRINT:", value: "Front + back print" },
        ],
        crops: {
          back: "/assets/lab/detail/crop-back.webp",
          front: "/assets/lab/detail/crop-front.webp",
        },
        polaroid: "/assets/lab/detail/polaroid.webp",
        postage: "/assets/lab/detail/postage.webp",
        notes: {
          left: "Stripes, beanie, and bag.",
          right: "Woolab signature.",
        },
      },
      {
        sku: "T-SHIRT 02",
        productName: "Love Floating",
        closet: "Meelo's Closet",
        photos: { strip: "/assets/lab/detail/tee02-photo.webp" },
        lines: {
          zh: ["灵感来自漂在水上的 Meelo：", "用手写字和大片留白，", "留住一种更慢、更放松的心情。"],
          en: [
            "Inspired by Meelo floating on the water, using",
            "handwritten type and open space to capture a slower,",
            "more relaxed mood.",
          ],
        },
        marks: { underline: ["floating", "open space", "slower,"], circle: "more relaxed mood." },
        sheet: [
          { label: "NAME:", value: "Love Floating T-shirt" },
          { label: "FIT:", value: "Relaxed fit" },
          { label: "MATERIAL:", value: "Cotton" },
          { label: "COLOR:", value: "Off white" },
          { label: "PRINT:", value: "Front + back print" },
        ],
        crops: {
          back: "/assets/lab/detail/tee02-crop-back.webp",
          front: "/assets/lab/detail/tee02-crop-front.webp",
        },
        polaroid: "/assets/lab/detail/tee02-polaroid.webp",
        postage: "/assets/lab/detail/postage.webp",
        notes: {
          left: "Meelo in the pool.",
          right: "A small Meelo.",
        },
        /* 02 这张人的头偏右，Front 放到头左边的空墙上，箭头往右下指向胸口的小印花 */
        captions: { front: { x: 470, y: 14, flip: true } },
      },
    ],
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
    wall: { label: "Meelo's Daily", frame: "/assets/lab/detail/sticker-frame.webp" },
    looks: [
      {
        sku: "Sticker Pack",
        productName: "Daily Bits",
        closet: "Meelo's Daily",
        photos: { strip: "/assets/lab/detail/sticker-photo.webp" },
        lines: {
          zh: ["围绕 Meelo 的日常瞬间和小表情，", "把它们画成一张张小图案，", "跟着你每天用的东西到处走。"],
          en: [
            "Built around Meelo’s everyday moments and little reactions,",
            "turning them into small graphics made to travel across the things",
            "you use every day.",
          ],
        },
        marks: { underline: ["moments", "little reactions,"], circle: "every day." },
        sheet: [
          { label: "NAME:", value: "Meelo’s Daily Stickers" },
          { label: "TYPE:", value: "Transfer stickers" },
          { label: "MATERIAL:", value: "Transfer film" },
          { label: "FINISH:", value: "Matte" },
          { label: "DESIGN:", value: "Meelo graphic series" },
        ],
        crops: {
          back: "/assets/lab/detail/crop-back.webp",
          front: "/assets/lab/detail/crop-front.webp",
        },
        polaroid: "/assets/lab/detail/sticker-polaroid.webp",
        postage: "/assets/lab/detail/sticker-postage.webp",
        notes: { left: "Daily Bits.", right: "Little Reactions." },
        /* 左包左下写 Daily Bits（左上角留给靠边的画框）、右包右边写 Little Reactions */
        captions: {
          back: { text: "Daily Bits", x: 92, y: 196 },
          front: { text: "Little Reactions", x: 640, y: 70 },
        },
      },
    ],
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
    wall: { label: "Meelo's Bar", frame: "/assets/lab/detail/drink-frame.webp" },
    looks: [
      {
        sku: "Shot Glass",
        productName: "One Sip",
        closet: "Meelo's Bar",
        photos: { strip: "/assets/lab/detail/drink-photo.webp" },
        lines: {
          zh: ["围绕「一口就好」的小杯子：", "简单的杯型配上 Woolab 的图案，", "不多不少，刚刚好。"],
          en: [
            "Built around the idea of a small glass made for one sip,",
            "pairing a simple shape with Woolab graphics — nothing more,",
            "just enough.",
          ],
        },
        marks: { underline: ["one sip,", "just enough."], circle: "nothing more," },
        sheet: [
          { label: "NAME:", value: "One Sip Glass" },
          { label: "TYPE:", value: "Shot glass" },
          { label: "MATERIAL:", value: "Glass" },
          { label: "FINISH:", value: "Clear" },
          { label: "PRINT:", value: "Meelo graphic" },
        ],
        crops: {
          back: "/assets/lab/detail/crop-back.webp",
          front: "/assets/lab/detail/crop-front.webp",
        },
        polaroid: "/assets/lab/detail/drink-polaroid.webp",
        postage: "/assets/lab/detail/drink-postage.webp",
        notes: { left: "Small sips.", right: "Big vibes." },
        /* 照片上不写字 */
        captions: { back: false, front: false },
      },
    ],
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
    wall: { label: "Meelo's Night", frame: "/assets/lab/detail/candle-frame.webp" },
    looks: [
      {
        sku: "Candle",
        productName: "Meelo",
        closet: "Meelo's Night",
        photos: { strip: "/assets/lab/detail/candle-photo.webp" },
        lines: {
          zh: ["围绕入夜后安静的那几个小时：", "用暖暖的烛光和 Meelo 的图案，", "给房间添一点更柔和的心情。"],
          en: [
            "Built around the quiet hours after dark, using warm candlelight",
            "and Meelo graphics to bring a softer mood into the room.",
          ],
        },
        marks: { underline: ["a softer mood into the room."] },
        sheet: [
          { label: "NAME:", value: "Meelo Candle" },
          { label: "TYPE:", value: "Candle" },
          { label: "MOOD:", value: "Transfer film" },
          { label: "DESIGN:", value: "Matte" },
          { label: "SERIES:", value: "Meelo Goods | 2026" },
        ],
        crops: {
          back: "/assets/lab/detail/crop-back.webp",
          front: "/assets/lab/detail/crop-front.webp",
        },
        polaroid: "/assets/lab/detail/candle-polaroid.webp",
        postage: "/assets/lab/detail/candle-postage.webp",
        notes: { left: "Meelo graphic on the jar.", right: "Woolab mark underneath." },
        /* 蜡烛右上写一句，箭头往左下指着蜡烛；左边不写（左上角是画框靠边呆的地方） */
        captions: {
          back: false,
          front: { text: "Meelo graphic on the candle jar.", x: 300, y: 28 },
        },
      },
    ],
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
