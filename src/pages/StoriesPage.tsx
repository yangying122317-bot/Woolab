import { Link } from "react-router-dom";
import { storySeries } from "../data/stories";
import { useLanguage } from "../i18n/LanguageContext";

export default function StoriesPage() {
  const { t, pick } = useLanguage();

  return (
    <section>
      <h1 className="text-2xl font-bold">{t("stories.title")}</h1>
      <p className="mt-1 text-sm text-neutral-500">{t("stories.subtitle")}</p>

      <ul className="mt-8 grid gap-6 sm:grid-cols-2">
        {storySeries.map((series) => (
          <li key={series.id}>
            <Link
              to={`/stories/${series.id}`}
              className="block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <img
                src={series.cover}
                alt={pick(series.title)}
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="p-5">
                <h2 className="font-semibold">{pick(series.title)}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {pick(series.summary)}
                </p>
                <p className="mt-3 text-xs text-neutral-400">
                  {series.episodes.length} {t("stories.episodes")}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
