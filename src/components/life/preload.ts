import { lifeFirstAssets, lifeRestAssets } from "../../data/lifeAssets";

/**
 * Life 页素材预加载。
 *
 * 房间的横移是 Lenis 在 JS 里逐帧驱动的，主线程一忙滚轮就没反应；而进门那一下要同时下载、解码
 * 三百多张图并光栅化一条 7000 多像素宽的长卷，正是最忙的时候。所以：
 *   1. 第一屏的图（墙面、段01、清单抽屉）先在幕后 decode 完，LifePage 等它们就位再揭开白光；
 *   2. 后面两段的图等第一屏揭开后在后台慢慢拉，人走到那儿时已经在缓存里；
 *   3. 首页 / 目录也可以提前调 warmLife()，这样从别的页进 Life 基本不用等。
 *
 * 解码后的 Image 对象存在模块级 Map 里不放手，浏览器就不会把解码结果丢掉。
 */
const cache = new Map<string, Promise<void>>();

function load(url: string): Promise<void> {
  const hit = cache.get(url);
  if (hit) return hit;
  const p = new Promise<void>((resolve) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => {
      // decode() 把解码也做完；不支持或失败（比如被丢弃）都当作完成，不卡进门
      const d = im.decode?.();
      if (d) d.then(resolve, resolve);
      else resolve();
    };
    im.onerror = () => resolve();
    im.src = url;
    keep.push(im);
  });
  cache.set(url, p);
  return p;
}
const keep: HTMLImageElement[] = [];

/** 一批一起下，limit 个并发；全部完成后 resolve（单张失败不算失败）。别处（Lab 详情）也用这两个 */
export { load as loadImage, loadAll as loadImages };
async function loadAll(urls: readonly string[], limit = 8): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < urls.length) await load(urls[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker));
}

let first: Promise<void> | null = null;
let rest: Promise<void> | null = null;

/** 第一屏素材：返回全部解码完成的 Promise（重复调用复用同一个） */
export function preloadLifeFirst(): Promise<void> {
  if (!first) first = loadAll(lifeFirstAssets);
  return first;
}

/** 后面两段：第一屏就位后再开始，别抢带宽 */
export function preloadLifeRest(): Promise<void> {
  if (!rest) rest = preloadLifeFirst().then(() => loadAll(lifeRestAssets, 6));
  return rest;
}

/**
 * 从别的页提前热身：先等一小会儿（让当前页自己的图先落地），再拉第一屏；第一屏完了顺手拉后面的。
 * 幂等，随便调。
 */
export function warmLife(delayMs = 2500): void {
  if (first) return;
  window.setTimeout(() => {
    void preloadLifeRest();
  }, delayMs);
}

/** 等第一屏就位，但最多等 capMs：网慢也不能让人对着白光干等 */
export function whenLifeFirstReady(capMs: number): Promise<void> {
  return Promise.race([preloadLifeFirst(), new Promise<void>((r) => window.setTimeout(r, capMs))]);
}
