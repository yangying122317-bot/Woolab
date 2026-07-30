import type { Localized } from "../i18n/dict";

/**
 * About 页的叙事章节：按顺序纵向滚动展示。
 * 增删章节只改这里，页面自动渲染。
 */
export interface AboutSection {
  id: string;
  title: Localized;
  text: Localized;
  /** 可选配图（占位阶段不填，渲染灰块） */
  image?: string;
}

export const aboutSections: AboutSection[] = [
  {
    id: "origin",
    title: { zh: "起源", en: "Where it began" },
    text: {
      zh: "占位：WOOLAB 是怎么开始的——最初的念头和第一张草图。",
      en: "Placeholder: how WOOLAB started — the first idea and the first sketch.",
    },
  },
  {
    id: "why-sheep",
    title: { zh: "为什么是小羊", en: "Why a sheep" },
    text: {
      zh: "占位：小羊作为第一个 IP 形象的来历和它的性格。",
      en: "Placeholder: why the sheep came first, and what it's like.",
    },
  },
  {
    id: "what-we-make",
    title: { zh: "我们在做什么", en: "What we make" },
    text: {
      zh: "占位：手作、印花、小物件——WOOLAB 想做的东西和做事的方式。",
      en: "Placeholder: handmade things, prints, little objects — and how we make them.",
    },
  },
  {
    id: "next",
    title: { zh: "接下来", en: "What's next" },
    text: {
      zh: "占位：正在准备的新东西，和这个小世界会长成什么样。",
      en: "Placeholder: what's coming, and how this little world will grow.",
    },
  },
];
