import { Link, Outlet, useLocation } from "react-router-dom";
import { mapLocations } from "../data/mapLocations";
import { useLanguage } from "../i18n/LanguageContext";
import LangSwitcher from "./LangSwitcher";

/**
 * 内页统一布局：顶部为 logo + 导航 + 语言切换，中间渲染各板块页面。
 * 首页（地图）不走这个布局，见 App.tsx 路由配置。
 */
export default function Layout() {
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <div className="flex min-h-full flex-col bg-neutral-50 text-neutral-800">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/assets/logo.svg" alt="logo" className="h-8 w-8" />
            <span className="hidden text-sm font-semibold sm:inline">
              {t("siteName")}
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
            {mapLocations.map((loc) => {
              const active = location.pathname.startsWith(loc.path);
              return (
                <Link
                  key={loc.id}
                  to={loc.path}
                  className={`shrink-0 rounded-full px-3 py-1.5 transition ${
                    active
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-500 hover:bg-neutral-100"
                  }`}
                >
                  {t(loc.labelKey)}
                </Link>
              );
            })}
          </nav>

          <LangSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-400">
        <Link to="/" className="underline-offset-2 hover:underline">
          {t("backToMap")}
        </Link>
      </footer>
    </div>
  );
}
