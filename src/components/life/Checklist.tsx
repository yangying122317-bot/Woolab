import { AnimatePresence, motion } from "framer-motion";
import { lifeStations } from "../../data/lifeStations";
import { doneCount, isStationDone } from "../../state/roomState";
import type { RoomState } from "../../state/roomState";
import { useLanguage } from "../../i18n/LanguageContext";

interface Props {
  room: RoomState;
  open: boolean;
  onToggle: () => void;
  /** 重新过一晚：清空房间状态 */
  onReset: () => void;
}

/**
 * 「今晚的小事」清单：
 * 入口是墙上挂着的清单素材（RoomStage 里点它打开）；
 * 打开后像把那张纸取下来凑近看——居中弹出一张纸卡，
 * 每完成一项由页面自动弹开，盖一个手绘风印章后自动收回。
 */
export default function Checklist({ room, open, onToggle, onReset }: Props) {
  const { t, pick } = useLanguage();
  const count = doneCount(room);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="checklist"
          className="absolute inset-0 z-30 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* 点空白处收回 */}
          <div className="absolute inset-0 bg-black/20" onClick={onToggle} />

          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.7, rotate: 4 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: -1.5 }}
            exit={{ opacity: 0, y: 24, scale: 0.8, rotate: 3 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative w-72 overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-2xl"
          >
            {/* 顶部木条：呼应墙上素材的挂轴 */}
            <div className="flex items-center justify-between bg-[#A9713B] px-5 py-2.5">
              <h3 className="font-hand text-xl text-white">
                {t("life.checklist.title")}
              </h3>
              <button
                onClick={onToggle}
                aria-label={t("close")}
                className="-mr-1 rounded-full px-2 py-0.5 text-white/80 transition hover:bg-white/15"
              >
                ×
              </button>
            </div>

            <div className="p-5 pt-4">
              <ul className="space-y-2.5">
                {lifeStations.map((s) => {
                  const done = isStationDone(room, s.id);
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3">
                      <span
                        className={`text-sm ${
                          done ? "text-neutral-400 line-through" : "text-neutral-700"
                        }`}
                      >
                        {pick(s.name)}
                      </span>
                      {done ? (
                        <motion.span
                          initial={{ scale: 2.4, opacity: 0, rotate: -32 }}
                          animate={{ scale: 1, opacity: 1, rotate: -12 }}
                          transition={{ type: "spring", stiffness: 480, damping: 18 }}
                          className="font-hand flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-neutral-700/80 text-sm text-neutral-700"
                        >
                          咩
                        </motion.span>
                      ) : (
                        <span className="h-8 w-8 shrink-0 rounded-full border-2 border-dashed border-neutral-300" />
                      )}
                    </li>
                  );
                })}
              </ul>

              {count > 0 && (
                <button
                  onClick={onReset}
                  className="mt-4 text-xs text-neutral-400 underline decoration-dotted underline-offset-2 transition hover:text-neutral-600"
                >
                  {t("life.reset")}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
