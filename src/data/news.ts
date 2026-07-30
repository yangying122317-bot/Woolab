import type { Localized } from "../i18n/dict";

/**
 * 小羊日报：不定期发行的插图与产品资讯。
 *
 * 发一期新内容 = 在这里加一条 + 图片放进 public/assets/news/。
 * 页面按日期倒序自动排版：
 * - 最新的带图内容 → 头条（大版面）
 * - 其余带图内容 → 次条（边栏）
 * - note 类 → 底部"小启事"豆腐块
 *
 * 动图插图用透明动画 WebP（和首页会呼吸的小羊同一条管线：
 * 短循环视频抠底后转 WebP），静态图也可以直接用。
 */

export type NewsKind = "illustration" | "product" | "note";

export interface NewsPost {
  id: string;
  /** 发布日期 "YYYY-MM-DD"，页面按它倒序排版 */
  date: string;
  kind: NewsKind;
  title: Localized;
  /** 插图/产品图（动图 WebP 或静态图），note 类可以不带 */
  image?: string;
  /** 图注或正文短句 */
  text?: Localized;
  /** 可选：链到 /lab/:id 或外部链接 */
  link?: string;
}

export const newsPosts: NewsPost[] = [
  {
    id: "summer-nap",
    date: "2026-07-24",
    kind: "illustration",
    title: { zh: "夏日午睡", en: "Summer nap" },
    text: {
      zh: "占位图注：小羊在树荫下睡着了，帽子盖在脸上。",
      en: "Placeholder caption: asleep under the tree, hat over its face.",
    },
  },
  {
    id: "tee-launch",
    date: "2026-07-20",
    kind: "product",
    title: { zh: "印花 T 恤上架了", en: "The printed tee is out" },
    text: {
      zh: "占位：第一批印花 T 恤印好了，数量不多。",
      en: "Placeholder: the first batch is ready, quantities are small.",
    },
    link: "/lab/tee",
  },
  {
    id: "rainy-window",
    date: "2026-07-15",
    kind: "illustration",
    title: { zh: "雨天的窗边", en: "By the rainy window" },
    text: {
      zh: "占位图注：一下雨它就趴在窗边不动了。",
      en: "Placeholder caption: it parks itself by the window when it rains.",
    },
  },
  {
    id: "mood-sunny",
    date: "2026-07-12",
    kind: "note",
    title: { zh: "小羊今日心情：晴", en: "Sheep's mood today: sunny" },
    text: {
      zh: "占位：因为午饭多吃了一口。",
      en: "Placeholder: because lunch had one extra bite.",
    },
  },
  {
    id: "sprout",
    date: "2026-07-08",
    kind: "note",
    title: { zh: "花盆里长出了新芽", en: "A sprout in the flowerpot" },
    text: {
      zh: "占位：不知道是什么，先浇着。",
      en: "Placeholder: no idea what it is; watering it anyway.",
    },
  },
];

/** 按日期倒序（最新在前） */
export function sortedNews(): NewsPost[] {
  return [...newsPosts].sort((a, b) => b.date.localeCompare(a.date));
}

/** 最新一期的日期（导航"有新刊"小圆点用） */
export function latestNewsDate(): string {
  return sortedNews()[0]?.date ?? "";
}

/** 用户是否还没看过最新一期 */
const SEEN_KEY = "woolab-news-seen";

export function hasUnreadNews(): boolean {
  return latestNewsDate() !== localStorage.getItem(SEEN_KEY);
}

export function markNewsSeen() {
  localStorage.setItem(SEEN_KEY, latestNewsDate());
}
