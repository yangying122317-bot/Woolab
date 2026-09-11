import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { aboutShots } from "../data/aboutShots";
import { useLanguage } from "../i18n/LanguageContext";
import { playEject, playPhotoDrop, playShutter } from "../audio/sfx";
import { INTRO_DISMISSED_EVENT, INTRO_SESSION_KEY } from "../components/IntroLoader";
import { config } from "../config";
import { A, CARD_H, CARD_W, FRAME_PAD, WINDOW, box, noiseBg, type Box } from "../components/about/geom";
import MarkedText, { decoDelay } from "../components/about/MarkedText";
import NextPage from "../components/about/NextPage";

/**
 * About 页：一台拍立得。
 * 相机钉在画面上半正中。进页面相机自己先拍一张：相纸从出片口往下推出来（空白）→ 停稳后慢慢显影 →
 * 显影完两边的手写标注一行行冒出来 → 这时才提示「( press )」；按快门，这张相纸松开往下掉出屏幕，下一张紧跟着出来。
 * 一共 aboutShots.length 拍；最后一张出完提示「( scroll )」，往下滚：这张也掉下去，
 * 蓝色的 What's Next 那页（NextPage）从底下翻上来盖住，5 张相纸在那页上叠好。往上滚再翻回来。
 *
 * 整页按 720×450 的稿等比缩放居中，其余用底色补满；下面的坐标全是稿单位。
 */

const FW = 720;
const FH = 450;
const BG = "#F8F9F4";

/* 相机：机身一张图（不含快门），快门单独一层才能按下去 */
const CAMERA: Box = { x: 240, y: 56, w: 240, h: 160 };
const BUTTON: Box = { x: 388, y: 122, w: 60, h: 33 };
const LABEL = { cx: 357.5, y: 81.5 };
/** 机身底边：相纸只在这条线以下可见，上面的都藏在机身后 */
const MOUTH_Y = 192;
/* 相纸：落定位置（尺寸见 geom） */
const PHOTO: Box = { x: 264, y: 203.5, w: CARD_W, h: CARD_H };
/** 小羊水印（mark.webp 396×372）：相机正下方，横向和机身对中，垫在相纸后面 */
const MARK = { cx: CAMERA.x + CAMERA.w / 2, y: 214, w: 170, h: 160 };

/* 标注 */
const NOTE_L = { cx: 157.95, y: 282.5, w: 166 };
const NOTE_R = { cx: 570, y: 245.5, w: 150 };
/** 标注一行的高度（12 号字 × 1.3 行高） */
const NOTE_LH = 12 * 1.3;
const ARROW_L: Box = { x: 185, y: 236, w: 42, h: 33 };
const ARROW_R: Box = { x: 497, y: 290, w: 38, h: 40 };

/** 底部序号 / 小标题：左右贴屏幕边，和顶栏 logo / 喇叭同一条边距（25 稿单位） */
const FOOT = { y: 405, inset: 25 };

/* 节拍（秒） */
/** 进页面后多久相机自己拍第一张 */
const AUTO_AT = 1.0;
/** 标注出完后多久开始提示（快门闪 / ( scroll )） */
const HINT_AT = 2.0;
const EJECT_T = 1.0;
const DEVELOP_T = 2.2;
/** 显影开始后多久标注出来 */
const NOTES_AT = 1.45;
const DROP_T = 0.95;
/** 落下开始后多久下一张开始出 */
const NEXT_AT = 0.25;

/** done：最后一张也掉下去了，相机空着（翻到 What's Next 之后 / 翻回来） */
type Phase = "idle" | "eject" | "develop" | "ready" | "drop" | "done";
/** 翻页前先让最后一张掉一会儿 */
const FLIP_AT = 0.3;
/** 「( scroll )」提示离屏幕底边多远（稿单位） */
const SCROLL_HINT_BOTTOM = 14;

export default function AboutPage() {
  const { lang, pick } = useLanguage();
  const [vp, setVp] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pressed, setPressed] = useState(false);
  const [touched, setTouched] = useState(false);
  const shake = useAnimationControls();
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

  /* 后面几拍的照片先取回来解码好，出片时不闪 */
  useEffect(() => {
    const imgs = aboutShots.map((s) => {
      const im = new Image();
      im.src = s.photo;
      im.decode().catch(() => {});
      return im;
    });
    return () => imgs.forEach((im) => (im.src = ""));
  }, []);

  const s = Math.min(vp.w / FW, vp.h / FH);
  const ox = (vp.w - FW * s) / 2;
  const oy = (vp.h - FH * s) / 2;
  /** 相纸要掉到屏幕底下看不见为止（稿单位） */
  const dropTo = (vp.h - oy) / s - PHOTO.y + 80;
  /** 底部序号 / 小标题贴着屏幕底边（比稿高的窄屏上别浮在半空），离底边和稿里一样远 */
  const footY = (vp.h - oy) / s - (FH - FOOT.y);

  const shot = aboutShots[idx];
  const last = idx === aboutShots.length - 1;
  const busy = phase === "idle" || phase === "eject" || phase === "develop" || phase === "drop";
  const canPress = !busy && !(phase === "ready" && last);

  /** 快门动作本身：按下去、机身抖一下、出声 */
  const click = () => {
    playShutter();
    setPressed(true);
    at(140, () => setPressed(false));
    void shake.start({
      y: [0, 1.8, -1.2, 0.4, 0],
      transition: { duration: 0.26, ease: "easeOut" },
    });
  };

  /* 进页面先自己拍一张：第一张是这页的开场，看完才提示可以按。站点开屏还在的话等它结束再拍 */
  useEffect(() => {
    let t = 0;
    const shoot = () => {
      t = window.setTimeout(() => {
        click();
        setPhase("eject");
        at(120, () => playEject(EJECT_T));
      }, AUTO_AT * 1000);
    };
    const introUp = config.introEnabled && !sessionStorage.getItem(INTRO_SESSION_KEY);
    if (introUp) window.addEventListener(INTRO_DISMISSED_EVENT, shoot, { once: true });
    else shoot();
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(INTRO_DISMISSED_EVENT, shoot);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const press = () => {
    if (!canPress) return;
    setTouched(true);
    click();
    /* ready：这张松开往下掉，下一张紧跟着出 */
    setPhase("drop");
    playPhotoDrop();
    at(NEXT_AT * 1000, () => {
      setIdx((i) => i + 1);
      setPhase("eject");
      playEject(EJECT_T);
    });
  };

  const onEjected = () => {
    setPhase("develop");
    at(NOTES_AT * 1000, () => setPhase("ready"));
  };

  /* 最后一张出完 → 往下滚翻到 What's Next；翻回来之后相机是空的，再往下滚还能再翻 */
  const [flipped, setFlipped] = useState(false);
  const flipReady = !flipped && ((phase === "ready" && last) || phase === "done");
  const flipReadyRef = useRef(false);
  flipReadyRef.current = flipReady;
  const flip = () => {
    if (!flipReadyRef.current) return;
    flipReadyRef.current = false;
    if (phase === "ready") {
      /* 这张也松开掉下去，掉了一会儿蓝页再上来 */
      setPhase("drop");
      playPhotoDrop();
      at(FLIP_AT * 1000, () => {
        setFlipped(true);
        setPhase("done");
      });
    } else {
      setFlipped(true);
    }
  };
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 24) flip();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") flip();
    };
    let ty = 0;
    const onTs = (e: TouchEvent) => (ty = e.touches[0].clientY);
    const onTe = (e: TouchEvent) => {
      if (ty - e.changedTouches[0].clientY > 60) flip();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTs, { passive: true });
    window.addEventListener("touchend", onTe);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTs);
      window.removeEventListener("touchend", onTe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, last, flipped]);

  const showNotes = phase === "ready";
  /* 快门闪烁提示：第一张出完可以按了、还没按过 */
  const blink = !touched && phase === "ready" && !last;
  const [hoverBtn, setHoverBtn] = useState(false);
  /* 最后一张的标注出完再提示可以滚 */
  const scrollHintAt = phase === "done" ? 0.6 : HINT_AT;

  return (
    <div
      className="relative h-screen overflow-hidden select-none"
      style={{ backgroundColor: BG, ...noiseBg("cream", s) }}
    >
      <div
        className="absolute"
        style={{
          left: ox,
          top: oy,
          width: FW,
          height: FH,
          transform: `scale(${s})`,
          transformOrigin: "0 0",
        }}
      >
        {/* 小羊水印：一直待在相机正下方，相纸出来时压在它上面 */}
        <img
          src={`${A}/mark.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{ left: MARK.cx - MARK.w / 2, top: MARK.y, width: MARK.w, height: MARK.h }}
        />

        {/* 相纸层：机身底边以下才看得见；往下不封口，让它掉出屏幕 */}
        <div className="absolute overflow-hidden" style={{ left: 0, top: MOUTH_Y, width: FW, height: 4000 }}>
          <AnimatePresence>
            {(phase === "eject" || phase === "develop" || phase === "ready") && (
              <Polaroid
                key={shot.id}
                photo={shot.photo}
                developed={phase === "develop" || phase === "ready"}
                dropTo={dropTo}
                onEjected={onEjected}
              />
            )}
          </AnimatePresence>
        </div>

        {/* 相机：机身 + 快门 + 铭牌 */}
        <motion.div className="absolute inset-0 pointer-events-none" animate={shake}>
          <img src={`${A}/camera.webp`} alt="" draggable={false} className="max-w-none" style={box(CAMERA)} />
          <span
            className="font-nav absolute whitespace-nowrap font-extrabold"
            style={{
              left: LABEL.cx,
              top: LABEL.y,
              transform: "translateX(-50%)",
              fontSize: 16,
              lineHeight: 1.2,
              color: "#56504D",
              textTransform: "none",
            }}
          >
            About WOOLAB
          </span>
          <motion.button
            type="button"
            aria-label="shutter"
            onClick={press}
            className={`pointer-events-auto absolute block p-0 ${canPress ? "cursor-pointer" : "cursor-default"}`}
            style={{ ...box(BUTTON), background: "transparent", border: 0 }}
            animate={{ y: pressed ? 2.2 : 0, scale: pressed ? 0.95 : 1 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            {/* 提示按快门：第一张自己出完、标注也出完之后整颗键一亮一暗，按过一次就不再闪 */}
            <motion.img
              src={`${A}/button.webp`}
              alt=""
              draggable={false}
              className="block h-full w-full max-w-none"
              animate={
                blink
                  ? { filter: ["brightness(1)", "brightness(1.45)", "brightness(1)"] }
                  : { filter: canPress && hoverBtn ? "brightness(1.12)" : "brightness(1)" }
              }
              transition={
                blink
                  ? { duration: 1.1, delay: HINT_AT, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.15, ease: "easeOut" }
              }
              onHoverStart={() => setHoverBtn(true)}
              onHoverEnd={() => setHoverBtn(false)}
            />
          </motion.button>
        </motion.div>

        {/* 两边的手写标注：显影完擦出来，落纸时淡掉 */}
        <AnimatePresence>
          {showNotes && (
            <motion.div
              key={`notes-${shot.id}`}
              className="pointer-events-none absolute inset-0"
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
            >
              <Note
                text={pick(shot.note.left)}
                cx={NOTE_L.cx}
                y={NOTE_L.y}
                w={NOTE_L.w}
                hand="font-hand"
                arrow={{ src: `${A}/arrow-l.png`, box: ARROW_L, from: "left" }}
                delay={0}
              />
              {/* 右边标注下面压着箭头：稿是 3 行，多出来的行往上长，别盖到箭头 */}
              <Note
                text={pick(shot.note.right)}
                cx={NOTE_R.cx}
                y={NOTE_R.y - Math.max(0, pick(shot.note.right).split("\n").length - 3) * NOTE_LH}
                w={NOTE_R.w}
                hand="font-hand"
                arrow={{ src: `${A}/arrow-r.png`, box: ARROW_R, from: "right" }}
                delay={0.35}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 底部：序号 / 小标题，跟着当前这拍换 */}
        <AnimatePresence mode="wait">
          <motion.span
            key={`n-${idx}`}
            className="font-look absolute whitespace-nowrap"
            style={{
              left: FOOT.inset - ox / s,
              top: footY,
              fontSize: 12,
              lineHeight: 1.2,
              color: "#111",
            }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            {String(idx + 1).padStart(2, "0")}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.span
            key={`t-${idx}-${lang}`}
            className="font-look absolute whitespace-nowrap"
            style={{
              right: FOOT.inset - ox / s,
              top: footY,
              fontSize: 12,
              lineHeight: 1.2,
              color: "#111",
            }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            {pick(shot.title)}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* 最后一张出完：屏幕底部正中「( scroll )」+ 一支往下点的手绘小箭头（贴屏幕底边，不跟稿走） */}
      <AnimatePresence>
        {flipReady && (
          <motion.div
            key="scroll-hint"
            className="pointer-events-none absolute inset-x-0 flex flex-col items-center"
            style={{ bottom: SCROLL_HINT_BOTTOM * s, gap: 2 * s }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ delay: scrollHintAt, duration: 0.5 }}
          >
            <span className="font-hand whitespace-nowrap" style={{ fontSize: 11 * s, color: "#8B8680" }}>
              ( scroll )
            </span>
            <motion.div
              style={{
                width: 11 * s,
                height: 14.5 * s,
                background: "#8B8680",
                WebkitMaskImage: "url(/assets/lab/scroll-arrow.svg)",
                maskImage: "url(/assets/lab/scroll-arrow.svg)",
                WebkitMaskSize: "100% 100%",
                maskSize: "100% 100%",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
              }}
              animate={{ y: [0, 3 * s, 0], opacity: [1, 0.55, 1] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 翻过去的 What's Next：蓝页盖在相机页上；退回去之后卸掉 */}
      {flipped && <NextPage vp={vp} shots={aboutShots} onBack={() => setFlipped(false)} />}
    </div>
  );
}

/* ---------------- 一张相纸 ---------------- */

const FILTER_BLANK = "brightness(2.1) contrast(0.45) saturate(0) blur(3px)";
const FILTER_CLEAR = "brightness(1) contrast(1) saturate(1) blur(0px)";

function Polaroid({
  photo,
  developed,
  dropTo,
  onEjected,
}: {
  photo: string;
  /** 开始显影 */
  developed: boolean;
  /** 掉到哪（相对落定位置，稿单位） */
  dropTo: number;
  onEjected: () => void;
}) {
  /* 相纸层的原点在 MOUTH_Y，这里的 top 要减掉 */
  const restTop = PHOTO.y - MOUTH_Y;
  /* 起点：整张藏在机身后（底边贴着出片口） */
  const hidden = -PHOTO.h - 2 - restTop;
  return (
    <motion.div
      className="absolute"
      style={{
        left: PHOTO.x,
        top: restTop,
        width: PHOTO.w,
        height: PHOTO.h,
        transformOrigin: "50% 0%",
      }}
      initial={{ y: hidden, x: 0, rotate: 0 }}
      animate={{
        y: 0,
        transition: { duration: EJECT_T, ease: [0.35, 0, 0.2, 1] },
      }}
      exit={{
        y: dropTo,
        x: 22,
        rotate: 9,
        transition: { duration: DROP_T, ease: [0.5, 0, 0.85, 0.55] },
      }}
      onAnimationComplete={(def) => {
        if (typeof def === "object" && def && "y" in def && (def as { y: number }).y === 0) onEjected();
      }}
    >
      {/* 照片窗口：空白相纸 → 慢慢显出来 */}
      <div className="absolute overflow-hidden" style={{ ...box(WINDOW), background: "#F3F1EA" }}>
        <motion.img
          src={photo}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full max-w-none object-cover"
          initial={{ filter: FILTER_BLANK, opacity: 0.35 }}
          animate={
            developed
              ? {
                  filter: FILTER_CLEAR,
                  opacity: 1,
                  transition: { duration: DEVELOP_T, ease: [0.3, 0, 0.3, 1] },
                }
              : { filter: FILTER_BLANK, opacity: 0.35 }
          }
        />
      </div>
      {/* 相纸本体（描边溢出四周各 4） */}
      <img
        src={`${A}/frame.webp`}
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none"
        style={{
          left: -FRAME_PAD,
          top: -FRAME_PAD,
          width: PHOTO.w + FRAME_PAD * 2,
          height: PHOTO.h + FRAME_PAD * 2,
        }}
      />
    </motion.div>
  );
}

/* ---------------- 一条手写标注 ---------------- */

/** 一条标注 = 手写字（MarkedText）+ 一支指向相纸的手绘箭头；箭头等字和圈都出完再擦出来，出来后不动 */
function Note({
  text,
  cx,
  y,
  w,
  hand,
  arrow,
  delay,
}: {
  text: string;
  cx: number;
  y: number;
  w: number;
  hand: string;
  arrow: { src: string; box: Box; from: "left" | "right" };
  delay: number;
}) {
  const decoAt = decoDelay(text, delay);
  const arrowWipe = {
    hidden: {
      clipPath: arrow.from === "left" ? "inset(-6px 100% -6px -6px)" : "inset(-6px -6px -6px 100%)",
    },
    shown: { clipPath: "inset(-6px -6px -6px -6px)" },
  };

  return (
    <>
      <MarkedText
        text={text}
        cx={cx}
        y={y}
        w={w}
        className={hand}
        fontSize={12}
        color="#111"
        tone="dark"
        delay={delay}
      />
      <motion.div
        className="absolute"
        style={box(arrow.box)}
        initial={arrowWipe.hidden}
        animate={arrowWipe.shown}
        transition={{ duration: 0.45, delay: decoAt + 0.2, ease: "easeOut" }}
      >
        <img src={arrow.src} alt="" draggable={false} className="block h-full w-full max-w-none" />
      </motion.div>
    </>
  );
}
