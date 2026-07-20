import { useLanguage } from "../i18n/LanguageContext";

/** 世界观 / 品牌介绍：正文直接在这里替换，或以后接入数据文件 */
const aboutContent = {
  zh: [
    "占位段落一：介绍这个世界的由来、小羊是谁。",
    "占位段落二：介绍创作理念和背后的故事。",
  ],
  en: [
    "Placeholder paragraph one: how this world came to be, and who Little Sheep is.",
    "Placeholder paragraph two: the ideas and story behind the creation.",
  ],
};

export default function AboutPage() {
  const { t, lang } = useLanguage();

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">{t("about.title")}</h1>
      <img
        src="/assets/about-hero.svg"
        alt=""
        className="mt-6 w-full rounded-2xl border border-neutral-200"
      />
      <div className="mt-6 space-y-4 leading-relaxed text-neutral-700">
        {aboutContent[lang].map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}
