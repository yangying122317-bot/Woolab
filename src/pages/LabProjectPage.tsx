import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { labProjects } from "../data/labs";
import { useLanguage } from "../i18n/LanguageContext";

/** 章节进场：滚动到视口内时淡入上移 */
const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 as const },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

/**
 * 实验室项目详情模板：设计过程 → 实物产品 → 下载（三段均可选）。
 * 数据全部来自 src/data/labs.ts，加项目不用改这里。
 */
export default function LabProjectPage() {
  const { projectId } = useParams();
  const { t, pick } = useLanguage();
  const project = labProjects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <section className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-neutral-500">{t("lab.notFound")}</p>
        <Link to="/lab" className="font-hand text-lg underline underline-offset-4">
          ← {t("lab.back")}
        </Link>
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-2xl px-6 pb-24 pt-24">
      {/* 头部：标题 + 一句话 */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Link
          to="/lab"
          className="text-sm text-neutral-400 transition hover:text-neutral-700"
        >
          ← {t("lab.back")}
        </Link>
        <h1 className="font-hand mt-4 text-4xl text-neutral-800">
          {pick(project.title)}
        </h1>
        <p className="mt-2 text-neutral-500">{pick(project.description)}</p>
      </motion.header>

      {/* 设计过程 */}
      {project.process && (
        <motion.section className="mt-16" {...reveal}>
          <h2 className="font-hand text-2xl text-neutral-800">
            {t("lab.process")}
          </h2>
          <ol className="mt-6 space-y-8">
            {project.process.map((step, i) => (
              <motion.li key={i} className="flex gap-4" {...reveal}>
                <span className="font-hand mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-neutral-300 text-neutral-500">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <h3 className="font-hand text-lg text-neutral-700">
                    {pick(step.title)}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                    {pick(step.text)}
                  </p>
                  {/* 步骤配图占位 */}
                  <div className="mt-3 flex h-36 items-center justify-center rounded-xl bg-neutral-200/70 text-xs text-neutral-400">
                    {step.image ? (
                      <img
                        src={step.image}
                        alt=""
                        className="h-full w-full rounded-xl object-cover"
                      />
                    ) : (
                      "图 · 占位"
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </motion.section>
      )}

      {/* 实物产品 */}
      {project.product && (
        <motion.section className="mt-16" {...reveal}>
          <h2 className="font-hand text-2xl text-neutral-800">
            {t("lab.product")}
          </h2>
          <div className="mt-6 flex h-72 items-center justify-center rounded-2xl bg-neutral-200/70">
            <img
              src={project.product.image}
              alt=""
              className="h-40 w-40 object-contain opacity-60"
            />
          </div>
          <p className="mt-3 text-center text-sm text-neutral-500">
            {pick(project.product.caption)}
          </p>
        </motion.section>
      )}

      {/* 下载：视觉封装成"撕一张带走"的卡片 */}
      {project.download && (
        <motion.section className="mt-16" {...reveal}>
          <h2 className="font-hand text-2xl text-neutral-800">
            {t("lab.download")}
          </h2>
          <div className="mt-6 rounded-2xl border-2 border-dashed border-neutral-300 p-6 text-center">
            <p className="font-hand text-lg text-neutral-700">
              {pick(project.download.label)}
            </p>
            {project.download.href ? (
              <a
                href={project.download.href}
                download
                className="font-hand mt-4 inline-block rounded-full bg-neutral-800 px-6 py-2 text-white transition hover:bg-neutral-700"
              >
                ↓
              </a>
            ) : (
              <span className="mt-4 inline-block cursor-not-allowed rounded-full bg-neutral-200 px-6 py-2 text-sm text-neutral-400">
                {t("lab.download.cta")}
              </span>
            )}
          </div>
        </motion.section>
      )}
    </article>
  );
}
