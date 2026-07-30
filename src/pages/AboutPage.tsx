import { motion } from "framer-motion";
import { aboutSections } from "../data/aboutSections";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * 关于 WOOLAB：纵向滚动叙事（灰盒示意）。
 * 进场接首页 WOOLAB 灯牌"开灯"的动作——整页从暗到亮。
 * 章节内容在 src/data/aboutSections.ts 里维护。
 */
export default function AboutPage() {
  const { t, pick } = useLanguage();

  return (
    <div className="relative">
      {/* 开灯进场：整页由暗转亮 */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-30 bg-black"
        initial={{ opacity: 0.85 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />

      {/* 首屏：站名 + 一句话 */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.h1
          className="font-hand text-5xl text-neutral-800"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
        >
          {t("about.title")}
        </motion.h1>
        <motion.p
          className="mt-4 text-neutral-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.7 }}
        >
          {t("about.intro")}
        </motion.p>
        <motion.span
          aria-hidden
          className="font-hand mt-16 text-neutral-400"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          ↓
        </motion.span>
      </section>

      {/* 叙事章节 */}
      {aboutSections.map((section, i) => (
        <section
          key={section.id}
          className="flex min-h-[80vh] items-center justify-center px-6"
        >
          <motion.div
            className="w-full max-w-xl"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <p className="font-hand text-6xl text-black/10">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h2 className="font-hand mt-2 text-3xl text-neutral-800">
              {pick(section.title)}
            </h2>
            <p className="mt-3 leading-relaxed text-neutral-600">
              {pick(section.text)}
            </p>
            {/* 章节配图占位 */}
            <div className="mt-6 flex h-52 items-center justify-center rounded-2xl bg-neutral-200/70 text-xs text-neutral-400">
              {section.image ? (
                <img
                  src={section.image}
                  alt=""
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                "图 · 占位"
              )}
            </div>
          </motion.div>
        </section>
      ))}

      <footer className="pb-24 pt-8 text-center">
        <span className="font-hand text-neutral-400">· 咩 ·</span>
      </footer>
    </div>
  );
}
