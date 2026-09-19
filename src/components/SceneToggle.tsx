import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "../i18n/LanguageContext";
import { NavHit, mu } from "./NavBar";
import { TIME_PHASES, useTimeOfDay, type TimePhase } from "../timeOfDay";
import { setWeather, useWeather, type Weather } from "../weather";
import { TIME_ICONS } from "./timeIcons";
import { playNavClick } from "../audio/sfx";

/** 一朵手绘感的云 + 三根往左下斜的雨丝（和场景里的雨同向） */
const CLOUD =
  "M5.1 15.6C3.3 15.7 2 14.3 2.1 12.8C2.2 11.4 3.4 10.3 4.9 10.4C5.1 7.8 7.3 5.9 9.9 6.1C11.6 6.2 13 7.3 13.7 8.7C14.6 8.1 15.7 8.1 16.6 8.8C17.6 9.5 18 10.6 17.8 11.6C19.5 11.5 20.8 12.7 20.7 14.1C20.6 15.2 19.6 15.9 18.4 15.9C16.2 15.8 14.1 16.1 12.2 16C9.9 15.9 7.4 16.2 5.1 15.6Z";
const DROPS = [
  [8.6, 17.6, 7.4, 21.4],
  [12.6, 17.6, 11.4, 21.4],
  [16.6, 17.6, 15.4, 21.4],
] as const;

/** 时段图标：四个手绘填充 svg（viewBox 各不一样，meet 缩到同一个方框） */
function TimeIcon({ phase, className = "h-[88%] w-[88%]" }: { phase: TimePhase; className?: string }) {
  const icon = TIME_ICONS[phase];
  return (
    <svg viewBox={icon.viewBox} className={className} fill="currentColor" aria-hidden>
      {icon.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** 天气图标：晴 = 光一朵云；雨 = 云底下依次落三根雨丝 */
function WeatherIcon({ rain, className = "h-full w-full" }: { rain: boolean; className?: string }) {
  return (
    <svg viewBox="1 4 22 19" className={className} aria-hidden>
      <motion.path
        fill="currentColor"
        initial={false}
        animate={{ y: rain ? 0 : 2.5 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        d={CLOUD}
      />
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
  );
}

/** 面板里的一个选项：选中的外面套一圈手绘圈（和 MENU 打开时那圈同一张），没选中的淡一些 */
function Option({
  on,
  label,
  onPick,
  children,
}: {
  on: boolean;
  label: string;
  onPick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onPick();
        playNavClick();
      }}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className="relative flex cursor-pointer items-center justify-center transition-opacity hover:opacity-100"
      style={{ width: mu(20), height: mu(20), opacity: on ? 1 : 0.45 }}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute block"
        style={{
          left: "-34%",
          right: "-34%",
          top: "-30%",
          bottom: "-30%",
          WebkitMaskImage: "url(/assets/menu/circle.svg)",
          maskImage: "url(/assets/menu/circle.svg)",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          background: "currentColor",
        }}
        initial={false}
        animate={on ? { clipPath: "inset(-10% 0% -10% 0%)", opacity: 1 } : { clipPath: "inset(-10% 100% -10% 0%)", opacity: 0 }}
        transition={
          on
            ? { clipPath: { duration: 0.4, ease: "easeInOut" }, opacity: { duration: 0.01 } }
            : { clipPath: { duration: 0.01, delay: 0.2 }, opacity: { duration: 0.2 } }
        }
      />
      {children}
    </button>
  );
}

/**
 * 场景开关：顶栏上只占一个位子，图标就是"现在的天"——下雨显示雨云，否则显示当前时段（日出 / 太阳 / 日落 / 月亮）。
 * 点开是一小块面板，两行：时段四选一、天气二选一，选完面板留着可以接着调，点外面 / Esc 收起。
 * 全部用 currentColor 画（顶栏是 difference 混合，不能有底色）。
 */
export default function SceneToggle() {
  const { t } = useLanguage();
  const { phase, setOverride } = useTimeOfDay();
  const weather = useWeather();
  const rain = weather === "rain";
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const now = `${t(`time.${phase}`)} · ${t(rain ? "weather.rain" : "weather.clear")}`;
  const label = `${now} · ${t("scene.switch")}`;
  const rowLabel = { fontSize: mu(8.5), letterSpacing: mu(0.4), opacity: 0.55, width: mu(46) };

  return (
    <div ref={root} className="relative flex items-center">
      <NavHit held={open}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="true"
          title={label}
          className="flex cursor-pointer items-center justify-center opacity-80 transition-opacity hover:opacity-100"
          style={{ width: mu(20), height: mu(20) }}
        >
          {/* 雨天用雨云、否则用时段图标；换的时候小小地淡一下 */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={rain ? "rain" : phase}
              className="flex h-full w-full items-center justify-center"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {rain ? <WeatherIcon rain /> : <TimeIcon phase={phase} />}
            </motion.span>
          </AnimatePresence>
        </button>
      </NavHit>

      <AnimatePresence>
        {open && (
          <motion.div
            role="group"
            aria-label={t("scene.switch")}
            className="absolute right-0 flex flex-col normal-case"
            style={{ top: "100%", marginTop: mu(16), gap: mu(7) }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-center" style={{ gap: mu(9) }}>
              <span className="text-right" style={rowLabel}>
                {t("time.label")}
              </span>
              {TIME_PHASES.map((p) => (
                <Option key={p} on={p === phase} label={t(`time.${p}`)} onPick={() => setOverride(p)}>
                  <TimeIcon phase={p} />
                </Option>
              ))}
            </div>
            <div className="flex items-center" style={{ gap: mu(9) }}>
              <span className="text-right" style={rowLabel}>
                {t("weather.label")}
              </span>
              {(["clear", "rain"] as Weather[]).map((w) => (
                <Option key={w} on={w === weather} label={t(`weather.${w}`)} onPick={() => setWeather(w)}>
                  <WeatherIcon rain={w === "rain"} />
                </Option>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
