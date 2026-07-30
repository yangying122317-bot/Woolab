import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { markNewsSeen, sortedNews } from "../data/news";
import type { NewsPost } from "../data/news";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * 小羊日报：报纸拟物排版（灰盒示意）。
 * 版面规则见 src/data/news.ts——头条/次条/豆腐块按数据自动落位，
 * 发新内容不用改这里。插图位将来放动画 WebP（"会动的照片"）。
 */
export default function NewsPage() {
  const { t, pick, lang } = useLanguage();
  const posts = sortedNews();

  // 进过日报页 = 看过最新一期，导航上的小圆点熄灭
  useEffect(() => {
    markNewsSeen();
  }, []);

  const visual = posts.filter((p) => p.kind !== "note");
  const headline = visual[0];
  const secondary = visual.slice(1);
  const briefs = posts.filter((p) => p.kind === "note");

  const dateText = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(
      lang === "zh" ? "zh-CN" : "en-US",
      { year: "numeric", month: "long", day: "numeric" },
    );

  return (
    <div className="min-h-screen bg-neutral-200/60 px-4 pb-20 pt-20">
      <motion.article
        className="mx-auto max-w-4xl bg-white px-6 py-8 shadow-xl sm:px-10 sm:py-10"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        {/* 报头 */}
        <header className="text-center">
          <p className="text-[11px] tracking-widest text-neutral-400">
            {t("news.motto")}
          </p>
          <h1 className="font-hand mt-2 text-5xl text-neutral-900">
            {t("news.masthead")}
          </h1>
          <div className="mt-4 flex items-center justify-between border-y-2 border-neutral-800 py-1.5 text-xs text-neutral-500">
            <span>{headline ? dateText(headline.date) : ""}</span>
            <span>No. {posts.length}</span>
            <span>WOOLAB</span>
          </div>
        </header>

        {/* 头条 + 次条 */}
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {headline && (
            <section className="md:col-span-2">
              <Figure post={headline} large />
              <h2 className="font-hand mt-4 text-3xl leading-snug text-neutral-900">
                {pick(headline.title)}
              </h2>
              {headline.text && (
                <p className="mt-2 leading-relaxed text-neutral-600">
                  {pick(headline.text)}
                </p>
              )}
              {headline.link && <ReadMore to={headline.link} />}
            </section>
          )}

          <aside className="space-y-8 border-neutral-200 md:border-l md:pl-8">
            {secondary.map((post) => (
              <section key={post.id}>
                <Figure post={post} />
                <h3 className="font-hand mt-3 text-xl leading-snug text-neutral-800">
                  {pick(post.title)}
                </h3>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  {dateText(post.date)}
                </p>
                {post.text && (
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                    {pick(post.text)}
                  </p>
                )}
                {post.link && <ReadMore to={post.link} />}
              </section>
            ))}
          </aside>
        </div>

        {/* 豆腐块小启事 */}
        {briefs.length > 0 && (
          <footer className="mt-10 border-t-2 border-neutral-800 pt-4">
            <p className="font-hand text-sm text-neutral-500">
              {t("news.briefs")}
            </p>
            <div className="mt-3 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {briefs.map((post, i) => (
                <div
                  key={post.id}
                  className={i > 0 ? "border-neutral-200 sm:border-l sm:pl-6" : ""}
                >
                  <h4 className="font-hand text-base text-neutral-800">
                    {pick(post.title)}
                  </h4>
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    {dateText(post.date)}
                  </p>
                  {post.text && (
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      {pick(post.text)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </footer>
        )}
      </motion.article>
    </div>
  );
}

/**
 * 报纸照片框：将来放动画 WebP——静止排版里"会动的照片"。
 * 灰盒阶段用呼吸的灰块示意动图位；有 image 就直接渲染。
 */
function Figure({ post, large }: { post: NewsPost; large?: boolean }) {
  const { t, pick } = useLanguage();

  return (
    <figure className="border border-neutral-300 bg-white p-2 pb-1 shadow-sm">
      {post.image ? (
        <img
          src={post.image}
          alt={pick(post.title)}
          className={`w-full object-cover ${large ? "aspect-[4/3]" : "aspect-square"}`}
        />
      ) : (
        <div
          className={`flex w-full items-center justify-center bg-neutral-200/80 ${
            large ? "aspect-[4/3]" : "aspect-square"
          }`}
        >
          <motion.span
            className="text-xs text-neutral-400"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {t("news.figure")}
          </motion.span>
        </div>
      )}
      <figcaption className="font-hand px-1 pt-1 text-center text-xs text-neutral-400">
        {pick(post.title)}
      </figcaption>
    </figure>
  );
}

function ReadMore({ to }: { to: string }) {
  const { t } = useLanguage();
  const external = to.startsWith("http");

  return external ? (
    <a
      href={to}
      target="_blank"
      rel="noreferrer"
      className="font-hand mt-2 inline-block text-sm text-neutral-700 underline decoration-neutral-300 underline-offset-4 transition hover:decoration-neutral-700"
    >
      {t("news.readmore")} →
    </a>
  ) : (
    <Link
      to={to}
      className="font-hand mt-2 inline-block text-sm text-neutral-700 underline decoration-neutral-300 underline-offset-4 transition hover:decoration-neutral-700"
    >
      {t("news.readmore")} →
    </Link>
  );
}
