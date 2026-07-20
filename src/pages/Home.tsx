import HeroScene from "../components/HeroScene";
import LangSwitcher from "../components/LangSwitcher";
import { useLanguage } from "../i18n/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="relative h-full min-h-screen text-neutral-800">
      {/* 顶栏浮在场景上方 */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <img src="/assets/logo.svg" alt="logo" className="h-8 w-8" />
          <span className="text-sm font-bold tracking-wide text-white drop-shadow-sm">
            {t("siteName")}
          </span>
        </div>
        <LangSwitcher />
      </header>

      <div className="h-screen">
        <HeroScene />
      </div>
    </div>
  );
}
