import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "framer-motion";
import { contactEmail, socialLinks } from "../data/contact";
import { useLanguage } from "../i18n/LanguageContext";
import { PHONE, playPhonePickup, preloadPhoneHello } from "../audio/sfx";
import { noiseBg, type Box } from "../components/about/geom";

/**
 * Contact 页：一封摊开的信。
 * 信封立在画面正中，信纸插在封口里（静态），联系方式都写在信纸上；小羊抱着腿坐在信封左边；
 * 右边从屏幕顶上垂一根电话线，挂着一只黄色听筒——hover 轻轻晃一下，点它拿起来：
 * 听筒里「嘟——」一声，对面一句闷闷的「hello?」，同时听筒旁冒出手写的 Hello? ...Maybe leave a note。
 *
 * 整页按 720×450 的稿等比缩放居中（和 About 页同一套），下面的坐标全是稿单位。
 */

const FW = 720;
const FH = 450;
const BG = "#F8F9F4";
const C = "/assets/contact";

/* 各图层在稿里的包围盒（含描边溢出，图就是按这个框导出的） */
const ART = {
  envBack: { x: 190.5, y: 122.5, w: 336, h: 235 },
  paper: { x: 215.75, y: 82.5, w: 296, h: 259 },
  envFront: { x: 186.66, y: 268, w: 345, h: 104 },
  fold: { x: 215.75, y: 281.5, w: 296, h: 50 },
  sheep: { x: 128.7, y: 269.5, w: 85, h: 125 },
  cord: { x: 582.5, y: -7.5, w: 14, h: 276 },
  handset: { x: 571.91, y: 263.72, w: 39, h: 112 },
} satisfies Record<string, Box>;

/* 信纸上的字：都以 x=360 为中线 */
const CX = 360;
/* 整块比稿子略往上收（标题 103 → 99），给"邮箱 → 也可以在这里找到我们"之间多留点空；链接那行不能再往下，底下就是信封前片 */
const TITLE = { y: 99, size: 16 };
/** 标题里那枚手写 WOOLAB（53×17） */
const MARK = { w: 53, h: 17 };
const SUB = { y: 127, w: 186, wZh: 230, size: 10 };
const WRITE = { y: 168 };
const EMAIL = { y: 191 };
const FIND = { y: 229 };
const LINKS = { y: 252 };
const HEAD_SIZE = 14;
const LINK_SIZE = 12;

/**
 * 听筒底下那句话：贴在听筒下缘下方。
 * 说话时听筒是拿起来的姿态——绕顶端（4%）转了约 PICKED_ROT 度，下端那只听筒头（约 0.8h 处）往右甩出 0.8h·sin(θ)；
 * 字要对着甩出去之后的听筒头居中，不然看着偏左。
 */
const PICKED_ROT = 10;
const BUBBLE = {
  cx: ART.handset.x + ART.handset.w / 2 + ART.handset.h * 0.8 * Math.sin((PICKED_ROT * Math.PI) / 180),
  y: ART.handset.y + ART.handset.h + 10,
  w: 150,
  size: 11,
};

/** 电话说完之后气泡再留多久，然后一起收掉、听筒放回去 */
const BUBBLE_STAY = 3.2;

/** 电话线底端（钉在听筒上的那点）；线顶端跟着视口顶边走，长度按需竖向拉 */
const CORD_END = ART.cord.y + ART.cord.h;
/** 进场：听筒从屏幕顶上放下来，线跟着放长，弹簧到位；进页面稍等一拍再开始 */
const HANG_DROP_DELAY = 0.35;
/**
 * 摆动和目录吊牌同一套：落地那一下给角度弹簧一个初速度，自己晃出来、一次比一次小。
 * 电话线比吊牌的绳短，同样角度末端摆幅小，力度给大一点。
 */
const KICK = 24;
/**
 * 整组（线 + 听筒 + 气泡）相对稿再往左挪一点：站点顶栏的 MENU / CN 排得比稿里稍开，
 * 按稿的位置线会贴着 CN，挪过去正好从 MENU 和 CN 正中间穿下去（顶栏高度处线心 ≈ MENU 右边和 CN 左边的中点）。
 */
const HANG_SHIFT = -12;

export default function ContactPage() {
  const { t, lang } = useLanguage();
  const zh = lang === "zh";
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [copied, setCopied] = useState(false);
  const [emailHover, setEmailHover] = useState(false);
  /** 电话：idle → 已拿起（ring 嘟 / hello 对面说话、底下冒字）→ 放回去 */
  const [call, setCall] = useState<"idle" | "ring" | "hello">("idle");
  /** 拿起 / 放回：听筒被拎歪那层 */
  const handset = useAnimationControls();
  /** 电话线垂到位了才接受 hover / 点击 */
  const [hung, setHung] = useState(false);
  const timers = useRef<number[]>([]);
  const at = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
      timers.current.forEach(window.clearTimeout);
    };
  }, []);

  const s = Math.min(vp.w / FW, vp.h / FH);
  const ox = (vp.w - FW * s) / 2;
  const oy = (vp.h - FH * s) / 2;
  /* 电话线顶端要够到视口顶边：比稿高的屏幕上舞台上方有空白，线就得往上接（稿单位，负数） */
  const hangTop = Math.min(ART.cord.y, -oy / s);
  const cordH = CORD_END - hangTop;
  const hangH = ART.handset.y + ART.handset.h - hangTop;
  /*
   * 横向跟着顶栏走：顶栏是贴视口右边排的（单位和 s 一样），稿里电话线正好从 MENU 和 CN 之间穿过去，
   * 比稿宽的屏幕上舞台两边留白、顶栏却贴着屏幕边，线要保持穿在那个缝里就得一起往右挪 ox/s。
   * 听筒和它旁边的话跟着线走。
   */
  const hangX = ox / s + HANG_SHIFT;

  /*
   * 听筒的下落量 y（稿单位）：一开始整只藏在屏幕上面；线顶钉在视口顶边不动，
   * 听筒掉多深线就放多长（scaleY 跟着 y），落地回弹时线也跟着长短一下。
   */
  const y = useMotionValue(-(hangH + 20));
  const cordScale = useTransform(y, (v) => Math.max(0, (cordH + v) / cordH));
  /*
   * 摆动：线绕顶端转的角度 rot，不写关键帧，落地那一下给个角速度让弹簧自己晃出来。
   * 听筒再用一个更软的弹簧跟着线（follow），两者的差就是听筒绕线头"慢半拍"的那点角度。
   */
  const rot = useMotionValue(0);
  const follow = useSpring(rot, { stiffness: 90, damping: 7, mass: 1 });
  const bodyRot = useTransform([rot, follow], ([r, f]: number[]) => (f - r) * 1.6);
  const swing = (velocity: number) => animate(rot, 0, { type: "spring", stiffness: 34, damping: 3, mass: 1, velocity });
  const kicked = useRef(false);
  useMotionValueEvent(y, "change", (v) => {
    /* 第一次落到底（穿过 0）那帧撞出摆动，从这时起可以碰它 */
    if (!kicked.current && v >= -0.5) {
      kicked.current = true;
      swing(KICK);
      setHung(true);
    }
  });

  /* 进场：弹簧放下来；顺手把电话里那句 hello 的录音先解码好 */
  useEffect(() => {
    preloadPhoneHello();
    const c = animate(y, 0, { type: "spring", stiffness: 100, damping: 13, mass: 1.1, delay: HANG_DROP_DELAY });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyEmail = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(contactEmail);
      } else {
        /* 非 https 环境没有 clipboard API：退回选中一段隐藏文字再 execCommand */
        const ta = document.createElement("textarea");
        ta.value = contactEmail;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      at(1400, () => setCopied(false));
    } catch {
      /* 剪贴板不可用时静默失败，用户仍能看到邮箱手动复制 */
    }
  };

  /* hover：像被碰了一下，轻轻晃两下就停 */
  const touch = () => {
    if (!hung || call !== "idle") return;
    swing(KICK * 0.35);
  };

  const pickUp = () => {
    if (!hung || call !== "idle") return;
    playPhonePickup();
    setCall("ring");
    /* 拿起来：还挂在线上，只是被拎得歪过去（围着 PICKED_ROT 抖），线跟着甩一下；嘟声期间跟着线路微微振 */
    swing(-KICK * 0.6);
    const r = -PICKED_ROT;
    void handset.start({
      y: -2,
      rotate: [r + 1, r - 1, r + 2, r - 1, r + 1, r, r + 1],
      transition: {
        y: { duration: 0.28, ease: "easeOut" },
        rotate: { duration: PHONE.ringEnd, ease: "easeInOut", times: [0, 0.2, 0.35, 0.55, 0.7, 0.85, 1] },
      },
    });
    /* 对面出声的同一刻，听筒底下冒出那句话 */
    at(PHONE.helloAt * 1000, () => setCall("hello"));
    const end = (PHONE.helloEnd + BUBBLE_STAY) * 1000;
    at(end, () => {
      void handset.start({ y: 0, rotate: 0, transition: { duration: 0.45, ease: "easeInOut" } });
      swing(KICK * 0.3);
      setCall("idle");
    });
  };

  const headFont = "font-look";
  /* 小标题：英文 DM Sans 800；中文黑体 800 太黑，收到 600 */
  const headWeight = zh ? 600 : 800;
  /* 邮箱、Instagram / RED 都是拉丁字，中文版也用 DM Sans */
  const bodyFont = "font-look";
  const handFont = "font-hand";
  const subW = zh ? SUB.wZh : SUB.w;

  return (
    <div
      className="relative h-screen overflow-hidden select-none"
      style={{ backgroundColor: BG, ...noiseBg("cream", s) }}
    >
      <div
        className="absolute"
        style={{ left: ox, top: oy, width: FW, height: FH, transform: `scale(${s})`, transformOrigin: "0 0" }}
      >
        {/* 信封后片 */}
        <img
          src={`${C}/env-back.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={art(ART.envBack)}
        />

        {/* 信纸：静态摆在封口里，字都写在它上面 */}
        <div className="absolute" style={art(ART.paper)}>
          <img
            src={`${C}/paper.webp`}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full max-w-none"
          />
          {/* 下面的坐标都换成相对信纸框 */}
          <div className="absolute" style={{ left: -ART.paper.x, top: -ART.paper.y, width: FW, height: FH }}>
            {/* Say Hi to WOOLAB */}
            <div
              className={`${headFont} absolute flex items-start justify-center whitespace-nowrap text-black`}
              style={{
                left: 0,
                width: FW,
                top: TITLE.y,
                fontSize: TITLE.size,
                lineHeight: 1.3,
                gap: 5,
                fontWeight: headWeight,
              }}
            >
              <span>{t("contact.hi.pre")}</span>
              <img
                src={`${C}/mark.webp`}
                alt="WOOLAB"
                draggable={false}
                className="block max-w-none"
                style={{ width: MARK.w, height: MARK.h, marginTop: 1.6, mixBlendMode: "multiply" }}
              />
              {t("contact.hi.post") && <span>{t("contact.hi.post")}</span>}
            </div>
            <p
              className={`${handFont} absolute text-center text-black`}
              style={{
                left: CX - subW / 2,
                width: subW,
                top: SUB.y,
                fontSize: SUB.size,
                /* 中文手写体字面大（size-adjust 130%），行距要松一些 */
                lineHeight: zh ? 1.55 : 1.2,
                whiteSpace: "pre-line",
              }}
            >
              {t("contact.sub")}
            </p>

            <Head font={headFont} weight={headWeight} y={WRITE.y}>
              {t("contact.write")}
            </Head>
            <div
              className={`${bodyFont} absolute text-center text-black`}
              style={{ left: 0, width: FW, top: EMAIL.y, fontSize: LINK_SIZE, lineHeight: 1.25 }}
            >
              {/* hover 不加粗下划线，改成手绘圈从左往右把邮箱圈起来；移开就淡掉 */}
              <span
                className="relative inline-block"
                onMouseEnter={() => setEmailHover(true)}
                onMouseLeave={() => setEmailHover(false)}
              >
                <button
                  type="button"
                  onClick={() => void copyEmail()}
                  title={t("contact.copy")}
                  className="cursor-pointer border-0 bg-transparent p-0 underline decoration-solid underline-offset-2"
                  style={{ color: "inherit", font: "inherit", letterSpacing: "inherit" }}
                >
                  {copied ? t("contact.copied") : contactEmail}
                </button>
                <motion.img
                  src={`${C}/circle-email.svg`}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute max-w-none"
                  style={{
                    left: "-11%",
                    width: "122%",
                    top: "52%",
                    aspectRatio: "178 / 38",
                    translateY: "-50%",
                  }}
                  initial={false}
                  animate={
                    emailHover
                      ? { clipPath: "inset(-6px -6px -6px -6px)", opacity: 1 }
                      : { clipPath: "inset(-6px 100% -6px -6px)", opacity: 0 }
                  }
                  transition={
                    emailHover
                      ? { clipPath: { duration: 0.45, ease: "easeOut" }, opacity: { duration: 0 } }
                      : { opacity: { duration: 0.2 }, clipPath: { delay: 0.2, duration: 0 } }
                  }
                />
              </span>
            </div>

            <Head font={headFont} weight={headWeight} y={FIND.y}>
              {t("contact.find")}
            </Head>
            <div
              className={`${bodyFont} absolute text-center text-black`}
              style={{ left: 0, width: FW, top: LINKS.y, fontSize: LINK_SIZE, lineHeight: 1.25 }}
            >
              {socialLinks.map((l, i) => (
                <span key={l.id}>
                  {i > 0 && " / "}
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-solid underline-offset-2 hover:decoration-2"
                  >
                    {l.label}
                  </a>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 信封前片 + 折线 */}
        <img
          src={`${C}/env-front.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={art(ART.envFront)}
        />
        <img
          src={`${C}/fold.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={art(ART.fold)}
        />

        {/* 小羊：抱着腿坐在信封边上，慢慢呼吸 */}
        <motion.img
          src={`${C}/sheep.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{ ...art(ART.sheep), transformOrigin: "50% 100%" }}
          animate={{ scaleY: [1, 1.012, 1] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* 电话线 + 听筒：线顶钉在视口顶边，整组绕它摆；线只竖向拉长，粗细不变。
            这层和整封信一样宽、叠在信上面，自己不能接鼠标，不然邮箱那行点不到（只有听筒接） */}
        <motion.div
          className="pointer-events-none absolute"
          style={{
            left: hangX,
            top: hangTop,
            width: FW,
            height: hangH,
            transformOrigin: `${ART.cord.x + ART.cord.w / 2}px 0px`,
            rotate: rot,
          }}
        >
          <motion.img
            src={`${C}/cord.webp`}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              left: ART.cord.x,
              top: 0,
              width: ART.cord.w,
              height: cordH,
              scaleY: cordScale,
              transformOrigin: "50% 0%",
            }}
          />
          {/* 听筒：位置由 y 定（掉落），绕线头比线慢半拍地晃 */}
          <motion.div
            className="absolute"
            style={{
              left: ART.handset.x,
              top: ART.handset.y - hangTop,
              width: ART.handset.w,
              height: ART.handset.h,
              y,
              rotate: bodyRot,
              transformOrigin: "50% 4%",
            }}
          >
            <motion.button
              type="button"
              aria-label={t("contact.phone")}
              onClick={pickUp}
              onMouseEnter={touch}
              animate={handset}
              className={`pointer-events-auto absolute inset-0 block border-0 bg-transparent p-0 ${hung && call === "idle" ? "cursor-pointer" : "cursor-default"}`}
              style={{ transformOrigin: "50% 4%" }}
            >
              <img src={`${C}/handset.webp`} alt="" draggable={false} className="block h-full w-full max-w-none" />
            </motion.button>
          </motion.div>
        </motion.div>

        {/* 听筒底下的话：和对面那句 hello 同时出现 */}
        <div
          className={`${handFont} pointer-events-none absolute text-center text-black`}
          style={{
            left: BUBBLE.cx + hangX - BUBBLE.w / 2,
            top: BUBBLE.y,
            width: BUBBLE.w,
            fontSize: BUBBLE.size,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
          }}
        >
          <AnimatePresence>
            {call === "hello" && (
              <motion.p
                key="hello"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.4 } }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {t("contact.hello")}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const art = (b: Box) => ({ left: b.x, top: b.y, width: b.w, height: b.h });

/** 信纸上的小标题：Write a Note / Find Us Here Too */
function Head({ font, weight, y, children }: { font: string; weight: number; y: number; children: string }) {
  return (
    <p
      className={`${font} absolute text-center whitespace-nowrap text-black`}
      style={{ left: 0, width: FW, top: y, fontSize: HEAD_SIZE, lineHeight: 1.25, fontWeight: weight }}
    >
      {children}
    </p>
  );
}
