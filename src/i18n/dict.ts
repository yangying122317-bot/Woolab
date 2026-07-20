export type Lang = "zh" | "en";

/** 双语文本：数据文件中所有需要翻译的字段都用这个结构 */
export type Localized = { zh: string; en: string };

/**
 * 界面文案字典。
 * 替换网站文案时只需要改这里（数据类内容在 src/data/ 下各文件中）。
 */
export const dict = {
  zh: {
    siteName: "WOOLAB",
    tagline: "欢迎来到小羊居住的地方",
    mapHint: "点击场景里的物件开始探索",
    backToMap: "返回首页",
    "nav.characters": "角色",
    "nav.about": "关于",
    "nav.stories": "故事",
    "nav.lab": "实验室",
    "nav.downloads": "下载",
    "nav.contact": "联系",
    "characters.title": "角色介绍",
    "characters.subtitle": "住在这里的伙伴们",
    "about.title": "关于这个世界",
    "stories.title": "故事系列",
    "stories.subtitle": "发生在这里的故事",
    "stories.episodes": "篇章",
    "stories.notFound": "没有找到这个系列",
    "lab.title": "实验室",
    "lab.subtitle": "正在进行的小实验",
    "downloads.title": "下载",
    "downloads.placeholder": "壁纸和素材正在准备中，敬请期待。",
    "contact.title": "联系我们",
    "contact.placeholder": "合作与咨询入口即将开放。",
    "intro.skip": "跳过",
    close: "关闭",
  },
  en: {
    siteName: "WOOLAB",
    tagline: "Welcome to the place where Little Sheep lives",
    mapHint: "Click an object in the scene to explore",
    backToMap: "Back to home",
    "nav.characters": "Characters",
    "nav.about": "About",
    "nav.stories": "Stories",
    "nav.lab": "Lab",
    "nav.downloads": "Downloads",
    "nav.contact": "Contact",
    "characters.title": "Characters",
    "characters.subtitle": "Friends who live here",
    "about.title": "About this world",
    "stories.title": "Story Series",
    "stories.subtitle": "Tales from this place",
    "stories.episodes": "Episodes",
    "stories.notFound": "Series not found",
    "lab.title": "Laboratory",
    "lab.subtitle": "Little experiments in progress",
    "downloads.title": "Downloads",
    "downloads.placeholder": "Wallpapers and goodies are on the way. Stay tuned!",
    "contact.title": "Contact",
    "contact.placeholder": "Collaboration inquiries will open soon.",
    "intro.skip": "Skip",
    close: "Close",
  },
} as const;

export type DictKey = keyof (typeof dict)["zh"];
