import { motion } from "framer-motion";
import { useLanguage } from "../i18n/LanguageContext";
import { mu } from "./NavBar";
import { setWeather, useWeather } from "../weather";

/** 三根雨丝：和场景里的雨一样往左下斜 */
const DROPS = [
  [8.6, 17.6, 7.4, 21.4],
  [12.6, 17.6, 11.4, 21.4],
  [16.6, 17.6, 15.4, 21.4],
] as const;

/**
 * 天气开关：一朵云，下雨时云底下落三根雨丝，晴天只有云、淡一些。点一下切晴 / 雨。
 * 放在顶栏时段开关旁边，颜色跟 currentColor。
 */
export default function WeatherToggle() {
  const { t } = useLanguage();
  const rain = useWeather() === "rain";
  const label = `${t(rain ? "weather.rain" : "weather.clear")} · ${t("weather.switch")}`;

  return (
    <button
      type="button"
      onClick={() => setWeather(rain ? "clear" : "rain")}
      aria-label={label}
      aria-pressed={rain}
      title={label}
      className="flex cursor-pointer items-center justify-center transition-opacity hover:opacity-100"
      style={{ width: mu(20), height: mu(20), opacity: rain ? 1 : 0.55 }}
    >
      <svg viewBox="1 4 22 19" className="h-[92%] w-[92%]" aria-hidden>
        {/* 云：手绘感的一团 */}
        <path
          fill="currentColor"
          d="M5.1 15.6C3.3 15.7 2 14.3 2.1 12.8C2.2 11.4 3.4 10.3 4.9 10.4C5.1 7.8 7.3 5.9 9.9 6.1C11.6 6.2 13 7.3 13.7 8.7C14.6 8.1 15.7 8.1 16.6 8.8C17.6 9.5 18 10.6 17.8 11.6C19.5 11.5 20.8 12.7 20.7 14.1C20.6 15.2 19.6 15.9 18.4 15.9C16.2 15.8 14.1 16.1 12.2 16C9.9 15.9 7.4 16.2 5.1 15.6Z"
        />
        {/* 雨丝：下雨时依次落下来 */}
        {DROPS.map(([x1, y1, x2, y2], i) => (
          <motion.line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            initial={false}
            animate={{ opacity: rain ? 1 : 0, y: rain ? 0 : -1.5 }}
            transition={{ duration: 0.25, delay: rain ? i * 0.07 : 0, ease: "easeOut" }}
          />
        ))}
      </svg>
    </button>
  );
}
