import { AnimatePresence, motion } from "framer-motion";
import type { LifeStation } from "../../data/lifeStations";
import type { DrinkChoice } from "../../state/roomState";
import { useLanguage } from "../../i18n/LanguageContext";

interface Props {
  /** 当前专注的站点；null = 漫游态 */
  station: LifeStation | null;
  /** 该站点是否已完成（完成后进来是"回看介绍"） */
  done: boolean;
  /** 完成占位交互（饮料站带选择） */
  onComplete: (choice?: DrinkChoice) => void;
  onClose: () => void;
}

/**
 * 专注态面板：镜头推近站点后浮出的互动区。
 * 原型骨架用「完成」按钮占位真实互动；
 * 之后每个站点的真互动（翻衣服/拼相片/调饮料/划火柴）替换面板内容即可。
 */
export default function StationFocus({ station, done, onComplete, onClose }: Props) {
  const { t, pick } = useLanguage();

  return (
    <AnimatePresence>
      {station && (
        <motion.div
          key={station.id}
          className="absolute inset-0 z-40 flex items-end justify-center px-4 pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.35, delay: 0.4 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl border border-neutral-300 bg-white/95 p-5 shadow-2xl backdrop-blur-sm"
            initial={{ y: 30 }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-hand text-2xl text-neutral-800">
              {pick(station.name)}
            </h3>

            {done ? (
              <>
                {/* 已完成：回看解锁的项目介绍 */}
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  {pick(station.intro)}
                </p>
                <button
                  onClick={onClose}
                  className="font-hand mt-4 w-full rounded-full bg-neutral-800 py-2 text-lg text-white transition hover:bg-neutral-700"
                >
                  {t("life.focus.close")}
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-neutral-600">{pick(station.hint)}</p>

                {station.id === "drink" ? (
                  <>
                    <p className="mt-4 text-xs text-neutral-400">
                      {t("life.drink.pick")}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {(["a", "b", "c"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => onComplete(c)}
                          className="font-hand flex-1 rounded-xl border-2 border-dashed border-neutral-300 py-3 text-lg text-neutral-700 transition hover:border-neutral-500 hover:bg-white"
                        >
                          {c.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => onComplete()}
                    className="font-hand mt-4 w-full rounded-full bg-neutral-800 py-2 text-lg text-white transition hover:bg-neutral-700"
                  >
                    {t("life.focus.confirm")}
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="mt-2 w-full rounded-full border border-neutral-300 py-2 text-sm text-neutral-500 transition hover:bg-white"
                >
                  {t("life.focus.back")}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
