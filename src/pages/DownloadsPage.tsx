import { useLanguage } from "../i18n/LanguageContext";

/** 占位页面：后续在这里加入壁纸 / 素材下载列表 */
export default function DownloadsPage() {
  const { t } = useLanguage();

  return (
    <section className="py-16 text-center">
      <h1 className="text-2xl font-bold">{t("downloads.title")}</h1>
      <p className="mt-4 text-neutral-500">{t("downloads.placeholder")}</p>
    </section>
  );
}
