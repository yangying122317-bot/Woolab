import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { lifeStations, type StationId } from "../../data/lifeStations";
import { isAllDone, isListDone } from "../../state/roomState";
import type { RoomState } from "../../state/roomState";
import { useLanguage } from "../../i18n/LanguageContext";

interface Props {
  room: RoomState;
  open: boolean;
  /** 点房间空白处 / Esc：把面板收回去 */
  onClose: () => void;
  /** 点了某一行：房间横移到那个站点（面板顺带收回） */
  onGoStation: (id: StationId) => void;
  /** 四行全划完后"带我过去"：房间横移到门口 */
  onGoDoor: () => void;
  /** 面板完全收回去了（退场动画播完） */
  onClosed?: () => void;
  /** 鼠标进 / 出抽屉：自动收回的倒计时据此暂停 / 继续 */
  onEnter?: () => void;
  onLeave?: () => void;
  /** 在抽屉里点了什么（任何位置）：不再自动收 */
  onInteract?: () => void;
}

const A = "/assets/life/list";

/** 稿子画板尺寸（Figma Frame 30），下面所有坐标都是稿子 px */
const W = 337;
const H = 488;

/**
 * 图都是从 Figma 的矢量按稿子里的旋转 / 翻转栅格化出来的，画布 = 稿子里的外接框四周各多 4px
 * （描边溢出的余量），所以摆的时候左上角往外挪 4、宽高各加 8 就正好对上稿子坐标。
 */
const PAD = 4;
type Pic = { src: string; x: number; y: number; w: number; h: number };
const pic = (src: string, x: number, y: number, w: number, h: number): Pic => ({ src, x, y, w, h });

/** 底下那张纸（All done） */
const SHEET_DONE = pic("sheet-done.webp", 95.5, 125.5, 204, 255);
/** 上面那张纸（Today's List）+ 贴在它左边中间的胶带 + 压着它右上角的胶带 */
const SHEET_LIST = pic("sheet-list.webp", 88.13, 118.5, 199.5, 255);
const TAPE_SHEET = pic("tape-sheet.png", 68.5, 246.62, 38.759, 39.522);
const TAPE_TR = pic("tape-tr.png", 241, 97.16, 46.326, 42.95);
/** 抽屉右下角那条胶带（位置按抽屉的角算，见渲染处；这里只用它的尺寸） */
const TAPE_BR = pic("tape-br.png", 250, 392.5, 46.585, 39.189);
/** "带我过去"：奶油底黑边的框 + 顶上一条胶带 + 右边一支小箭头，字是活的 */
const CTA_BOX = pic("cta-box.webp", 141.76, 286.1, 119.314, 35.467);
const CTA_TAPE = pic("cta-tape.png", 178.12, 278, 36.507, 20.344);
const CTA_ARROW = pic("cta-arrow.png", 238, 298.5, 13.341, 8.266);

/** 虚线 / 编号从这儿起，到这儿止 */
const ROW_X = 110;
const ROW_W = 160.56;
/** 纸上文字的中线（虚线的中点） */
const ROW_CX = ROW_X + ROW_W / 2;

/** 每行的稿子坐标。顺序对应 lifeStations（tee → photo → drink → candle） */
type Row = {
  /** 编号 baseline 盒子的 top */
  numY: number;
  /** 虚线 */
  dotY: number;
  /** 那句话：垂直中线 + 手写的歪一点 */
  textCy: number;
  rotate: number;
  /** 划线导出图（紧边） */
  mark: Pic;
  /** 印章盒子（61.7×56.7，里面 50.2×41.2 的章转 21.45°） */
  stamp: { x: number; y: number };
};

const ROWS: Row[] = [
  {
    numY: 190.65,
    dotY: 200.45,
    textCy: 181,
    rotate: -2.18,
    mark: pic("strike-01.png", 134.5, 197.5, 122.116, 10.553),
    stamp: { x: 196.5, y: 144.5 },
  },
  {
    numY: 237.07,
    dotY: 246.86,
    textCy: 233.9,
    rotate: -2.16,
    mark: pic("strike-02.png", 181.5, 225, 38.821, 24.621),
    stamp: { x: 213.73, y: 200.09 },
  },
  {
    numY: 281.14,
    dotY: 290.94,
    textCy: 278,
    rotate: 0,
    mark: pic("strike-03.png", 134, 284.5, 110.5, 8),
    stamp: { x: 202.06, y: 251.79 },
  },
  {
    numY: 323.12,
    dotY: 332.92,
    textCy: 323.5,
    rotate: 0,
    mark: pic("strike-04.png", 137.62, 309.71, 92.155, 32.659),
    stamp: { x: 211, y: 301 },
  },
];

const STAMP = { w: 50.156, h: 41.175, boxW: 61.738, boxH: 56.663, rotate: 21.45, opacity: 0.3 };

/** 上面那张纸的范围（含胶带）：整行的点击热区 / 揭走动画都以它为单位 */
const ROW_HIT_TOP = [150, 206, 252, 296];

/** 稿子坐标 → 绝对定位 */
function box(x: number, y: number, w?: number, h?: number): CSSProperties {
  return { position: "absolute", left: x, top: y, width: w, height: h };
}
function at(p: Pic, ox = 0, oy = 0): CSSProperties {
  return { ...box(p.x - PAD - ox, p.y - PAD - oy, p.w + PAD * 2, p.h + PAD * 2), maxWidth: "none" };
}

/** 两张纸合起来的中心（稿子坐标）：抽屉里的东西都围着它居中 */
const SHEET_CX = (88.13 + 299.5) / 2;
const SHEET_CY = (118.5 + 380.5) / 2;
/** 纸占屏高的比例 / 抽屉宽占屏高的比例 */
const SHEET_VH = 0.57;
const DRAWER_VH = 0.64;

/**
 * 面板是贴着屏幕左边的通高抽屉：宽 0.64 倍屏高（16:10 的屏上约四成宽），
 * 纸放大到屏高的 57% 居中；屏幕特别窄的时候抽屉最多占一半宽、纸跟着收。
 */
function useScale() {
  const calc = () => {
    const vh = window.innerHeight;
    const dw = Math.min(vh * DRAWER_VH, window.innerWidth * 0.5);
    const k = ((dw / (vh * DRAWER_VH)) * vh * SHEET_VH) / 255;
    return { vh, dw, k };
  };
  const [s, setS] = useState(calc);
  useEffect(() => {
    const on = () => setS(calc());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return s;
}

const PRELOAD = [
  SHEET_DONE.src,
  SHEET_LIST.src,
  TAPE_SHEET.src,
  TAPE_TR.src,
  TAPE_BR.src,
  CTA_BOX.src,
  CTA_TAPE.src,
  CTA_ARROW.src,
  "stamp.webp",
  "kraft-tile.webp",
  "kraft-frame.webp",
  ...ROWS.map((r) => r.mark.src),
];

/**
 * 「今晚的小事」：一格通高的牛皮抽屉从屏幕左边推出来，盖在房间上（房间不动、不压暗）。
 * 抽屉里一张纸写着四行小事，整行可点——点哪行房间就横移到那个站点、面板顺带收回；
 * 做完一件由页面自动推出来：那一行先被一笔划掉，再"啪"地盖上一枚 WOOLAB 章，然后自动收回。
 * 四行全划完：这张纸被揭走，露出底下那张 "All done"，一颗"带我过去"把房间送到门口。
 * 点房间空白处 / Esc 收回。
 */
export default function Checklist({ room, open, onClose, onGoStation, onGoDoor, onClosed, onEnter, onLeave, onInteract }: Props) {
  const { t, pick, lang } = useLanguage();
  const { vh, dw, k } = useScale();
  const hand = lang === "zh";

  /* 面板一挂上就把图取回来解码好，第一次推出来不闪 */
  useEffect(() => {
    const imgs = PRELOAD.map((n) => {
      const im = new Image();
      im.src = `${A}/${n}`;
      im.decode().catch(() => {});
      return im;
    });
    return () => imgs.forEach((im) => (im.src = ""));
  }, []);

  /* Esc 收回 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /*
   * 哪几行是这次打开时刚做完的（要播动画）：和上次看过的对比。
   * 必须在"打开的那一次渲染"里就算好——划线 / 印章的入场只看挂载时的 initial，
   * 放到 effect 里算就晚了一帧。
   */
  const seen = useRef<Set<StationId>>(new Set(lifeStations.filter((s) => isListDone(room, s.id)).map((s) => s.id)));
  const done = lifeStations.filter((s) => isListDone(room, s.id)).map((s) => s.id);
  const [fresh, setFresh] = useState<Set<StationId>>(new Set());
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setFresh(open ? new Set(done.filter((id) => !seen.current.has(id))) : new Set());
  }
  useEffect(() => {
    if (open) seen.current = new Set(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* 四行全划完：刚划完最后一行的那次，等章盖稳再把纸揭走；之后再打开直接就是底下那张 */
  const allDone = isAllDone(room);
  const playDone = allDone && fresh.size > 0;
  const showList = !allDone || playDone;

  const slideOut = -(dw + 48);
  /*
   * 牛皮底素材按 4x 画的（1774 宽 ≈ 443 的稿），抽屉在 900 高的屏上约 576 宽，
   * 折下来素材 1px ≈ 0.325 屏幕 px：边带切片 48（素材 px）→ 1.73vh，1200 的纹理块 → 43.3vh。
   */
  const edge = vh * 0.0173;
  const tile = vh * 0.433;
  /* 稿子坐标系整体缩 k 倍，摆到让两张纸的中心正好落在抽屉正中 */
  const sheetLeft = dw / 2 - SHEET_CX * k;
  const sheetTop = vh / 2 - SHEET_CY * k;

  return (
    <AnimatePresence onExitComplete={onClosed}>
      {open && (
        <div key="checklist" className="absolute inset-0 z-30">
          {/* 透明的挡板：房间照旧亮着，但点它就是收回面板 */}
          <div className="absolute inset-0" onClick={onClose} aria-label={t("close")} />

          {/*
           * 牛皮抽屉：通高、贴左。底是「清单牛皮底」素材——中间挖一块做成无缝平铺的底纹，
           * 四边那圈手绘黑边切成 9 宫格当 border-image（round 重复，不拉伸），
           * 这样不管屏多高多宽，纹理粒度和边的粗细都跟稿子一样。
           * 上、下、左三条边都推到屏外，只露右边那条——上下通栏，不见黑边。
           */}
          <motion.div
            className="absolute overflow-hidden select-none text-black"
            style={{
              left: -edge,
              top: -edge,
              bottom: -edge,
              width: dw + edge * 2,
              border: `${edge}px solid transparent`,
              borderImage: `url(${A}/kraft-frame.webp) 24 / ${edge}px round`,
              background: `url(${A}/kraft-tile.webp) center / ${tile}px ${tile}px repeat, #CC9E57`,
              backgroundClip: "padding-box",
              boxShadow: "6px 0 26px rgba(0,0,0,0.28)",
            }}
            initial={{ x: slideOut }}
            animate={{ x: 0, transition: { type: "spring", stiffness: 210, damping: 27, mass: 1 } }}
            exit={{ x: slideOut, transition: { duration: 0.42, ease: [0.5, 0, 0.75, 0] } }}
            onPointerEnter={onEnter}
            onPointerLeave={onLeave}
            onPointerDownCapture={onInteract}
          >
            {/* 抽屉右下角那条胶带：跟着抽屉的角走，不跟纸 */}
            <img
              src={`${A}/${TAPE_BR.src}`}
              alt=""
              draggable={false}
              className="pointer-events-none absolute"
              style={{
                left: dw * 0.74,
                top: vh * 0.8,
                width: (TAPE_BR.w + PAD * 2) * k,
                height: (TAPE_BR.h + PAD * 2) * k,
                maxWidth: "none",
              }}
            />

            <div
              className="absolute"
              style={{ left: sheetLeft, top: sheetTop, width: W, height: H, transform: `scale(${k})`, transformOrigin: "0 0" }}
            >
              {/* 底下那张纸：All done */}
              <img src={`${A}/${SHEET_DONE.src}`} alt="" draggable={false} style={at(SHEET_DONE)} />
              {allDone && (
                <DoneNote
                  play={playDone}
                  hand={hand}
                  line={t("life.done.line")}
                  hint={t("life.done.hint")}
                  cta={t("life.done.cta")}
                  onGoDoor={onGoDoor}
                />
              )}

              {/* 上面那张纸：今晚的四行小事。全做完的那次被揭走 */}
              {showList && (
                <motion.div
                  className="absolute inset-0"
                  /* 要被揭走的那次，这张纸不再接鼠标：飞走后底下的"带我过去"才点得到 */
                  style={{ transformOrigin: "45% 20%", pointerEvents: playDone ? "none" : undefined }}
                  animate={
                    playDone
                      ? { x: -70, y: -90, rotate: -12, opacity: 0, transition: { delay: 1.7, duration: 0.85, ease: [0.4, 0, 0.3, 1] } }
                      : undefined
                  }
                >
                  <img src={`${A}/${SHEET_LIST.src}`} alt="" draggable={false} style={at(SHEET_LIST)} />

                  <span
                    className="font-look absolute whitespace-nowrap font-bold uppercase"
                    style={{
                      left: 188,
                      top: 137.5,
                      transform: "translateX(-50%)",
                      fontSize: hand ? 13 : 11.5,
                      lineHeight: 1.2,
                      color: "#94541C",
                    }}
                  >
                    {t("life.checklist.title")}
                  </span>

                  {lifeStations.map((s, i) => {
                    const row = ROWS[i];
                    const isDone = isListDone(room, s.id);
                    const play = fresh.has(s.id);
                    const lines = splitTask(pick(s.task), lang);
                    return (
                      <div key={s.id}>
                        {/* 整行可点：不画成按钮，hover 只在字底下出一条细线 */}
                        <button
                          type="button"
                          onClick={() => onGoStation(s.id)}
                          className="group absolute cursor-pointer"
                          style={{ ...box(ROW_X - 6, ROW_HIT_TOP[i], ROW_W + 12, row.dotY + 7 - ROW_HIT_TOP[i]), background: "transparent" }}
                        >
                          <span
                            className="absolute flex items-center justify-center"
                            style={{
                              left: ROW_CX - 80 - (ROW_X - 6),
                              /* 两行的（英文第一条）按稿子的位置；单行的统一贴在虚线上方 */
                              top: (lines.length > 1 ? row.textCy : row.dotY - 13) - 16 - ROW_HIT_TOP[i],
                              width: 160,
                              height: 32,
                            }}
                          >
                            <span
                              className="font-hand relative whitespace-nowrap text-center capitalize"
                              style={{ fontSize: 10, lineHeight: 1.4, transform: `rotate(${row.rotate}deg)` }}
                            >
                              {lines.map((l, j) => (
                                <span key={j} className="block">
                                  {l}
                                </span>
                              ))}
                              <span
                                aria-hidden
                                className="absolute left-0 right-0 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                                style={{ bottom: 0, height: 0.7, background: "rgba(148, 84, 28, 0.75)", borderRadius: 1 }}
                              />
                            </span>
                          </span>
                        </button>
                        <span
                          className="font-look pointer-events-none absolute whitespace-nowrap font-medium"
                          style={{ left: ROW_X, top: row.numY, fontSize: 6.5, lineHeight: 1.2 }}
                        >
                          {`0${i + 1}:`}
                        </span>
                        <svg
                          className="pointer-events-none"
                          style={box(ROW_X, row.dotY - 0.5, ROW_W, 1)}
                          viewBox={`0 0 ${ROW_W} 1`}
                          preserveAspectRatio="none"
                          aria-hidden
                        >
                          <line x1="0" y1="0.5" x2={ROW_W} y2="0.5" stroke="black" strokeWidth="0.6" strokeDasharray="1.6 3.2" />
                        </svg>

                        {/* 第一行是两步（挂好、穿上）：只挂好没穿上时在虚线底下补一句，别让人以为挂了白挂 */}
                        {s.id === "tee" && room.tee && !room.dressed && (
                          <span
                            className="font-hand pointer-events-none absolute whitespace-nowrap"
                            style={{ left: ROW_X + 4, top: row.dotY + 3, fontSize: 7, lineHeight: 1.3, color: "#94541C" }}
                          >
                            {t("life.checklist.teeHalf")}
                          </span>
                        )}

                        {isDone && (
                          <>
                            {/* 划线：刚做完的从左往右擦出来 */}
                            <motion.img
                              src={`${A}/${row.mark.src}`}
                              alt=""
                              draggable={false}
                              className="pointer-events-none"
                              style={at(row.mark)}
                              initial={play ? { clipPath: "inset(-10% 100% -10% 0)" } : false}
                              animate={{ clipPath: "inset(-10% 0% -10% 0)" }}
                              transition={{ duration: 0.45, ease: "easeInOut", delay: 0.4 }}
                            />
                            {/* 印章：划完再"啪"地盖上 */}
                            <motion.div
                              className="pointer-events-none mix-blend-multiply"
                              style={box(
                                row.stamp.x + (STAMP.boxW - STAMP.w) / 2,
                                row.stamp.y + (STAMP.boxH - STAMP.h) / 2,
                                STAMP.w,
                                STAMP.h,
                              )}
                              initial={play ? { opacity: 0, scale: 1.9, rotate: STAMP.rotate - 16 } : false}
                              animate={{ opacity: STAMP.opacity, scale: 1, rotate: STAMP.rotate }}
                              transition={{ type: "spring", stiffness: 520, damping: 20, delay: 0.95 }}
                            >
                              <img src={`${A}/stamp.webp`} alt="" draggable={false} className="h-full w-full" style={{ maxWidth: "none" }} />
                            </motion.div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  <img src={`${A}/${TAPE_SHEET.src}`} alt="" draggable={false} className="pointer-events-none" style={at(TAPE_SHEET)} />
                </motion.div>
              )}

              {/* 纸右上角压着的那条胶带 */}
              <img src={`${A}/${TAPE_TR.src}`} alt="" draggable={false} className="pointer-events-none" style={at(TAPE_TR)} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** 英文两句话（"Hang it up. Put on the white tee."）分两行写；中文一行 */
function splitTask(text: string, lang: string): string[] {
  if (lang !== "en") return [text];
  const m = text.match(/^(.+?[.!?])\s+(.+)$/);
  return m ? [m[1], m[2]] : [text];
}

/**
 * 底下那张纸上的话 + "带我过去"。
 * play：刚划完最后一行、上面那张纸被揭走的那次——等纸走开再一句句擦出来、按钮最后弹上去；否则直接静态。
 */
function DoneNote({
  play,
  hand,
  line,
  hint,
  cta,
  onGoDoor,
}: {
  play: boolean;
  hand: boolean;
  line: string;
  hint: string;
  cta: string;
  onGoDoor: () => void;
}) {
  const wipe = (delay: number) => ({
    initial: play ? { clipPath: "inset(-10% 100% -10% 0)" } : false,
    animate: { clipPath: "inset(-10% 0% -10% 0)" },
    transition: { duration: 0.55, ease: "easeInOut" as const, delay },
  });
  return (
    <>
      <motion.div
        className="font-hand absolute text-center"
        style={{ ...box(197.5 - 98, 178.5, 196), fontSize: hand ? 13.5 : 15, lineHeight: hand ? 1.6 : 1.45 }}
        {...wipe(2.45)}
      >
        <p>{line}</p>
        <p className="whitespace-pre-line">{hint}</p>
      </motion.div>

      <motion.button
        type="button"
        onClick={onGoDoor}
        className="absolute cursor-pointer"
        style={{ ...box(141.76, 278, 123, 45), transformOrigin: "50% 60%" }}
        initial={play ? { opacity: 0, scale: 1.7, rotate: -12, y: 10 } : { opacity: 1, scale: 1, rotate: 0, y: 0 }}
        animate={{ opacity: 1, scale: 1, rotate: 0, y: 0, transition: { type: "spring", stiffness: 420, damping: 22, delay: play ? 3.15 : 0 } }}
        whileHover={{ scale: 1.06, rotate: 1.5 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <img src={`${A}/${CTA_BOX.src}`} alt="" draggable={false} style={at(CTA_BOX, 141.76, 278)} />
        <span
          className="font-look absolute whitespace-nowrap font-bold uppercase"
          style={{
            left: 191.84 - 141.76,
            top: 305.98 - 278,
            transform: "translate(-50%, -50%) rotate(-3.44deg)",
            fontSize: hand ? 12 : 11.5,
            lineHeight: 1.2,
            color: "#94541C",
          }}
        >
          {cta}
        </span>
        <img src={`${A}/${CTA_ARROW.src}`} alt="" draggable={false} style={at(CTA_ARROW, 141.76, 278)} />
        <img src={`${A}/${CTA_TAPE.src}`} alt="" draggable={false} style={at(CTA_TAPE, 141.76, 278)} />
      </motion.button>
    </>
  );
}
