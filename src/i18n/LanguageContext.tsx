import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { dict } from "./dict";
import type { DictKey, Lang, Localized } from "./dict";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** 取界面文案：t("nav.about") */
  t: (key: DictKey) => string;
  /** 取数据文件中的双语字段：pick(character.name) */
  pick: (localized: Localized) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "site-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "zh" || saved === "en" ? saved : "zh";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: (key) => dict[lang][key],
    pick: (localized) => localized[lang],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
