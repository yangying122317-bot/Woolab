/** 手机判定：触屏 + 短边不到 768（iPad 横屏、桌面窄窗口都放行）。?gate=1 / ?gate=0 可强制 */
export function isPhone(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("gate");
  if (q === "1") return true;
  if (q === "0") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const short = Math.min(window.innerWidth, window.innerHeight) < 768;
  return coarse && short;
}
