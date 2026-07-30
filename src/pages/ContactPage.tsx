import { useState } from "react";
import { motion } from "framer-motion";
import { contactEmail, socialLinks } from "../data/contact";
import { useLanguage } from "../i18n/LanguageContext";
import { playMailboxOpen } from "../audio/sfx";

/**
 * 联系页：一张可以翻面的明信片（灰盒示意）。
 * 正面是招呼语，点击翻面看到邮箱（点击复制）和社交链接。
 * 进场接首页邮箱开盖的动作——明信片从下方抽出来。
 */
export default function ContactPage() {
  const { t } = useLanguage();
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactEmail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪贴板不可用时静默失败，用户仍能看到邮箱手动复制 */
    }
  };

  return (
    <section className="flex min-h-screen items-center justify-center px-6">
      {/* 明信片从画面下方滑入 */}
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 140, rotate: 2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.15 }}
      >
        <div
          className="relative h-64 cursor-pointer select-none [perspective:1200px]"
          onClick={() => {
            setFlipped((f) => !f);
            playMailboxOpen();
          }}
        >
          <motion.div
            className="relative h-full w-full [transform-style:preserve-3d]"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
          >
            {/* 正面 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-neutral-300 bg-white shadow-xl [backface-visibility:hidden]">
              {/* 邮票占位 */}
              <span className="absolute right-4 top-4 flex h-14 w-12 items-center justify-center rounded-sm border-2 border-dashed border-neutral-300 text-xs text-neutral-400">
                咩
              </span>
              <h1 className="font-hand px-8 text-center text-3xl text-neutral-800">
                {t("contact.front")}
              </h1>
              <p className="font-hand mt-6 text-sm text-neutral-400">
                {t("contact.flip")} ↻
              </p>
            </div>

            {/* 背面 */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-2xl border border-neutral-300 bg-white shadow-xl [backface-visibility:hidden]"
              style={{ transform: "rotateY(180deg)" }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void copyEmail();
                }}
                className="group text-center"
                title={t("contact.copy")}
              >
                <span className="font-hand block text-2xl text-neutral-800 underline decoration-neutral-300 underline-offset-4 transition group-hover:decoration-neutral-600">
                  {contactEmail}
                </span>
                <span className="mt-1 block h-5 text-xs text-neutral-400">
                  {copied ? t("contact.copied") : t("contact.copy")}
                </span>
              </button>

              <div className="flex gap-3">
                {socialLinks.map((s) => (
                  <a
                    key={s.id}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-hand rounded-full border border-neutral-300 px-4 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-800 hover:text-white"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
