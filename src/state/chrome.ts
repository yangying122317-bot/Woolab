import { useEffect, useSyncExternalStore } from "react";

/**
 * 页面外壳的一点全局状态：Lab 详情页此刻是不是盖在画廊上。
 * 详情是 LabPage 里的一层 fixed 覆盖（不走路由），顶栏在路由外面看不到它，
 * 所以由详情页挂载时来这里报个到，顶栏据此换成"压在详情上"的样子（去掉 logo，让位给返回按钮）。
 */
let detailOpen = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

export function useDetailOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => detailOpen,
    () => false,
  );
}

/** 详情页挂着的这段时间登记为"打开" */
export function useReportDetailOpen() {
  useEffect(() => {
    detailOpen = true;
    emit();
    return () => {
      detailOpen = false;
      emit();
    };
  }, []);
}

/**
 * 另一件事：左上角 logo 要不要脱离 difference 混合、直接画纯白。
 * Life 页的清单抽屉是牛皮色，白字 difference 上去会变成蓝的，抽屉开着时登记一下。
 */
let plainLogo = false;

export function usePlainLogo(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => plainLogo,
    () => false,
  );
}

/** active 为真的这段时间，logo 画成纯白 */
export function useReportPlainLogo(active: boolean) {
  useEffect(() => {
    if (!active) return;
    plainLogo = true;
    emit();
    return () => {
      plainLogo = false;
      emit();
    };
  }, [active]);
}

/**
 * 再进一步：整条顶栏都不混合、直接纯白。
 * About 页翻到蓝色的 What's Next 那页时用——白字 difference 到蓝上会变成橙的。
 */
let plainNav = false;

export function usePlainNav(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => plainNav,
    () => false,
  );
}

/** active 为真的这段时间，整条顶栏纯白 */
export function useReportPlainNav(active: boolean) {
  useEffect(() => {
    if (!active) return;
    plainNav = true;
    emit();
    return () => {
      plainNav = false;
      emit();
    };
  }, [active]);
}

/**
 * 开场加载那块蓝布还盖着的时候，顶栏只留左上的 logo，右边 MENU / CN·EN / 喇叭等布拉走再淡进来。
 */
let logoOnlyNav = false;

export function useLogoOnlyNav(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => logoOnlyNav,
    () => false,
  );
}

/** active 为真的这段时间，顶栏只画 logo */
export function useReportLogoOnlyNav(active: boolean) {
  useEffect(() => {
    if (!active) return;
    logoOnlyNav = true;
    emit();
    return () => {
      logoOnlyNav = false;
      emit();
    };
  }, [active]);
}

/**
 * 首页开场那块白布盖着的时候，整条顶栏（连 logo）都藏起来，布拉走再一起淡进来。
 */
let navHidden = false;

export function useNavHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navHidden,
    () => false,
  );
}

/** active 为真的这段时间，整条顶栏藏起来 */
export function useReportNavHidden(active: boolean) {
  useEffect(() => {
    if (!active) return;
    navHidden = true;
    emit();
    return () => {
      navHidden = false;
      emit();
    };
  }, [active]);
}

/**
 * Lab 页走进奶油黄的走廊后，顶栏白字看不清，换成黑字（入口砖红墙、详情深灰石墙仍是白字）。
 */
let darkNav = false;

export function useDarkNav(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => darkNav,
    () => false,
  );
}

/** active 为真的这段时间，顶栏黑字 */
export function useReportDarkNav(active: boolean) {
  useEffect(() => {
    if (!active) return;
    darkNav = true;
    emit();
    return () => {
      darkNav = false;
      emit();
    };
  }, [active]);
}
