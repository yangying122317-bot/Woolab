import { useSyncExternalStore } from "react";

/** 首页天气：晴 / 雨。和时段是两个维度，雨可以叠在任意时段上 */
export type Weather = "clear" | "rain";

/**
 * 天气怎么定（按优先级）：
 * 1. 地址栏 ?rain=1 / ?rain=0 强制指定（预览、给人看用），只放内存里，刷新就没了；
 * 2. 用户在顶栏自己点过开关：记在 sessionStorage，这次访问里刷新、换页都认它，不再问天气；
 *    不写 localStorage——下次来还是按真实天气走，不然"外面下雨网站也下雨"这个巧合就没了；
 * 3. 否则问一次 /api/weather：Vercel 会按访客 IP 带上经纬度，函数拿它去查 Open-Meteo 的当前天气；
 * 4. 问不到（本地开发、函数挂了、拿不到位置）就按一个小概率随机下雨，结果同样记在 sessionStorage，
 *    同一次访问里换页再回首页不会一会儿下一会儿晴。
 */
const RANDOM_RAIN_CHANCE = 0.15;
const SESSION_KEY = "woolab-weather";

let weather: Weather = "clear";
let resolved = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

function set(w: Weather) {
  if (w === weather && resolved) return;
  weather = w;
  resolved = true;
  emit();
}

function readSession(): Weather | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved === "rain" || saved === "clear" ? saved : null;
  } catch {
    return null;
  }
}

function writeSession(w: Weather) {
  try {
    sessionStorage.setItem(SESSION_KEY, w);
  } catch {
    /* 隐私模式等写不进就算了 */
  }
}

async function resolve() {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search).get("rain");
  if (q === "1" || q === "true") return set("rain");
  if (q === "0" || q === "false") return set("clear");
  const saved = readSession();
  if (saved) return set(saved);
  try {
    const r = await fetch("/api/weather", { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as { rain?: boolean | null; code?: number; city?: string };
    if (typeof data.rain === "boolean") {
      // 留一行给排查用：IP 定位到哪、天气码多少（开着代理时定位的是代理出口，不是真人所在地）
      console.info(`[weather] ${data.city || "未知位置"} · WMO ${data.code} → ${data.rain ? "雨" : "晴"}`);
      return set(data.rain ? "rain" : "clear");
    }
  } catch {
    /* 走兜底 */
  }
  const w: Weather = Math.random() < RANDOM_RAIN_CHANCE ? "rain" : "clear";
  console.info(`[weather] 拿不到真实天气，随机 → ${w === "rain" ? "雨" : "晴"}`);
  writeSession(w);
  set(w);
}

if (typeof window !== "undefined") void resolve();

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
const get = () => weather;

/** 用户手动切天气（顶栏开关）：立刻生效，并记住到这次访问结束 */
export function setWeather(w: Weather) {
  writeSession(w);
  set(w);
}

export function useWeather() {
  return useSyncExternalStore(subscribe, get, get);
}
