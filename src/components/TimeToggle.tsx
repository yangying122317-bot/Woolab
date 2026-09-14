import { useLanguage } from "../i18n/LanguageContext";
import { mu } from "./NavBar";
import { TIME_PHASES, useTimeOfDay } from "../timeOfDay";
import { TIME_ICONS } from "./timeIcons";

/** 时段开关：点一下按 清晨 → 白天 → 黄昏 → 夜晚 轮着切，图标跟着当前时段变。放在顶栏里，颜色跟 currentColor */
export default function TimeToggle() {
  const { t } = useLanguage();
  const { phase, setOverride } = useTimeOfDay();
  const next = TIME_PHASES[(TIME_PHASES.indexOf(phase) + 1) % TIME_PHASES.length];
  const label = `${t(`time.${phase}`)} · ${t("time.switch")}`;
  const icon = TIME_ICONS[phase];

  return (
    <button
      onClick={() => setOverride(next)}
      aria-label={label}
      title={label}
      className="flex cursor-pointer items-center justify-center opacity-80 transition-opacity hover:opacity-100"
      style={{ width: mu(20), height: mu(20) }}
    >
      {/* 手绘填充图标，四个 viewBox 尺寸不一，用 meet 缩放到同一个方框里 */}
      <svg viewBox={icon.viewBox} className="h-[88%] w-[88%]" fill="currentColor" aria-hidden>
        {icon.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    </button>
  );
}
