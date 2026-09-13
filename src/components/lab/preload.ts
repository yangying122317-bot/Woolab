import { loadImages } from "../life/preload";
import { labProjects, type LabProject } from "../../data/labs";

/**
 * Lab 详情页素材预加载。
 *
 * 点画框翻面那一下要立刻看到框里的画、金框、纸张、撕边，接着是照片、拍立得、邮票。
 * 这些以前都是点开才开始下，翻面时先是空框再"啪"地补上。现在：
 *   1. 画廊开场播完就在后台把"翻面第一眼"那批拉好（四张画 + 金框 + 纸 + 撕边 + 石墙），
 *      然后低并发把其余的（照片、拼贴小图、手绘箭头）慢慢拉完；
 *   2. 鼠标碰到某只框就把那一个项目的全部素材拉一遍（悬停到点下去那几百毫秒够用），网慢时兜底。
 * 解码好的图由 life/preload 那套缓存留在内存里，不会被丢。
 */

const A = "/assets/lab/detail";

/** 翻面第一眼就要的公共素材 */
const SHARED_FIRST = [
  `${A}/gold-frame.webp`,
  `${A}/paper-sheet.webp`,
  `${A}/torn-top.png`,
  `${A}/torn-bottom.png`,
  `${A}/bg-stone-wall.webp`,
  `${A}/bg-stone-mark.webp`,
];
/** 其余公共素材（手绘箭头、圈、下划线、邮戳、纸纹） */
const SHARED_REST = [
  `${A}/stamp.webp`,
  `${A}/sheet-lines.svg`,
  `${A}/arrow-down.svg`,
  `${A}/arrow-back.svg`,
  `${A}/arrow-front.svg`,
  `${A}/arrow-stripes.svg`,
  `${A}/arrow-signature.svg`,
  `${A}/underline-desc.svg`,
  `${A}/underline-closet.svg`,
  `${A}/circle-woolab.svg`,
  `${A}/circle-relaxed.svg`,
];

/** 把一个对象里所有 /assets/ 开头的字符串都捞出来（照片、拼贴小图、拍立得、邮票……） */
function collect(v: unknown, out: Set<string>) {
  if (typeof v === "string") {
    if (v.startsWith("/assets/")) out.add(v);
  } else if (Array.isArray(v)) {
    v.forEach((x) => collect(x, out));
  } else if (v && typeof v === "object") {
    Object.values(v).forEach((x) => collect(x, out));
  }
}

/** 框里那张画（连框的整张或套金框的画） */
function frameArt(p: LabProject): string | undefined {
  return p.wall?.frame ?? p.wall?.art;
}

/** 一个项目详情用到的全部图（不含公共素材） */
export function projectAssets(p: LabProject): string[] {
  const out = new Set<string>();
  collect(p.wall, out);
  collect(p.looks, out);
  return [...out];
}

let warmed: Promise<void> | null = null;
/** 进画廊后调一次：先拉翻面第一眼那批，再低并发把剩下的拉完 */
export function warmLabDetail(): Promise<void> {
  if (!warmed) {
    const first = [...SHARED_FIRST, ...labProjects.map(frameArt).filter((s): s is string => !!s)];
    const rest = new Set<string>(SHARED_REST);
    labProjects.forEach((p) => projectAssets(p).forEach((s) => rest.add(s)));
    first.forEach((s) => rest.delete(s));
    warmed = loadImages(first, 6).then(() => loadImages([...rest], 3));
  }
  return warmed;
}

/** 鼠标碰到某只框：把这一个项目的图先拉齐（已经在缓存里的直接跳过） */
export function warmLabProject(p: LabProject): Promise<void> {
  const art = frameArt(p);
  return loadImages([...(art ? [art] : []), ...SHARED_FIRST, ...projectAssets(p)], 6);
}
