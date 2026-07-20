import { labProjects } from "../data/labs";
import { useLanguage } from "../i18n/LanguageContext";

export default function LabPage() {
  const { t, pick } = useLanguage();

  return (
    <section>
      <h1 className="text-2xl font-bold">{t("lab.title")}</h1>
      <p className="mt-1 text-sm text-neutral-500">{t("lab.subtitle")}</p>

      <ul className="mt-8 space-y-4">
        {labProjects.map((project) => {
          const inner = (
            <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <img
                src={project.image}
                alt=""
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
              />
              <div>
                <h2 className="font-semibold">{pick(project.title)}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {pick(project.description)}
                </p>
              </div>
            </div>
          );

          return (
            <li key={project.id}>
              {project.link ? (
                <a href={project.link} target="_blank" rel="noreferrer">
                  {inner}
                </a>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
