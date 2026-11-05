import { loadImages, warmBytes } from "../components/life/preload";
import { aboutShots } from "./aboutShots";

/**
 * Contact / About 两页的图（各几百 KB）：进页面才下会一张张冒出来（信封一片片拼、相机等半天）。
 *   - 首页开场结束、Life 第一屏预热完之后，静默把这两批拉进 HTTP 缓存（warmPages，只暖字节）；
 *   - 目录里鼠标碰到哪块牌子，就补拉那一页（warmContact / warmAbout）；
 *   - 页面自己进来时最多等 first 这几张解码完再整体淡入（whenXxxReady），没预热到也是"稍等一下整齐出现"。
 * 解码结果由 preload 里那个模块级缓存攥着，重复调用都是空操作。
 */

const C = "/assets/contact";
const A = "/assets/about";
const M = "/assets/menu";

/** 目录吊牌全部素材（19 张：四块牌的绳子、牌身、贴纸、胶带 + 两种夹子 + 水印）与顶栏涂鸦 */
export const MENU_ASSETS: readonly string[] = [
  ...(["about", "lab", "life", "contact"] as const).flatMap((id) => [
    `${M}/string-${id}.png`,
    `${M}/tag-${id}.webp`,
    `${M}/sticker-${id}.png`,
    `${M}/tape-${id}.png`,
  ]),
  `${M}/clip.png`,
  `${M}/clip-big.png`,
  `${M}/mark.png`,
  `${M}/circle.svg`,
  `${M}/underline.svg`,
];

let menuWarmed: Promise<void> | null = null;
/** 提前把目录页所有吊牌、贴纸、夹子解码进内存，点开 MENU 时直接整齐落下 */
export function warmMenu(): Promise<void> {
  if (!menuWarmed) menuWarmed = loadImages(MENU_ASSETS, 6);
  return menuWarmed;
}

/** Contact：信封 + 信纸 + 小羊 + 电话线与听筒全部先到齐，避免画面露出或电话掉落时缺件 */
export const CONTACT_FIRST = [
  `${C}/env-back.webp`,
  `${C}/paper.webp`,
  `${C}/env-front.webp`,
  `${C}/fold.webp`,
  `${C}/sheep.webp`,
  `${C}/cord.webp`,
  `${C}/handset.webp`,
  `${A}/noise-cream.png`,
];
export const CONTACT_REST: string[] = [];

/** About：相机、快门、第一张相纸的框和照片、水印先到齐；其余四张照片随后 */
export const ABOUT_FIRST = [
  `${A}/camera.webp`,
  `${A}/button.webp`,
  `${A}/frame.webp`,
  `${A}/mark.webp`,
  `${A}/noise-cream.png`,
  aboutShots[0].photo,
];
export const ABOUT_REST = [...aboutShots.slice(1).map((s) => s.photo), `${A}/noise-blue.png`, `${A}/arrow-l.png`, `${A}/arrow-r.png`];

let contact: Promise<void> | null = null;
let about: Promise<void> | null = null;

/** Contact 那批（先第一批再其余），返回第一批就位的 Promise */
export function warmContact(): Promise<void> {
  if (!contact) {
    contact = loadImages(CONTACT_FIRST);
    void contact.then(() => loadImages(CONTACT_REST, 4));
  }
  return contact;
}

/** About 那批（先第一批再其余），返回第一批就位的 Promise */
export function warmAbout(): Promise<void> {
  if (!about) {
    about = loadImages(ABOUT_FIRST);
    void about.then(() => loadImages(ABOUT_REST, 4));
  }
  return about;
}

/** Lab 开场那张全屏大油画 + 第一面墙与雕像：开场节拍等的就是它，先进缓存开场就不会只剩字 */
export const LAB_INTRO = [
  "/assets/lab/gallery-painting-big.webp",
  "/assets/lab/entrance-wall.webp",
  "/assets/lab/prop-statue.webp",
  "/assets/lab/gallery-lamp-entrance.webp",
];

/** 从别的页静默预热：等首页与 Life 首屏就位后按顺序排队预加载 Lab、About、Contact 首屏 */
export function warmPages(delayMs = 800): void {
  window.setTimeout(() => {
    void loadImages(LAB_INTRO, 4)
      .then(() => loadImages(ABOUT_FIRST, 4))
      .then(() => loadImages(CONTACT_FIRST, 4))
      .then(() => warmBytes([...ABOUT_REST, ...CONTACT_REST]));
  }, delayMs);
}

const capped = (p: Promise<void>, capMs: number) =>
  Promise.race([p, new Promise<void>((r) => window.setTimeout(r, capMs))]);

/** 等 Contact 第一批就位，最多等 capMs */
export function whenContactReady(capMs = 2500): Promise<void> {
  return capped(warmContact(), capMs);
}

/** 等 About 第一批就位，最多等 capMs */
export function whenAboutReady(capMs = 2500): Promise<void> {
  return capped(warmAbout(), capMs);
}
