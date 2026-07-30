import { AnimatePresence, motion } from "framer-motion";
import { characters } from "../data/characters";
import { useLanguage } from "../i18n/LanguageContext";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 点击「去它家看看」：由首页触发开门过场 */
  onVisit: () => void;
}

const sheep = characters.find((c) => c.id === "sheep")!;

/**
 * 小羊的身份卡：点击场景里的小羊时弹出的角色名片。
 * 场景压暗，卡片像发牌一样落下来。
 * 当前为黑白灰原型：立绘用灰块占位，等正式视觉再替换。
 */
export default function IdentityCard({ open, onClose, onVisit }: Props) {
  const { t, pick } = useLanguage();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-3xl border border-neutral-300 bg-white p-6 shadow-2xl"
            initial={{ opacity: 0, y: -60, rotate: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, rotate: 4, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 立绘占位 */}
            <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-2xl bg-neutral-200/70 text-xs text-neutral-400">
              立绘 · 占位
            </div>
            <h2 className="font-hand mt-3 text-center text-3xl text-neutral-800">
              {pick(sheep.name)}
            </h2>
            <p className="mt-1 text-center text-sm text-neutral-500">
              {pick(sheep.tagline)}
            </p>

            {sheep.profile && (
              <dl className="mt-5 space-y-2 rounded-2xl bg-neutral-100 p-4 text-sm">
                {sheep.profile.map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <dt className="font-hand shrink-0 text-base text-neutral-500">
                      {pick(item.label)}
                    </dt>
                    <dd className="text-neutral-700">{pick(item.value)}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-full border border-neutral-300 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100"
              >
                {t("close")}
              </button>
              <button
                onClick={onVisit}
                className="font-hand flex-1 rounded-full bg-neutral-800 py-2 text-base text-white transition hover:bg-neutral-700"
              >
                {t("card.visit")} →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
