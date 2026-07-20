import { AnimatePresence, motion } from "framer-motion";
import type { Character } from "../data/characters";
import { useLanguage } from "../i18n/LanguageContext";

interface Props {
  character: Character | null;
  onClose: () => void;
}

export default function CharacterModal({ character, onClose }: Props) {
  const { t, pick } = useLanguage();

  return (
    <AnimatePresence>
      {character && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={character.image}
              alt={pick(character.name)}
              className="mx-auto h-40 w-40 object-contain"
            />
            <h2 className="mt-4 text-center text-xl font-bold">
              {pick(character.name)}
            </h2>
            <p className="mt-1 text-center text-sm text-neutral-500">
              {pick(character.tagline)}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-neutral-700">
              {pick(character.description)}
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-neutral-800 py-2 text-sm text-white transition hover:bg-neutral-700"
            >
              {t("close")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
