import { useLanguage } from "../i18n/LanguageContext";
import type { Lang } from "../i18n/dict";

const options: { value: Lang; label: string }[] = [
  { value: "zh", label: "中" },
  { value: "en", label: "EN" },
];

export default function LangSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex overflow-hidden rounded-full border border-neutral-300 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLang(opt.value)}
          className={`px-3 py-1.5 transition ${
            lang === opt.value
              ? "bg-neutral-800 text-white"
              : "bg-white text-neutral-500 hover:bg-neutral-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
