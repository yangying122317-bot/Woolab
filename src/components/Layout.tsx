import { Link, Outlet, useLocation } from "react-router-dom";
import { mapLocations } from "../data/mapLocations";
import { hasUnreadNews } from "../data/news";
import { useLanguage } from "../i18n/LanguageContext";
import LangSwitcher from "./LangSwitcher";
import SoundToggle from "./SoundToggle";

/**
 * 内页轻壳：悬浮在页面上方的一条极简顶栏——
 * 左边 logo（点击回首页），中间小号手写体导航，右边声音/语言。
 * 背景、滚动和进场过场都交给各页面自己控制，保持沉浸感。
 */
export default function Layout() {
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <div className="relative min-h-full bg-[#F4F4F4] text-neutral-800">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="pointer-events-auto flex items-center gap-2">
          <img src="/assets/logo.svg" alt="logo" className="h-8 w-8" />
          <span className="font-hand hidden text-lg text-neutral-700 sm:inline">
            {t("siteName")}
          </span>
        </Link>

        <nav className="pointer-events-auto flex items-center gap-1">
          {mapLocations.map((loc) => {
            const active = location.pathname.startsWith(loc.path);
            // 日报有没看过的新刊时，导航上亮一个小圆点
            const showDot = loc.id === "news" && !active && hasUnreadNews();
            return (
              <Link
                key={loc.id}
                to={loc.path}
                className={`font-hand relative rounded-full px-3 py-1 text-base transition ${
                  active
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-500 hover:bg-black/5 hover:text-neutral-800"
                }`}
              >
                {t(loc.labelKey)}
                {showDot && (
                  <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-neutral-800" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="pointer-events-auto flex items-center gap-2">
          <SoundToggle />
          <LangSwitcher />
        </div>
      </header>

      <main className="min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
