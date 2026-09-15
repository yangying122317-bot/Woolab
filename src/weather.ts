import { useSyncExternalStore } from "react";

/** 首页天气：晴 / 雨。和时段是两个维度，雨可以叠在任意时段上 */
export type Weather = "clear" | "rain";

/**
 * 天气怎么定：
 * 1. 地址栏 ?rain=1 / ?rain=0 强制指定（预览、给人看用），只放内存里，刷新就没了；
 * 2. 否则问一次 /api/weather：Vercel 会按访客 IP 带上经纬度，函数拿它去查 Open-Meteo 的当前天气；
 * 3. 问不到（本地开发、函数挂了、拿不到位置）就按一个小概率随机下雨，结果记在 sessionStorage，
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

function randomFallback(): Weather {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved === "rain" || saved === "clear") return saved;
    const w: Weather = Math.random() < RANDOM_RAIN_CHANCE ? "rain" : "clear";
    sessionStorage.setItem(SESSION_KEY, w);
    return w;
  } catch {
    return "clear";
  }
}

async function resolve() {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search).get("rain");
  if (q === "1" || q === "true") return set("rain");
  if (q === "0" || q === "false") return set("clear");
  try {
    const r = await fetch("/api/weather", { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as { rain?: boolean | null };
    if (typeof data.rain === "boolean") return set(data.rain ? "rain" : "clear");
  } catch {
    /* 走兜底 */
  }
  set(randomFallback());
}

if (typeof window !== "undefined") void resolve();

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
const get = () => weather;

/** 手动指定天气（预览用）；传 null 回到自动判断的结果 */
export function setWeatherOverride(w: Weather | null) {
  if (w) set(w);
  else void resolve();
}

export function useWeather() {
  return useSyncExternalStore(subscribe, get, get);
}
