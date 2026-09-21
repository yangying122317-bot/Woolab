import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { dict, type Lang } from "../i18n/dict";
import { socialLinks } from "../data/contact";
import { noiseBg } from "./about/geom";
import { playHello } from "../audio/sfx";
import { loadImage } from "./life/preload";

/**
 * 手机上打开时的引导页（设计稿 Frame 34，375 宽）。
 *
 * 整站是给大屏 + 鼠标滚轮做的，手机上不放真页面，只放这一张"信封"：
 * 牛皮纸信封里插着一张白卡片，卡片上是房子的照片和两行字，一个"复制网址"的手绘圈按钮；
 * 首页那只会动的小羊背着包站在左边，头顶一个打招呼的气泡。语言跟系统（navigator.language），不显示 CN/EN 切换。
 *
 * 排版分三段锚定，不整体缩放：logo 贴顶、署名和链接贴底（都留安全区），信封那一组按宽度铺满、
 * 垂直居中在中间——屏幕矮的机型只是上下两段挨得近一点，信封永远是原大。
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
const M = "/assets/mobile";

/** 设计稿宽 375；信封那一组在稿里占 y 262–612，这里把它裁成一块 375×350 的"舞台"，坐标 = 稿 y − GROUP_TOP */
const STAGE_W = 375;
const GROUP_TOP = 262;
const GROUP_H = 350;
/** 舞台最多放大到这么多倍（大屏手机上别把信封撑得太满） */
const GROUP_MAX_SCALE = 1.18;

/**
 * 各图层：Figma 按层导出 SVG（去掉导出时垫的底色矩形）再用无头浏览器 3x 渲成透明 webp；
 * w/h 是 SVG 的标称尺寸（稿单位），位置按设计稿里该图层的中心（已换算到舞台坐标）。
 */
const ART = {
  envBack: { src: `${M}/env-back.webp`, w: 245, h: 205, cx: 186.5, cy: 437 - GROUP_TOP },
  card: { src: `${M}/card.webp`, w: 224, h: 247, cx: 187, cy: 395.5 - GROUP_TOP },
  photo: { src: `${M}/photo.webp`, w: 175, h: 170, cx: 187.1, cy: 454.55 - GROUP_TOP },
  envFront: { src: `${M}/env-front.webp`, w: 254, h: 105, cx: 187.16, cy: 527 - GROUP_TOP },
  tape: { src: `${M}/tape.webp`, w: 45, h: 48, cx: 104.3, cy: 386.8 - GROUP_TOP },
  circle: { src: `${M}/circle.webp`, w: 117, h: 28, cx: 186.87, cy: 343.3 - GROUP_TOP },
} as const;
type Art = (typeof ART)[keyof typeof ART];
const LOGO = { src: `${M}/logo.webp`, w: 96, h: 30 };

/**
 * 小羊直接用首页那只：先放静帧，动图解码好了再换（和首页一样，网慢也不等）。
 * 首页里小羊贴图 176.2 宽、影子 170.2 宽且相对小羊偏 (3, 1)；这里按 92 宽等比换算，
 * 脚底落在稿里设计小羊的脚底（y 608），左边和设计小羊对齐（x 40）。
 */
const SHEEP = {
  still: "/assets/hero-sheep-still.webp",
  anim: "/assets/hero-sheep-idle.webp",
  shadow: "/assets/hero-sheep-shadow.png",
  w: 92,
  h: (92 * 550) / 353,
  left: 39,
  top: 608 - GROUP_TOP - ((92 * 550) / 353) * (534 / 550),
};
const SHEEP_SHADOW = {
  w: (92 * 170.2) / 176.2,
  h: ((92 * 170.2) / 176.2) * (543 / 341),
  left: SHEEP.left + (3 / 176.2) * 92,
  top: SHEEP.top + (1 / 176.2) * 92,
};

/** 气泡：手绘云朵框 + 指向小羊头顶的小尾巴（SVG 现画，线条粗细和信封的描边一致） */
const BUBBLE = { left: 14, top: SHEEP.top - 46, w: 150, h: 60 };

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

function Bubble({ text, pop }: { text: string; pop: number }) {
  return (
    <motion.div
      key={pop}
      className="pointer-events-none absolute"
      style={{ left: BUBBLE.left, top: BUBBLE.top, width: BUBBLE.w, height: BUBBLE.h, transformOrigin: "62% 100%" }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 16, mass: 0.7 }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{ y: [0, -2.5, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 150 60" width={BUBBLE.w} height={BUBBLE.h} className="absolute inset-0 overflow-visible">
          {/* 云朵框：一圈略不规则的椭圆；尾巴从右下方伸出去指向小羊 */}
          <path
            d="M 22 6 C 44 1, 78 0, 104 3 C 128 5, 145 12, 146 24 C 147 36, 133 46, 108 49 C 90 51, 66 51, 46 49 C 24 47, 6 40, 5 27 C 4 16, 10 9, 22 6 Z"
            fill="#fff"
            stroke="#222"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M 78 49 C 80 53, 84 57, 91 60 C 86 57, 84 53, 84 49"
            fill="#fff"
            stroke="#222"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* 盖住尾巴根部那一小段框线，让尾巴和框连成一体 */}
          <path d="M 79 49 L 84 49" stroke="#fff" strokeWidth="3" />
        </svg>
        <span
          className="font-hand absolute flex items-center justify-center whitespace-nowrap text-black"
          style={{ left: 8, top: 4, width: BUBBLE.w - 16, height: 44, fontSize: 17, lineHeight: 1 }}
        >
          {text}
        </span>
      </motion.div>
    </motion.div>
  );
}

export default function MobileGate() {
  /* 语言跟系统 */
  const lang: Lang = useMemo(() => (/^zh/i.test(navigator.language || "") ? "zh" : "en"), []);
  const t = dict[lang];
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  /* 视口：地址栏收起/展开时高度会变，跟着重排 */
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
  /* 信封那一组按宽度铺满 */
  const groupScale = Math.min(vp.w / STAGE_W, GROUP_MAX_SCALE);

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

  /* 小羊：静帧 → 动图；走进来站定后气泡弹出；点它再打一次招呼 */
  const [sheepAnim, setSheepAnim] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadImage(SHEEP.anim).then(() => alive && setSheepAnim(true));
    return () => {
      alive = false;
    };
  }, []);
  const [bubble, setBubble] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setBubble(1), 1500);
    return () => window.clearTimeout(id);
  }, []);
  const greet = () => {
    playHello();
    setBubble((n) => n + 1);
  };

  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 80);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col overflow-hidden text-black"
      style={{ height: vp.h, background: "#F9F6EF", ...noiseBg("cream", 1) }}
    >
      {/* 顶：logo */}
      <motion.div
        className="flex shrink-0 justify-center"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 34px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: shown ? 1 : 0 }}
        transition={{ duration: 0.6 }}
      >
        <img src={LOGO.src} alt="WOOLAB" draggable={false} className="select-none" style={{ width: LOGO.w, height: LOGO.h }} />
      </motion.div>

      {/* 中：信封一组，按宽铺满、垂直居中 */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div
          className="relative"
          style={{ width: STAGE_W * groupScale, height: GROUP_H * groupScale }}
        >
          <div
            className="absolute left-0 top-0"
            style={{ width: STAGE_W, height: GROUP_H, transform: `scale(${groupScale})`, transformOrigin: "0 0" }}
          >
            {/* 信封 + 卡片：一起淡入，不做抽出动画 */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0, y: 12 }}
              animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <Layer art={ART.envBack} />
              <Layer art={ART.card} />
              <Layer art={ART.photo} />
              <Layer art={ART.tape} />

              {/* 卡片上的两行字 */}
              <p
                className="font-hand absolute inset-x-0 whitespace-pre-line text-center"
                style={{ top: 286 - GROUP_TOP, fontSize: 14, lineHeight: 1.25 }}
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

              <Layer art={ART.envFront} />
            </motion.div>

            {/* 小羊：首页那只，从左边走进来；点它打招呼 */}
            <motion.div
              className="absolute inset-0"
              initial={{ x: -170, opacity: 0 }}
              animate={shown ? { x: 0, opacity: 1 } : { x: -170, opacity: 0 }}
              transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={SHEEP.shadow}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{ left: SHEEP_SHADOW.left, top: SHEEP_SHADOW.top, width: SHEEP_SHADOW.w, height: SHEEP_SHADOW.h }}
              />
              <motion.div
                className="absolute"
                style={{ left: SHEEP.left, top: SHEEP.top, width: SHEEP.w, height: SHEEP.h, transformOrigin: "50% 100%" }}
                animate={shown ? { y: [0, -3, 0, -3, 0] } : { y: 0 }}
                transition={{ delay: 0.35, duration: 0.9, ease: "easeInOut" }}
              >
                <img
                  src={sheepAnim ? SHEEP.anim : SHEEP.still}
                  alt="Meelo"
                  draggable={false}
                  className="absolute inset-0 h-full w-full max-w-none select-none"
                />
                <button
                  type="button"
                  aria-label="Meelo"
                  onClick={greet}
                  className="absolute cursor-pointer border-0 bg-transparent p-0"
                  style={{ inset: "-8px -10px", WebkitTapHighlightColor: "transparent" }}
                />
              </motion.div>
              {bubble > 0 && <Bubble text={t["mobile.hi"]} pop={bubble} />}
            </motion.div>
          </div>
        </div>
      </div>

      {/* 底：署名 + 两个社交链接 */}
      <motion.div
        className="shrink-0 text-center"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 30px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: shown ? 1 : 0 }}
        transition={{ delay: 0.9, duration: 0.6 }}
      >
        <p className="font-hand" style={{ fontSize: 14, lineHeight: 1.25 }}>
          {t["mobile.sign"]}
        </p>
        <p className="font-hand" style={{ fontSize: 16, lineHeight: 1.25, marginTop: 6 }}>
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
  );
}
