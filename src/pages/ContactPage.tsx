import { useLanguage } from "../i18n/LanguageContext";

/** 占位页面：后续在这里加入联系方式 / 合作表单 */
export default function ContactPage() {
  const { t } = useLanguage();

  return (
    <section className="py-16 text-center">
      <h1 className="text-2xl font-bold">{t("contact.title")}</h1>
      <p className="mt-4 text-neutral-500">{t("contact.placeholder")}</p>
    </section>
  );
}
