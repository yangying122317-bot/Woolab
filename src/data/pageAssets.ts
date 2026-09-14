import { loadImages } from "../components/life/preload";
import { aboutShots } from "./aboutShots";

/**
 * Contact / About 两页的图（各几百 KB）：进页面才下会一张张冒出来（信封一片片拼、相机等半天）。
 *   - 首页开场结束、Life 第一屏预热完之后，静默把这两批拉进缓存（warmPages）；
 *   - 目录里鼠标碰到哪块牌子，就补拉那一页（warmContact / warmAbout）；
 *   - 页面自己进来时最多等 first 这几张解码完再整体淡入（whenXxxReady），没预热到也是"稍等一下整齐出现"。
 * 解码结果由 preload 里那个模块级缓存攥着，重复调用都是空操作。
 */

const C = "/assets/contact";
const A = "/assets/about";

/** Contact：信封 + 信纸 + 小羊先到齐再露；电话、水印、圈圈这些小件随后 */
export const CONTACT_FIRST = [`${C}/env-back.webp`, `${C}/paper.webp`, `${C}/env-front.webp`, `${C}/fold.webp`, `${C}/sheep.webp`];
export const CONTACT_REST = [`${C}/mark.webp`, `${C}/cord.webp`, `${C}/handset.webp`, `${A}/noise-cream.png`];

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

/** 从别的页静默预热两页：等一会儿再开始，别和当前页自己的图抢 */
export function warmPages(delayMs = 4000): void {
  window.setTimeout(() => {
    void warmContact().then(() => warmAbout());
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
