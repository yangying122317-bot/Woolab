import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { config } from "../config";
import { useLanguage } from "../i18n/LanguageContext";

export const INTRO_SESSION_KEY = "intro-played";
const SESSION_KEY = INTRO_SESSION_KEY;

/** 开屏结束（自动或点跳过）时广播，首页场景的出场动画接棒 */
export const INTRO_DISMISSED_EVENT = "woolab:intro-dismissed";

/**
 * 开场动画挂载点。
 * 目前是一个简单的淡入淡出占位动画，之后可以在这里替换成
 * 真正的开场演出（序列图、Lottie、视频等）。
 * 通过 src/config.ts 的 introEnabled 开关控制；每个会话只播放一次。
 */
export default function IntroLoader() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(
    () => config.introEnabled && !sessionStorage.getItem(SESSION_KEY),
  );

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismiss(), 2600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
    window.dispatchEvent(new Event(INTRO_DISMISSED_EVENT));
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 text-white"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.img
            src="/assets/logo.svg"
            alt=""
            className="h-24 w-24"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.p
            className="mt-6 text-sm tracking-widest text-neutral-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            {t("siteName")}
          </motion.p>
          <button
            onClick={dismiss}
            className="absolute right-6 bottom-6 rounded-full border border-neutral-600 px-4 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-700"
          >
            {t("intro.skip")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
