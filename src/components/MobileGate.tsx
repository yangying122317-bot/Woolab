import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { dict, type Lang } from "../i18n/dict";
import { socialLinks } from "../data/contact";
import { playHello } from "../audio/sfx";
import { loadImage } from "./life/preload";

/**
 * 手机上打开时的引导页（设计稿 Frame 34，375 宽）。
 *
 * 整站是给大屏 + 鼠标滚轮做的，手机上不放真页面，只放这一张"信封"：
 * 牛皮纸信封里插着一张白卡片，卡片上是房子的照片和两行字，一个"复制网址"的手绘圈按钮；
 * 首页那只会动的小羊背着包站在右边、面朝信封，头顶一个打招呼的气泡。语言跟系统（navigator.language），不显示 CN/EN 切换。
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

/**
 * 设计稿宽 375。信封那一组（信封、卡片、照片、胶带、圈按钮）在稿里 254 宽，手机上两行字挤在纸边上，
 * 这里把这组图整体放大 K 倍（字号不放，只放纸），围绕水平中线、以卡片顶边为基准往下长。
 * 舞台 375 宽，坐标 = (稿 y − ENV_TOP) × K + PAD_TOP。
 */
const STAGE_W = 375;
const K = 1.2;
const ENV_TOP = 272; // 稿里卡片顶边
const PAD_TOP = 6;
const CX = STAGE_W / 2;
const sx = (x: number) => CX + (x - CX) * K;
const sy = (y: number) => (y - ENV_TOP) * K + PAD_TOP;
/** 舞台最多放大到这么多倍（大屏手机上别把信封撑得太满） */
const GROUP_MAX_SCALE = 1.1;

/**
 * 各图层：Figma 按层导出 SVG（去掉导出时垫的底色矩形）再用无头浏览器 3x 渲成透明 webp；
 * w/h 是 SVG 的标称尺寸（稿单位）× K，位置按设计稿里该图层的中心换算。
 */
const art = (src: string, w: number, h: number, cx: number, cy: number) => ({
  src: `${M}/${src}`,
  w: w * K,
  h: h * K,
  cx: sx(cx),
  cy: sy(cy),
});
const ART = {
  envBack: art("env-back.webp", 245, 205, 186.5, 437),
  card: art("card.webp", 224, 247, 187, 395.5),
  photo: art("photo.webp", 175, 170, 187.1, 454.55),
  envFront: art("env-front.webp", 254, 105, 187.16, 527),
  tape: art("tape.webp", 45, 48, 104.3, 386.8),
  circle: art("circle.webp", 117, 28, 186.87, 343.3),
};
type Art = (typeof ART)[keyof typeof ART];
const LOGO = { src: `${M}/logo.webp`, w: 96, h: 30 };
/** 卡片上文字的可用宽度：纸两侧各留 20 */
const NOTE_INSET = ART.card.cx - ART.card.w / 2 + 20;
const NOTE_TOP = sy(286);

/**
 * 小羊直接用首页那只：先放静帧，动图解码好了再换（和首页一样，网慢也不等）。
 * 站在信封右下角前面（它本来就是正面偏左看的，放右边正好朝着信封），脚底比信封下沿低一点，站在信封前面。
 * 首页里小羊贴图 176.2 宽、影子 170.2 宽且相对小羊偏 (3, 1)；这里按 100 宽等比换算。
 */
const SHEEP_W = 100;
const SHEEP_H = (SHEEP_W * 550) / 353;
const SHEEP_FEET = sy(527 + 105 / 2) + 18; // 脚底比信封下沿低 18，站在信封前面
const SHEEP = {
  still: "/assets/hero-sheep-still.webp",
  anim: "/assets/hero-sheep-idle.webp",
  shadow: "/assets/hero-sheep-shadow.png",
  w: SHEEP_W,
  h: SHEEP_H,
  left: STAGE_W - 22 - (SHEEP_W * 348) / 353, // 身体右缘（贴图 348/353 处）离屏边 22：稿里它有一小半探出信封外
  top: SHEEP_FEET - SHEEP_H * (534 / 550), // 脚底在贴图 534/550 处
};
const SHEEP_SHADOW = {
  w: (SHEEP_W * 170.2) / 176.2,
  h: ((SHEEP_W * 170.2) / 176.2) * (543 / 341),
  left: SHEEP.left + (3 / 176.2) * SHEEP_W,
  top: SHEEP.top + (1 / 176.2) * SHEEP_W,
};
const GROUP_H = Math.ceil(SHEEP_FEET + 8);

/**
 * 气泡：设计稿里的 Vector 1450（棕色手绘描边、白底带纸噪点，尾巴从右下垂下来），100×46 渲成透明 webp，
 * 按 K 放大后挂在小羊头顶右上方，尾巴尖落在帽子右半边上方。字单独排在框体里。
 */
const BUBBLE_W = 100 * K;
const BUBBLE_H = 46 * K;
const HAT_Y = SHEEP.top + SHEEP_H * (28 / 550);
const BUBBLE = {
  src: `${M}/bubble.webp`,
  w: BUBBLE_W,
  h: BUBBLE_H,
  bodyH: 30 * K, // 框体（不含尾巴）高度
  left: SHEEP.left + 1 - 32, // 身体左缘再往左 32（稿里的相对位置）
  top: HAT_Y - 66,
  tailX: 0.846, // 尾巴尖在图内的横向位置
};

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
  /* 中文比英文宽，字装不下就把框横向拉开一点（手绘椭圆拉 15% 看不出来），尾巴跟着框的比例走 */
  const ref = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(BUBBLE.w);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setW(Math.max(BUBBLE.w, el.offsetWidth + 26));
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
  }, [text]);
  return (
    <motion.div
      key={pop}
      className="pointer-events-none absolute"
      style={{
        left: BUBBLE.left - (w - BUBBLE.w), // 往左长，右边贴着屏边的距离不变
        top: BUBBLE.top,
        width: w,
        height: BUBBLE.h,
        transformOrigin: `${BUBBLE.tailX * 100}% 100%`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 16, mass: 0.7 }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{ y: [0, -2.5, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <img src={BUBBLE.src} alt="" draggable={false} className="absolute inset-0 h-full w-full max-w-none select-none" />
        <span
          className="font-hand absolute flex items-center justify-center whitespace-nowrap text-black"
          style={{ left: 0, top: 0, width: w, height: BUBBLE.bodyH, fontSize: 14, lineHeight: 1 }}
        >
          <span ref={ref}>{text}</span>
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
  /* 信封那一组按宽度铺满；特别矮的屏上再按剩余高度收一收（上下两段大约各占 90） */
  const groupScale = Math.min(vp.w / STAGE_W, GROUP_MAX_SCALE, Math.max(0.7, (vp.h - 180) / GROUP_H));

  /* 复制网址 */
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(0);
  const copy = async () => {
    /* 先走剪贴板 API（要 https），不行再退到 execCommand（局域网 http 预览、老 WebKit） */
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SITE_URL);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = SITE_URL;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.setSelectionRange(0, SITE_URL.length);
        ok = document.execCommand("copy");
        ta.remove();
      } catch {
        ok = false;
      }
    }
    /* 剪贴板彻底不可用时也给个回应，网址就在圈里，用户可以长按 */
    setCopied(true);
    setPulse((n) => n + 1);
    window.setTimeout(() => setCopied(false), 1600);
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
      style={{ height: vp.h, background: "#fff" }}
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
                className="font-hand absolute whitespace-pre-line text-center"
                style={{ left: NOTE_INSET, right: NOTE_INSET, top: NOTE_TOP, fontSize: 14, lineHeight: 1.25 }}
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
                  touchAction: "manipulation",
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

            {/* 小羊：首页那只，站在信封右边，跟信封一起淡入；点它打招呼。这层铺满舞台，得放行点击给下面的复制按钮 */}
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0, y: 12 }}
              animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <img
                src={SHEEP.shadow}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{ left: SHEEP_SHADOW.left, top: SHEEP_SHADOW.top, width: SHEEP_SHADOW.w, height: SHEEP_SHADOW.h }}
              />
              <div className="absolute" style={{ left: SHEEP.left, top: SHEEP.top, width: SHEEP.w, height: SHEEP.h }}>
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
                  className="pointer-events-auto absolute cursor-pointer border-0 bg-transparent p-0"
                  style={{ inset: "-8px -10px", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                />
              </div>
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
