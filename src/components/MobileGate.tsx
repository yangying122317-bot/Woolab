import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { dict, type Lang } from "../i18n/dict";
import { socialLinks } from "../data/contact";
import { noiseBg } from "./about/geom";

/**
 * 手机上打开时的引导页（设计稿 Frame 34，375×812）。
 *
 * 整站是给大屏 + 鼠标滚轮做的，手机上不放真页面，只放这一张"信封"：
 * 牛皮纸信封里插着一张白卡片，卡片上是房子的照片和两行字，一个"复制网址"的手绘圈按钮；
 * 小羊背着包站在左边。语言跟系统（navigator.language），不显示 CN/EN 切换。
 *
 * 布局按 375×812 的舞台写死像素，再整体缩放到刚好装进视口（等比、居中），
 * 各种手机尺寸都是同一张画，不会因为屏幕矮就叠起来。
 */

/** 手机判定：触屏 + 短边不到 768（iPad 横屏、桌面窄窗口都放行）。?gate=1 / ?gate=0 可强制 */
export function isPhone(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("gate");
  if (q === "1") return true;
  if (q === "0") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const short = Math.min(window.innerWidth, window.innerHeight) < 768;
  return coarse && short;
}

const SITE_URL = "https://woolab.art";
const STAGE = { w: 375, h: 812 };
const M = "/assets/mobile";

/**
 * 各图层：Figma 按层导出 SVG（去掉导出时垫的底色矩形）再用无头浏览器 3x 渲成透明 webp；
 * w/h 是 SVG 的标称尺寸（稿单位），位置按设计稿里该图层的中心。
 */
const ART = {
  envBack: { src: `${M}/env-back.webp`, w: 245, h: 205, cx: 186.5, cy: 437 },
  card: { src: `${M}/card.webp`, w: 224, h: 247, cx: 187, cy: 395.5 },
  photo: { src: `${M}/photo.webp`, w: 175, h: 170, cx: 187.1, cy: 454.55 },
  envFront: { src: `${M}/env-front.webp`, w: 254, h: 105, cx: 187.16, cy: 527 },
  tape: { src: `${M}/tape.webp`, w: 45, h: 48, cx: 104.3, cy: 386.8 },
  circle: { src: `${M}/circle.webp`, w: 117, h: 28, cx: 186.87, cy: 343.3 },
  sheep: { src: `${M}/sheep.webp`, w: 88, h: 140, cx: 82.9, cy: 538.5 },
  logo: { src: `${M}/logo.webp`, w: 96, h: 30, cx: 187.25, cy: 55 },
} as const;
type Art = (typeof ART)[keyof typeof ART];

/** 卡片从信封里抽出来之前往下塞多少（塞到整张都躲在信封正面后面） */
const CARD_TUCK = 215;
/** 信封底边：卡片塞进去的部分在这条线以下裁掉，别从信封底下露出来 */
const ENV_BOTTOM = ART.envBack.cy + ART.envBack.h / 2 - 3;

function Layer({ art, className = "", style }: { art: Art; className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src={art.src}
      alt=""
      draggable={false}
      className={`pointer-events-none absolute max-w-none select-none ${className}`}
      style={{ left: art.cx - art.w / 2, top: art.cy - art.h / 2, width: art.w, height: art.h, ...style }}
    />
  );
}

export default function MobileGate() {
  /* 语言跟系统 */
  const lang: Lang = useMemo(() => (/^zh/i.test(navigator.language || "") ? "zh" : "en"), []);
  const t = dict[lang];
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  /* 舞台缩放：等比装进视口 */
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    window.visualViewport?.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
      window.visualViewport?.removeEventListener("resize", on);
    };
  }, []);
  const scale = Math.min(vp.w / STAGE.w, vp.h / STAGE.h);

  /* 复制网址 */
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(0);
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SITE_URL);
      } else {
        const ta = document.createElement("textarea");
        ta.value = SITE_URL;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      setPulse((n) => n + 1);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪贴板不可用：文字仍在，用户可以长按地址栏 */
    }
  };

  /* 圈要罩住字：英文比中文长，按字宽把圈横向拉开（中文正好是设计稿原大） */
  const labelRef = useRef<HTMLSpanElement>(null);
  const [circleW, setCircleW] = useState<number>(ART.circle.w);
  useEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    const fit = () => setCircleW(Math.max(ART.circle.w, el.offsetWidth + 30));
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
  }, [lang, copied]);

  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-hidden text-black"
      style={{ background: "#F9F6EF", ...noiseBg("cream", 1) }}
    >
      <div
        className="absolute"
        style={{
          left: (vp.w - STAGE.w * scale) / 2,
          top: (vp.h - STAGE.h * scale) / 2,
          width: STAGE.w,
          height: STAGE.h,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* 顶部 logo */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: shown ? 1 : 0 }} transition={{ duration: 0.6 }}>
          <Layer art={ART.logo} />
        </motion.div>

        {/* 信封背面：先落定 */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <Layer art={ART.envBack} />
        </motion.div>

        {/* 卡片一组（白卡 + 照片 + 胶带 + 字 + 按钮）：从信封里往上抽出来；信封底边以下裁掉 */}
        <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: ENV_BOTTOM }}>
          <motion.div
            className="absolute inset-0"
            initial={{ y: CARD_TUCK }}
            animate={{ y: shown ? 0 : CARD_TUCK }}
            transition={{ delay: 0.45, type: "spring", stiffness: 150, damping: 17, mass: 0.9 }}
          >
            <Layer art={ART.card} />
            <Layer art={ART.photo} />
            <Layer art={ART.tape} />

            {/* 卡片上的两行字 */}
            <p
              className="font-hand absolute inset-x-0 whitespace-pre-line text-center"
              style={{ top: 286, fontSize: 14, lineHeight: 1.25 }}
            >
              {t["mobile.note"]}
            </p>

            {/* 复制网址：手绘圈里一行字，点了圈圈跳一下、字变"已复制" */}
            <button
              type="button"
              onClick={() => void copy()}
              className="absolute cursor-pointer border-0 bg-transparent p-0"
              style={{
                left: ART.circle.cx - 90,
                top: ART.circle.cy - 22,
                width: 180,
                height: 44,
                WebkitTapHighlightColor: "transparent",
              }}
              aria-label={t["mobile.copy"]}
            >
              <motion.img
                key={pulse}
                src={ART.circle.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  left: 90 - circleW / 2,
                  top: 22 - ART.circle.h / 2,
                  width: circleW,
                  height: ART.circle.h,
                }}
                initial={pulse ? { scale: 1 } : false}
                animate={pulse ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span ref={labelRef} className="font-hand whitespace-nowrap" style={{ fontSize: 20, lineHeight: 1 }}>
                  {copied ? t["mobile.copied"] : t["mobile.copy"]}
                </span>
              </span>
            </button>
          </motion.div>
        </div>

        {/* 信封正面：盖在卡片前面 */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <Layer art={ART.envFront} />
        </motion.div>

        {/* 小羊：从左边走进来 */}
        <motion.div
          initial={{ x: -150, opacity: 0 }}
          animate={shown ? { x: 0, opacity: 1 } : { x: -150, opacity: 0 }}
          transition={{ delay: 0.9, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            animate={shown ? { y: [0, -3, 0] } : { y: 0 }}
            transition={{ delay: 0.9, duration: 0.9, repeat: 1, ease: "easeInOut" }}
          >
            <Layer art={ART.sheep} />
          </motion.div>
        </motion.div>

        {/* 底部：署名 + 两个社交链接 */}
        <motion.div
          className="absolute inset-x-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: shown ? 1 : 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >
          <p className="font-hand absolute inset-x-0 text-center" style={{ top: 729, fontSize: 14, lineHeight: 1.25 }}>
            {t["mobile.sign"]}
          </p>
          <p className="font-hand absolute inset-x-0 text-center" style={{ top: 751, fontSize: 16, lineHeight: 1.25 }}>
            {socialLinks.map((l, i) => (
              <span key={l.id}>
                {i > 0 && " / "}
                <a href={l.href} target="_blank" rel="noreferrer" className="text-black no-underline">
                  {l.label.en}
                </a>
              </span>
            ))}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
