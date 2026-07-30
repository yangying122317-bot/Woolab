import type { StationId } from "../data/lifeStations";

/**
 * 「小羊的生活」房间状态：用户做过的事永久留在房间里。
 * 存在访客自己的浏览器（localStorage），换设备/清缓存会回到初始状态。
 */

export type DrinkChoice = "a" | "b" | "c";

export interface RoomState {
  /** T 恤穿上了 */
  tee: boolean;
  /** 相片补好了 */
  photo: boolean;
  /** 饮料选了哪瓶（null = 还没调） */
  drink: DrinkChoice | null;
  /** 蜡烛点亮了 */
  candle: boolean;
  /** 彩蛋：小羊换上了白T牛仔裤（把挂着的白T拖给它） */
  dressed: boolean;
}

export const DEFAULT_ROOM: RoomState = {
  tee: false,
  photo: false,
  drink: null,
  candle: false,
  dressed: false,
};

const STORAGE_KEY = "woolab-room-state";

export function loadRoomState(): RoomState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ROOM };
    return { ...DEFAULT_ROOM, ...(JSON.parse(raw) as Partial<RoomState>) };
  } catch {
    return { ...DEFAULT_ROOM };
  }
}

export function saveRoomState(state: RoomState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isStationDone(state: RoomState, id: StationId): boolean {
  if (id === "drink") return state.drink !== null;
  return state[id];
}

export function doneCount(state: RoomState): number {
  return (["tee", "photo", "drink", "candle"] as StationId[]).filter((id) =>
    isStationDone(state, id),
  ).length;
}

/** 四件小事全部完成 → 房间入夜 */
export function isNight(state: RoomState): boolean {
  return doneCount(state) === 4;
}
