import { useSyncExternalStore } from "react";

/** 首页的时段：清晨 / 白天 / 黄昏 / 夜晚 */
export type TimePhase = "dawn" | "day" | "dusk" | "night";
export const TIME_PHASES: readonly TimePhase[] = ["dawn", "day", "dusk", "night"];

/** 按本地时间分段 */
export function phaseByClock(d = new Date()): TimePhase {
  const h = d.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

/**
 * 手动切的时段只放在内存里：站内换页再回首页还是它，刷新 / 重开就回到跟着真实时间走。
 * 不落 storage，免得用户点过一次之后再也看不到真实时段。
 */
let override: TimePhase | null = null;
let clock: TimePhase = phaseByClock();
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

if (typeof window !== "undefined") {
  // 每分钟对一次表，跨过分段点时自动换景
  window.setInterval(() => {
    const p = phaseByClock();
    if (p !== clock) {
      clock = p;
      emit();
    }
  }, 60_000);
}

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
const getPhase = () => override ?? clock;
const getOverride = () => override;

/** 手动指定时段；传 null 回到跟随真实时间 */
export function setTimeOverride(p: TimePhase | null) {
  override = p;
  emit();
}

export function useTimeOfDay() {
  const phase = useSyncExternalStore(subscribe, getPhase, getPhase);
  const manual = useSyncExternalStore(subscribe, getOverride, getOverride);
  return { phase, manual, setOverride: setTimeOverride };
}
