import type { Localized } from "../i18n/dict";

export interface Episode {
  id: string;
  title: Localized;
  /** 正文段落，按数组顺序渲染 */
  paragraphs: Localized[];
  /** 可选配图 */
  image?: string;
}

export interface StorySeries {
  id: string;
  title: Localized;
  summary: Localized;
  /** 封面图路径（放在 public/assets/stories/ 下） */
  cover: string;
  episodes: Episode[];
}

/**
 * 故事系列数据：新增系列或篇章只需追加记录，详情页模板自动复用。
 */
export const storySeries: StorySeries[] = [
  {
    id: "daily-life",
    title: { zh: "日常系列（占位）", en: "Daily Life (placeholder)" },
    summary: {
      zh: "占位简介：这个系列讲述小羊的日常。",
      en: "Placeholder: everyday moments of Little Sheep.",
    },
    cover: "/assets/stories/story-daily.svg",
    episodes: [
      {
        id: "ep-1",
        title: { zh: "第一篇：占位标题", en: "Episode 1: Placeholder" },
        paragraphs: [
          {
            zh: "占位正文第一段，替换成真实的故事内容。",
            en: "Placeholder paragraph one. Replace with the real story.",
          },
          {
            zh: "占位正文第二段。",
            en: "Placeholder paragraph two.",
          },
        ],
        image: "/assets/stories/story-daily.svg",
      },
      {
        id: "ep-2",
        title: { zh: "第二篇：占位标题", en: "Episode 2: Placeholder" },
        paragraphs: [
          {
            zh: "占位正文。",
            en: "Placeholder text.",
          },
        ],
      },
    ],
  },
  {
    id: "adventure",
    title: { zh: "冒险系列（占位）", en: "Adventure (placeholder)" },
    summary: {
      zh: "占位简介：小羊离开家去远方的故事。",
      en: "Placeholder: Little Sheep's journeys far from home.",
    },
    cover: "/assets/stories/story-adventure.svg",
    episodes: [
      {
        id: "ep-1",
        title: { zh: "第一篇：占位标题", en: "Episode 1: Placeholder" },
        paragraphs: [
          {
            zh: "占位正文。",
            en: "Placeholder text.",
          },
        ],
      },
    ],
  },
];
