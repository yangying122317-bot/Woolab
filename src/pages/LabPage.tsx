import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { labProjects } from "../data/labs";
import { useLanguage } from "../i18n/LanguageContext";
import { playNavigate } from "../audio/sfx";

/** 卡片的固定小角度（像随手钉上去的），按索引循环 */
const TILTS = [-2.2, 1.6, -1.2, 2.4];

/**
 * 实验室列表：一块钉板，项目像卡片一样钉在上面（灰盒示意）。
 * 点击卡片进入 /lab/:projectId 详情（设计过程 + 实物 + 下载）。
 */
export default function LabPage() {
  const { t, pick } = useLanguage();

  return (
    <section className="mx-auto max-w-5xl px-6 pb-20 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h1 className="font-hand text-4xl text-neutral-800">{t("lab.title")}</h1>
        <p className="mt-2 text-sm text-neutral-500">{t("lab.subtitle")}</p>
      </motion.div>

      <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {labProjects.map((project, i) => (
          <motion.li
            key={project.id}
            initial={{ opacity: 0, y: 24, rotate: TILTS[i % TILTS.length] }}
            animate={{ opacity: 1, y: 0, rotate: TILTS[i % TILTS.length] }}
            transition={{ duration: 0.5, delay: 0.08 * i, ease: "easeOut" }}
            whileHover={{ rotate: 0, scale: 1.04 }}
          >
            <Link
              to={`/lab/${project.id}`}
              onClick={() => playNavigate()}
              className="relative block rounded-xl border border-neutral-300 bg-white p-3 pb-4 shadow-md transition hover:shadow-lg"
            >
              {/* 图钉 */}
              <span className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full border border-neutral-400 bg-neutral-200 shadow-sm" />

              {/* 配图占位 */}
              <div className="mt-3 flex h-32 items-center justify-center rounded-lg bg-neutral-100">
                <img
                  src={project.image}
                  alt=""
                  className="h-20 w-20 object-contain opacity-60"
                />
              </div>

              <h2 className="font-hand mt-3 text-xl text-neutral-800">
                {pick(project.title)}
              </h2>
              <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                {pick(project.description)}
              </p>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
