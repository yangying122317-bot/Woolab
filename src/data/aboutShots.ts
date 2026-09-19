/**
 * About 页拍立得：一张相纸 = 一"拍"。文案来自 Figma「文案」表（编号 / 章节 / 主句 / 补充句）。
 * - photo：相纸窗口里的图（162×124 稿单位，object-fit: cover）。
 * - title：右下角的小标题 = 章节；序号按顺序自动编。
 * - note.left = 主句，note.right = 补充句。用 \n 手动断行（一行一行冒出来要靠它）；
 *   *星号* 包起来的词画圈、_下划线_ 包起来的词划线，位置按实际文字量出来，要落在同一行里。
 *
 * 表里的第 06 条「接下来 / What's Next」是最后翻过去的蓝色那页（aboutNext），不占一拍。
 */

/** 翻过去的那页：标题 / 副标 / 底下那行手写字（同样的 *圈* _划线_ 标记）/ 页脚两个链接 */
export const aboutNext = {
  title: { zh: "接下来", en: "What's Next" },
  sub: { zh: "WOOLAB 仍在形成", en: "WOOLAB is still taking shape" },
  line: {
    zh: "*新的角色*、_作品_和*空间*，会继续慢慢加入这里。",
    en: "*New characters,* _works,_ and *spaces* will slowly find their way here.",
  },
  life: { zh: "去 Meelo 的小屋", en: "Visit Meelo's Life" },
  lab: { zh: "进 Meelo 的画廊", en: "Enter the Meelo's Gallery" },
};

export type AboutShot = {
  id: string;
  photo: string;
  title: { zh: string; en: string };
  note: {
    left: { zh: string; en: string };
    right: { zh: string; en: string };
  };
};

export const aboutShots: AboutShot[] = [
  {
    id: "space",
    photo: "/assets/about/photo-house.webp",
    title: { zh: "这个空间", en: "The Space" },
    note: {
      left: {
        zh: "WOOLAB 是一个\n持续展开的*创作空间*。",
        en: "WOOLAB is\n*a creative space*\nthat keeps unfolding.",
      },
      right: {
        zh: "这里有角色、图像、\n物件和体验，\n也始终为_新的内容_留着位置。",
        en: "It holds characters, images,\nobjects, and experiences,\nwith room for _more to come._",
      },
    },
  },
  {
    id: "meelo",
    photo: "/assets/about/photo-window.webp",
    title: { zh: "Meelo", en: "Meet Meelo" },
    note: {
      left: {
        zh: "现在，*Meelo* 住在这里。",
        en: "For now, *Meelo* lives here.",
      },
      right: {
        zh: "它安静、慢热，\n偶尔有点小情绪，\n也总能注意到\n_容易被忽略的细节_。",
        en: "Quiet, slow to warm up,\nand occasionally a little moody,\nMeelo notices _the details_\nothers often miss.",
      },
    },
  },
  {
    id: "observe",
    photo: "/assets/about/photo-camera.webp",
    title: { zh: "从观察开始", en: "Observe" },
    note: {
      left: {
        zh: "生活会留下*痕迹*。",
        en: "Life leaves *traces.*",
      },
      right: {
        zh: "一个动作、一种语气，\n或某个被记住的瞬间，\n都可能成为_创作的起点_。",
        en: "A gesture, a tone,\nor a moment that stays with us\ncan become _the beginning_\nof an idea.",
      },
    },
  },
  {
    id: "form",
    photo: "/assets/about/photo-desk.webp",
    title: { zh: "换一种形式", en: "Another Form" },
    note: {
      left: {
        zh: "在 WOOLAB，一个想法\n不必停在*一种形式*里。",
        en: "At WOOLAB, an idea doesn't\nhave to stay in *one form.*",
      },
      right: {
        zh: "它可以成为图像、衣服、\n贴纸、物件，\n也可以变成一个\n_能够进入的空间_。",
        en: "It can become an image,\nclothing, a sticker, an object,\nor even _a space_\nyou can step into.",
      },
    },
  },
  {
    id: "part",
    photo: "/assets/about/photo-door.webp",
    title: { zh: "走进来", en: "Take Part" },
    note: {
      left: {
        zh: "WOOLAB 不只是\n一个*被观看*的地方。",
        en: "WOOLAB is more than\n*a place to look at.*",
      },
      right: {
        zh: "你可以走进来、翻看、选择，\n也可以_参与其中_。",
        en: "You can step inside, explore,\nmake choices, and _take part._",
      },
    },
  },
];
