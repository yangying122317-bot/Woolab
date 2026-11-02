import { lifeFirstAssets, lifeInteractionAssets, lifeRestAssets } from "../../data/lifeAssets";

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
const readySet = new Set<string>();
const keep: HTMLImageElement[] = [];

export function isImageReady(url: string): boolean {
  return readySet.has(url);
}

function load(url: string): Promise<void> {
  const hit = cache.get(url);
  if (hit) return hit;
  const p = new Promise<void>((resolve) => {
    const attempt = (retry: boolean) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        const done = () => {
          readySet.add(url);
          resolve();
        };
        // decode() 把解码也做完；不支持或失败（比如被丢弃）都当作完成，不卡进门
        const d = im.decode?.();
        if (d) d.then(done, done);
        else done();
      };
      im.onerror = () => {
        if (!retry) {
          window.setTimeout(() => attempt(true), 250);
          return;
        }
        // 不把失败永久写进缓存；网络恢复后下一次 warm / 进页仍可再试。
        window.setTimeout(() => cache.delete(url), 0);
        if (import.meta.env.DEV) console.warn(`Image preload failed: ${url}`);
        resolve();
      };
      im.src = url;
      keep.push(im);
    };
    attempt(false);
  });
  cache.set(url, p);
  return p;
}

/** 严格加载并解码（失败持续退避重试，给首页小电视真实加载用，与全局缓存共用 keep 池） */
export function loadImageStrict(url: string): Promise<void> {
  if (readySet.has(url)) return Promise.resolve();
  const hit = cache.get(url);
  if (hit) return hit;
  const p = new Promise<void>((resolve) => {
    const attempt = (n: number) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        keep.push(im);
        const done = () => {
          readySet.add(url);
          resolve();
        };
        const d = im.decode?.();
        if (d) d.then(done, done);
        else done();
      };
      im.onerror = () => {
        const delay = Math.min(300 * Math.pow(1.5, n), 3000);
        window.setTimeout(() => attempt(n + 1), delay);
      };
      im.src = url;
    };
    attempt(0);
  });
  cache.set(url, p);
  return p;
}

/** 一批一起下，limit 个并发；全部完成后 resolve（单张失败不算失败）。别处（Lab 详情）也用这两个 */
export { load as loadImage, loadAll as loadImages };
async function loadAll(urls: readonly string[], limit = 8): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < urls.length) await load(urls[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker));
}

export const LIFE_CORE_ASSETS = lifeFirstAssets.filter(
  (u) => !u.includes("/window-anim/") || u.endsWith("/f00.webp"),
);
const LIFE_WINDOW_REST = lifeFirstAssets.filter(
  (u) => u.includes("/window-anim/") && !u.endsWith("/f00.webp"),
);

let core: Promise<void> | null = null;
let coreReady = false;
let first: Promise<void> | null = null;
let interaction: Promise<void> | null = null;
let rest: Promise<void> | null = null;

/** 第一屏核心静态层是否已全部解码就绪（供 LifePage 首帧同步判断，免去多余等待帧） */
export function isLifeFirstReady(): boolean {
  return coreReady || LIFE_CORE_ASSETS.every((u) => readySet.has(u));
}

/** 第一屏核心层（墙、地、衣帽区全部家具衣物、窗户第 1 帧、清单抽屉）：优先解码，省去 23 帧窗户动画占用的 54MB 显存 */
export function preloadLifeCore(): Promise<void> {
  if (!core) {
    core = loadAll(LIFE_CORE_ASSETS, 8).then(() => {
      coreReady = true;
    });
  }
  return core;
}

/** 第一屏完整素材（核心层 + 窗户其余 23 帧）：返回全部解码完成的 Promise（重复调用复用同一个） */
export function preloadLifeFirst(): Promise<void> {
  if (!first) {
    first = preloadLifeCore().then(() => loadAll(LIFE_WINDOW_REST, 6));
  }
  return first;
}

/** 唱片逐帧图：只在鼠标靠近或真正点击时解码，不再阻塞 Life 入场 */
export function preloadLifeInteraction(): Promise<void> {
  if (!interaction) interaction = loadAll(lifeInteractionAssets, 4);
  return interaction;
}

/** 后面两段：第一屏核心层就位后再开始，别抢带宽 */
export function preloadLifeRest(): Promise<void> {
  if (!rest) rest = preloadLifeFirst().then(() => loadAll(lifeRestAssets, 6));
  return rest;
}

/**
 * 只把字节拉进 HTTP 缓存、不解码、不攥着：给"别的页"预热用。
 * 上面 load() 会把解码结果留在内存里（一张 Image 就是一块位图），Life 第一屏 112 张解码开是 140MB，
 * 加上首页自己的 80MB、Contact / About 的 20MB，全在首页就攥着；Chrome 无所谓，Safari 对每个标签页
 * 有内存预算，超了会把已解码的位图丢掉、连当前正显示的大图也可能一起丢——首页那栋房子在新版 Safari 上
 * 不显示就是这么来的。所以跨页预热只暖缓存，真进了那一页再解码（那页的加载幕会等它）。
 */
const bytesDone = new Set<string>();
export async function warmBytes(urls: readonly string[], limit = 4): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++];
      if (bytesDone.has(url)) continue;
      bytesDone.add(url);
      try {
        await fetch(url, { priority: "low" } as RequestInit);
      } catch {
        bytesDone.delete(url);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker));
}

/**
 * 从别的页（目录）提前热身：直接解码第一屏核心层，并把窗户动画帧拉进缓存。
 */
let warmed = false;
export function warmLife(delayMs = 0): void {
  if (warmed || rest) return;
  warmed = true;
  window.setTimeout(() => {
    void preloadLifeCore().then(() => warmBytes(LIFE_WINDOW_REST));
  }, delayMs);
}

/** 首页小电视结束后立即预加载 Life 第一屏核心层（解码进内存）并暖好窗户帧字节；then：完成后接着预热其他内页 */
let warmedFirst: Promise<void> | null = null;
export function warmLifeFirst(delayMs = 0, then?: () => void): void {
  if (warmedFirst || first) {
    if (then) void (first ?? warmedFirst)!.then(then);
    return;
  }
  warmedFirst = new Promise<void>((resolve) => {
    window.setTimeout(() => {
      void preloadLifeCore()
        .then(() => warmBytes(LIFE_WINDOW_REST))
        .then(resolve);
    }, delayMs);
  });
  if (then) void warmedFirst.then(then);
}

/** 真实等待第一屏（含衣帽区 seg01 + 起居区 seg02 + 清单抽屉）全部解码就位，不再因超时提前揭开导致右侧空白 */
export function whenLifeFirstReady(_capMs?: number): Promise<void> {
  if (isLifeFirstReady()) return Promise.resolve();
  return preloadLifeCore();
}
