import { useState } from "react";
import CharacterModal from "../components/CharacterModal";
import { characters } from "../data/characters";
import type { Character } from "../data/characters";
import { useLanguage } from "../i18n/LanguageContext";

export default function CharactersPage() {
  const { t, pick } = useLanguage();
  const [selected, setSelected] = useState<Character | null>(null);

  return (
    <section>
      <h1 className="text-2xl font-bold">{t("characters.title")}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {t("characters.subtitle")}
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {characters.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => setSelected(c)}
              className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <img
                src={c.image}
                alt={pick(c.name)}
                className="mx-auto h-28 w-28 object-contain"
              />
              <h2 className="mt-3 font-semibold">{pick(c.name)}</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {pick(c.tagline)}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <CharacterModal character={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
