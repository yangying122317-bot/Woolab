import { useLanguage } from "../i18n/LanguageContext";
import { mu } from "./NavBar";
import { TIME_PHASES, useTimeOfDay } from "../timeOfDay";

/** 时段开关：点一下按 清晨 → 白天 → 黄昏 → 夜晚 轮着切，图标跟着当前时段变。放在顶栏里，颜色跟 currentColor */
export default function TimeToggle() {
  const { t } = useLanguage();
  const { phase, setOverride } = useTimeOfDay();
  const next = TIME_PHASES[(TIME_PHASES.indexOf(phase) + 1) % TIME_PHASES.length];
  const label = `${t(`time.${phase}`)} · ${t("time.switch")}`;

  return (
    <button
      onClick={() => setOverride(next)}
      aria-label={label}
      title={label}
      className="flex cursor-pointer items-center justify-center opacity-80 transition-opacity hover:opacity-100"
      style={{ width: mu(20), height: mu(20) }}
    >
      {phase === "night" ? (
        <svg
          viewBox="0 0 24 24"
          className="h-[80%] w-[80%]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      ) : phase === "dusk" || phase === "dawn" ? (
        <svg
          viewBox="0 0 24 24"
          className="h-[80%] w-[80%]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 18a5 5 0 0 0-10 0" />
          <line x1="12" y1="9" x2="12" y2="2" />
          <line x1="4.2" y1="10.2" x2="5.6" y2="11.6" />
          <line x1="1" y1="18" x2="3" y2="18" />
          <line x1="21" y1="18" x2="23" y2="18" />
          <line x1="18.4" y1="11.6" x2="19.8" y2="10.2" />
          <line x1="1" y1="22" x2="23" y2="22" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-[80%] w-[80%]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
          <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
          <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
        </svg>
      )}
    </button>
  );
}
