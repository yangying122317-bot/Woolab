import { useState } from "react";
import { useLocation } from "react-router-dom";
import NavBar, { NavLogo, navBarStyle } from "./NavBar";
import MenuOverlay from "./MenuOverlay";
import SceneToggle from "./SceneToggle";
import { useDarkNav, useDetailOpen, useLogoOnlyNav, useNavHidden, usePlainLogo, usePlainNav } from "../state/chrome";
import { INTRO_PREVIEW_PATH } from "./IntroLoader";

/**
 * 全站顶栏 + 目录。挂在路由外面一份就够：
 * 首页和 Lab 页直接白字；Life 页白字 + difference 混合——暖色房间里让它跟底色反着来，深底上白、浅底上深。
 * 点 MENU 挂出黑底吊牌目录（MenuOverlay）。
 * Lab 详情（z-50）盖上来时，顶栏升到它上面（z-55）、去掉 logo（左上角是详情自己的"回画廊"）、
 * 石墙是深灰的所以直接白字不混合；目录本身是 z-60 的 portal，不受这个影响。
 * Life 页清单抽屉开着时（牛皮色压在 logo 底下，difference 会把白 logo 变蓝），
 * logo 从混合的顶栏里拿出来、在旁边单画一份纯白的，右边的 MENU 那些照旧混合。
 */
export default function TopNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  /* 加载动画预览页底下也是首页，顶栏按首页那套走 */
  const home = pathname === "/" || pathname === INTRO_PREVIEW_PATH;
  const detail = useDetailOpen();
  /* Lab 页（入口的砖红墙 + 画廊）直接白字，不混合 */
  const lab = pathname.startsWith("/lab");
  /* About 页翻到蓝色那页时也整条纯白 */
  const plainNav = usePlainNav();
  const plain = home || detail || lab || plainNav;
  const plainLogo = usePlainLogo() && !plain;
  /* 内页加载布盖着时只留 logo；首页开场白布盖着时整条都藏 */
  const logoOnly = useLogoOnlyNav();
  const navHidden = useNavHidden();
  /* Lab 页走进奶油黄走廊后黑字；详情盖上来（深灰石墙）还是白字 */
  const darkNav = useDarkNav() && !detail;
  const navColor = darkNav ? "#1F1B17" : "#FFFFFF";
  /* 首页顶栏多一个场景开关：点开选时段、天气（晴 / 雨） */
  const extra = home ? <SceneToggle /> : undefined;

  return (
    <>
      {/* header 本身不接鼠标：它横贯整个顶边，不然会把底下 Lab 详情左上角的"回画廊"盖住；里面的按钮各自 pointer-events-auto */}
      <header
        className={`pointer-events-none fixed inset-x-0 top-0 ${detail ? "z-[55]" : "z-[45]"}`}
        style={{ mixBlendMode: plain ? "normal" : "difference" }}
      >
        <NavBar color={navColor} menuOpen={false} onMenu={() => setOpen(true)} extra={extra} hideLogo={detail || plainLogo} logoOnly={logoOnly} hidden={navHidden} />
      </header>
      {plainLogo && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[45] flex items-center" style={navBarStyle("#FFFFFF")}>
          <NavLogo />
        </div>
      )}
      {open && <MenuOverlay navColor="#FFFFFF" extra={extra} onClosed={() => setOpen(false)} />}
    </>
  );
}
