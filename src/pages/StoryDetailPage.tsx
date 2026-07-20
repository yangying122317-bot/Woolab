import { Link, useParams } from "react-router-dom";
import { storySeries } from "../data/stories";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * 系列详情页模板：所有系列共用，通过路由参数 :seriesId 匹配数据。
 */
export default function StoryDetailPage() {
  const { seriesId } = useParams();
  const { t, pick } = useLanguage();

  const series = storySeries.find((s) => s.id === seriesId);

  if (!series) {
    return (
      <section className="py-16 text-center text-neutral-500">
        <p>{t("stories.notFound")}</p>
        <Link
          to="/stories"
          className="mt-4 inline-block text-sm underline underline-offset-2"
        >
          ← {t("stories.title")}
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl">
      <Link
        to="/stories"
        className="text-sm text-neutral-400 underline-offset-2 hover:underline"
      >
        ← {t("stories.title")}
      </Link>

      <h1 className="mt-4 text-2xl font-bold">{pick(series.title)}</h1>
      <p className="mt-2 text-neutral-500">{pick(series.summary)}</p>
      <img
        src={series.cover}
        alt=""
        className="mt-6 w-full rounded-2xl border border-neutral-200"
      />

      <div className="mt-10 space-y-12">
        {series.episodes.map((ep) => (
          <article key={ep.id}>
            <h2 className="text-lg font-semibold">{pick(ep.title)}</h2>
            {ep.image && (
              <img
                src={ep.image}
                alt=""
                className="mt-4 w-full rounded-xl border border-neutral-200"
              />
            )}
            <div className="mt-4 space-y-3 leading-relaxed text-neutral-700">
              {ep.paragraphs.map((p, i) => (
                <p key={i}>{pick(p)}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
