import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import Checklist from "../components/life/Checklist";
import HandHint from "../components/life/HandHint";
import { INTRO_DISMISSED_EVENT, INTRO_SESSION_KEY } from "../components/IntroLoader";
import { config } from "../config";
import RoomStage, { type PaintPhase } from "../components/life/RoomStage";
import { useIdle } from "../components/life/useIdle";
import StationFocus from "../components/life/StationFocus";
import { LAB_DOOR, ROOM_TOTAL_VH, lifeStations, type StationId } from "../data/lifeStations";
import type { LifeStation } from "../data/lifeStations";
import { useLenis } from "lenis/react";
import { useReportPlainLogo } from "../state/chrome";
import { seg01Layers } from "../data/seg01Layers";
import { DEFAULT_ROOM, isAllDone, isListDone, isStationDone, loadRoomState, saveRoomState } from "../state/roomState";
import type { DrinkChoice, RoomState } from "../state/roomState";
import { playNavigate } from "../audio/sfx";
import { useLanguage } from "../i18n/LanguageContext";

const photoStation = lifeStations.find((s) => s.id === "photo")!;
/** 第一次进门的引导只演一次 */
const GUIDE_KEY = "woolab-life-guided";

/**
 * 小羊的生活：横向滚动的房间剖面（交互原型骨架）。
 *
 * 三种页面状态：
 * - 漫游：纵向滚动驱动长卷横移，站点呼吸提示；
 * - 专注：点击站点 → 镜头推近 + 锁滚动 → 占位互动 → 完成后拉回并盖章；
 * - 入夜：四件小事集齐 → 夜色淡入 + 一句话 + 尽头 LAB 门亮起。
 *
 * 完成痕迹存 localStorage（见 src/state/roomState.ts），下次进来还在。
 */
export default function LifePage() {
  const { t, pick, lang } = useLanguage();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: scrollRef });

  // 长卷宽度按素材比例用 vh 定义，横移距离 =长卷实宽 - 视口宽，
  // 需要换算成像素（随窗口尺寸变化更新）
  const [maxShift, setMaxShift] = useState(0);
  useEffect(() => {
    const update = () => {
      const stripW = (ROOM_TOTAL_VH / 100) * window.innerHeight;
      setMaxShift(Math.max(0, stripW - window.innerWidth));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 末尾留 8% 进度作"到站缓冲"
  const x = useTransform(scrollYProgress, [0, 0.92, 1], [0, -maxShift, -maxShift]);

  /* ---------------- 房间状态（持久化） ---------------- */
  // 带 ?reset 打开时清空进度（连第一次进门的引导也重演），方便从头体验一遍
  const [room, setRoom] = useState<RoomState>(() => {
    if (new URLSearchParams(window.location.search).has("reset")) {
      window.history.replaceState(null, "", window.location.pathname);
      localStorage.removeItem(GUIDE_KEY);
      return { ...DEFAULT_ROOM };
    }
    return loadRoomState();
  });
  useEffect(() => {
    saveRoomState(room);
  }, [room]);

  /* ---------------- 专注态（镜头推近） ---------------- */
  const [focus, setFocus] = useState<LifeStation | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const zoomControls = useAnimationControls();

  /* ---------------- 清单 ---------------- */
  const [checklistOpen, setChecklistOpen] = useState(false);
  const collapseTimer = useRef<number | undefined>(undefined);
  /** 专注态里刚完成了一项，拉回后要弹清单盖章 */
  const pendingStamp = useRef(false);
  /** 作画动画阶段：拼图完成 → wait（拉回中）→ play（原位作画）→ idle */
  const [paint, setPaint] = useState<PaintPhase>("idle");

  const openChecklist = () => {
    window.clearTimeout(collapseTimer.current);
    setChecklistOpen(true);
  };
  const closeChecklist = () => {
    window.clearTimeout(collapseTimer.current);
    setChecklistOpen(false);
  };

  /*
   * 清单面板是从屏幕左边推出来盖在房间上的；开着的时候滚轮锁住（房间别在后面自己跑）。
   * listKick：面板收回去那一刻，墙上挂着的那张清单荡两下，提醒"它就住在这儿"。
   * 第一次进门那次收回去之后，再补一支箭头指着墙上那张。
   */
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    if (checklistOpen) lenis.stop();
    else lenis.start();
  }, [checklistOpen, lenis]);
  /* 抽屉是牛皮色、顶到屏幕顶，压着左上角的 logo：开着时 logo 画成纯白 */
  useReportPlainLogo(checklistOpen);
  const [listKick, setListKick] = useState(0);
  const guideHint = useRef(false);
  const hintTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  const onListClosed = () => {
    setListKick((n) => n + 1);
    if (guideHint.current) {
      guideHint.current = false;
      setEntryHint(true);
      hintTimer.current = window.setTimeout(() => setEntryHint(false), 2600);
    }
  };

  /** 房间横移到某个横向位置（长卷里的 vh 坐标居中到画面中央），走 Lenis 的缓动 */
  const scrollRoomTo = (centerVh: number) => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const el = scrollRef.current;
    if (!el) return;
    const shift = Math.min(Math.max((centerVh / 100) * vh - vw / 2, 0), maxShift);
    const progress = maxShift > 0 ? (shift / maxShift) * 0.92 : 0;
    const y = progress * (el.offsetHeight - vh);
    if (lenis) {
      lenis.start();
      lenis.scrollTo(y, { duration: 1.5, easing: (p: number) => 1 - Math.pow(1 - p, 3), force: true });
    } else {
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };
  /** 点了清单上某一行：面板收回，房间滑到那个站点 */
  const goStation = (id: StationId) => {
    const s = lifeStations.find((st) => st.id === id);
    if (!s) return;
    closeChecklist();
    scrollRoomTo(s.left + s.width / 2);
  };
  /** 清单底下"带我过去"：面板收回，房间滑到门口 */
  const goDoor = () => {
    closeChecklist();
    scrollRoomTo(LAB_DOOR.left + LAB_DOOR.width / 2);
  };

  // 墙上的清单滚出画面后，屏幕左边缘露出一角牛皮板当入口
  const listLayer = seg01Layers.find((l) => l.src === "list")!;
  const [miniList, setMiniList] = useState(false);
  /** 画面右边缘在长卷里的位置（vh），判断右边还有没有没做的事 */
  const [viewRight, setViewRight] = useState(() => (window.innerWidth / window.innerHeight) * 100);
  useMotionValueEvent(x, "change", (v) => {
    const listRightPx = ((listLayer.x + listLayer.w) / 18 / 100) * window.innerHeight;
    setMiniList(-v > listRightPx);
    setViewRight(((-v + window.innerWidth) / window.innerHeight) * 100);
  });

  /* ---------------- 引导 ---------------- */
  /**
   * 第一次进门：进场淡入完，清单面板从左边推出来让人看几秒（四件小事）→ 自己收回去、墙上那张荡两下 →
   * 一支手绘箭头指着它"今晚的清单住在这儿"。之后靠"停下来就出箭头"的站点引导接力。
   * 只演一次（localStorage 记着）；老访客有进度的也不演。
   */
  const [entryHint, setEntryHint] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(GUIDE_KEY)) return;
    if (lifeStations.some((s) => isStationDone(room, s.id))) {
      localStorage.setItem(GUIDE_KEY, "1");
      return;
    }
    let t1: number | undefined;
    let t2: number | undefined;
    const start = () => {
      t1 = window.setTimeout(() => {
        guideHint.current = true;
        setChecklistOpen(true);
        localStorage.setItem(GUIDE_KEY, "1");
      }, 1200);
      t2 = window.setTimeout(() => setChecklistOpen(false), 1200 + 3600);
    };
    /* 开屏动画还盖着的话，等它散了再开始计时 */
    const introUp = config.introEnabled && !sessionStorage.getItem(INTRO_SESSION_KEY);
    const onIntroDone = () => window.setTimeout(start, 600);
    if (introUp) window.addEventListener(INTRO_DISMISSED_EVENT, onIntroDone, { once: true });
    else start();
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener(INTRO_DISMISSED_EVENT, onIntroDone);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 隐藏原生滚动条（底部进度条代替）；离开页面时恢复滚动锁
  useEffect(() => {
    document.documentElement.classList.add("scrollbar-hidden");
    return () => {
      document.documentElement.classList.remove("scrollbar-hidden");
      document.documentElement.style.overflow = "";
      window.clearTimeout(collapseTimer.current);
    };
  }, []);

  // 最后一件做完弹出的那次清单不自动收：底下要浮出"你和 Meelo 是朋友了"和去 Lab 的入口
  useEffect(() => {
    if (checklistOpen && isAllDone(room)) window.clearTimeout(collapseTimer.current);
  }, [checklistOpen, room]);

  /** 点击站点：镜头以站点为原点推近，锁住滚动 */
  const openStation = (station: LifeStation, el: HTMLElement) => {
    if (focus) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    setZoomOrigin(`${cx - wr.left}px ${cy - wr.top}px`);
    document.documentElement.style.overflow = "hidden";
    setFocus(station);
    void zoomControls.start({
      scale: 2,
      x: window.innerWidth / 2 - cx,
      y: window.innerHeight / 2 - cy,
      transition: { duration: 0.6, ease: [0.33, 1, 0.68, 1] },
    });
  };

  /** 走进 LAB 门：镜头推进门洞 + 暖光漫满 → 跳转 /lab（Lab 页从同色暖光淡出） */
  const navigate = useNavigate();
  /* 从目录吊牌跳进来：整页是被拉上来的，那本身就是过场，不再叠自己的白光进场 */
  const fromMenu = (useLocation().state as { from?: string } | null)?.from === "menu";
  const [labEntry, setLabEntry] = useState<{ cx: number; cy: number } | null>(null);
  const labGoTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(labGoTimer.current), []);
  const goLab = (cx: number, cy: number, scale: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    setZoomOrigin(`${cx - wr.left}px ${cy - wr.top}px`);
    document.documentElement.style.overflow = "hidden";
    setLabEntry({ cx, cy });
    void zoomControls.start({
      scale,
      x: window.innerWidth / 2 - cx,
      y: window.innerHeight / 2 - cy,
      transition: { duration: 1.15, ease: [0.55, 0, 0.68, 0.4] },
    });
    labGoTimer.current = window.setTimeout(() => {
      playNavigate();
      navigate("/lab");
    }, 1300);
  };
  const enterLab = (r: DOMRect) => {
    if (focus || labEntry) return;
    // 推进目标是门后的黄色门洞：开门后洞口在门框热区的左缘
    goLab(r.left + r.width * 0.1, r.top + r.height * 0.5, 3);
  };
  /** 退出专注态：镜头拉回；若刚完成一项，弹开清单盖章 */
  const closeFocus = async () => {
    setFocus(null);
    await zoomControls.start({
      scale: 1,
      x: 0,
      y: 0,
      transition: { duration: 0.55, ease: [0.33, 1, 0.68, 1] },
    });
    document.documentElement.style.overflow = "";
    if (pendingStamp.current) {
      pendingStamp.current = false;
      setChecklistOpen(true);
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = window.setTimeout(() => setChecklistOpen(false), 2800);
    }
  };

  /** 占位互动完成：写入房间状态（真互动接入后调用同一入口） */
  const completeStation = (choice?: DrinkChoice) => {
    if (!focus) return;
    playNavigate();
    pendingStamp.current = true;
    const id = focus.id;
    setRoom((r) => {
      switch (id) {
        case "tee":
          return { ...r, tee: true };
        case "photo":
          return { ...r, photo: true };
        case "drink":
          return { ...r, drink: choice ?? "a" };
        case "candle":
          return { ...r, candle: true };
      }
    });
  };

  /** 拼图进行中：推近软木板但没有面板，互动就在画面里 */
  const photoFocus = focus?.id === "photo" && !isStationDone(room, "photo");

  /** 调酒进行中：推近白圆桌但没有面板，互动就在画面里 */
  const drinkFocus = focus?.id === "drink" && !isStationDone(room, "drink");
  /** 点蜡烛进行中：推近蜡烛角但没有面板，互动就在画面里 */
  const candleFocus = focus?.id === "candle" && !isStationDone(room, "candle");
  /** 场景内互动的专注态（底部只留提示句 + 先离开） */
  const sceneFocus = photoFocus ? photoStation : drinkFocus || candleFocus ? focus : null;

  /** 拼图完成（化形动画播完）：镜头拉回 → 画家小羊原位播作画动画 → 播完盖章 */
  const completePhoto = () => {
    playNavigate();
    setRoom((r) => ({ ...r, photo: true }));
    setPaint("wait");
    void closeFocus().then(() => setPaint("play"));
  };

  /** 作画动画播完：定格 + 弹清单盖章 */
  const finishPaint = () => {
    setPaint("idle");
    window.clearTimeout(collapseTimer.current);
    setChecklistOpen(true);
    collapseTimer.current = window.setTimeout(() => setChecklistOpen(false), 2800);
  };

  /** 调酒完成（名字浮现后）：盖章 + 镜头拉回 + 弹清单 */
  const completeDrink = (choice: DrinkChoice) => {
    playNavigate();
    pendingStamp.current = true;
    setRoom((r) => ({ ...r, drink: choice }));
    void closeFocus();
  };

  /** 点蜡烛完成（白蜡烛回正后）：盖章 + 镜头拉回 + 弹清单 */
  const completeCandle = () => {
    playNavigate();
    pendingStamp.current = true;
    setRoom((r) => ({ ...r, candle: true }));
    void closeFocus();
  };

  /** 六件衣服挂好（场景内直接完成，不经过专注态）：先只记状态，白T变成可拖给小羊 */
  const completeTee = () => {
    playNavigate();
    setRoom((r) => ({ ...r, tee: true }));
  };

  /** 换装动画播完：这一项才算做完 → 弹清单划线盖章 */
  const completeDress = () => {
    setRoom((r) => ({ ...r, dressed: true }));
    window.clearTimeout(collapseTimer.current);
    setChecklistOpen(true);
    collapseTimer.current = window.setTimeout(() => setChecklistOpen(false), 2800);
  };

  /* 站点引导 / 往右走：都要用户停下来才出，正在专注 / 看清单 / 进 LAB 时不出 */
  const calm = !focus && !checklistOpen && !labEntry && !entryHint;
  const idle = useIdle(1500, calm);
  const idleLong = useIdle(6000, calm);
  /** 右边还有没做完的事，且用户停了一会儿没往右走 → 右下角提示往右走 */
  const moreRight = lifeStations.some((s) => !isListDone(room, s.id) && s.left > viewRight);
  const scrollCue = idleLong && moreRight;

  return (
    <div ref={scrollRef} className="relative" style={{ height: `${Math.round(ROOM_TOTAL_VH * 0.9)}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* 镜头层：专注态时以站点为原点推近 */}
        <motion.div
          ref={wrapRef}
          className="absolute inset-0"
          animate={zoomControls}
          style={{ transformOrigin: zoomOrigin }}
        >
          {/* 房间长卷：滚动驱动横移 */}
          <motion.div className="relative h-full" style={{ x, width: `${ROOM_TOTAL_VH}vh` }}>
            {/* 画稿下缘的蓝地板延伸：镜头推近时底部不露白 */}
            <div className="absolute left-0 w-full" style={{ top: "100%", height: "60vh", background: "#43A0CC" }} />
            <RoomStage
              room={room}
              interactive={!focus}
              guide={{ entry: entryHint && !checklistOpen, idle }}
              onOpen={openStation}
              onChecklist={openChecklist}
              listKick={listKick}
              onTeeDone={completeTee}
              photoActive={photoFocus}
              onPhotoDone={completePhoto}
              drinkActive={focus?.id === "drink"}
              onDrinkDone={completeDrink}
              candleActive={focus?.id === "candle"}
              onCandleDone={completeCandle}
              onDressed={completeDress}
              paint={paint}
              onPaintEnd={finishPaint}
              onEnterLab={enterLab}
            />
          </motion.div>
        </motion.div>

        {/* 走进 LAB：门后的暖光从门洞漫满全屏，盖住切页瞬间 */}
        {labEntry && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50"
            style={{
              background: `radial-gradient(circle at ${labEntry.cx}px ${labEntry.cy}px, #FFE9B8 0%, #FBE3AC 55%, #F2EDE3 100%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.65, ease: "easeIn" }}
          />
        )}

        {/* 底部进度条 */}
        <div className="absolute inset-x-0 bottom-5 z-20 mx-auto w-40 rounded-full bg-black/10">
          <motion.div
            className="h-1.5 rounded-full bg-neutral-700/70"
            style={{ scaleX: scrollYProgress, transformOrigin: "0 50%" }}
          />
        </div>

        {/* 往右走：停了一会儿、右边还有没做的事 → 右下角一支手绘箭头（有小清单时让到它上面） */}
        <div className="pointer-events-none absolute z-20" style={{ right: "3vh", bottom: miniList ? "17vh" : "5vh" }}>
          <HandHint
            show={scrollCue}
            text={t("life.guide.scroll")}
            rotate={90}
            textSide="left"
            arrowH="6vh"
            fontSize="2.4vh"
            tag
            style={{ right: 0, bottom: 0 }}
          />
        </div>

        {/* 墙上的清单不在画面里时，屏幕左边缘露出一角牛皮板当入口（面板就是从这儿推出来的） */}
        <AnimatePresence>
          {miniList && !checklistOpen && !focus && (
            <motion.button
              key="list-tab"
              onClick={openChecklist}
              aria-label={t("life.checklist.title")}
              initial={{ x: -48 }}
              animate={{ x: 0 }}
              exit={{ x: -48 }}
              whileHover={{ x: 3 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="absolute left-0 top-1/2 z-20 flex -translate-y-1/2 cursor-pointer items-center justify-center"
              style={{
                width: "3.4vh",
                height: "15vh",
                marginLeft: -2,
                background: "#CC9E57",
                border: "1.5px solid #000",
                borderRadius: "0 2px 2px 0",
                boxShadow: "3px 0 12px rgba(0,0,0,0.22)",
              }}
            >
              <span
                className={`${lang === "zh" ? "font-hand" : "font-look"} whitespace-nowrap font-bold uppercase`}
                style={{ writingMode: "vertical-rl", fontSize: "1.45vh", letterSpacing: "0.08em", color: "#94541C" }}
              >
                {t("life.checklist.title")}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* 今晚的小事清单：从左边推出来的牛皮板（入口是墙上挂着的清单 / 左边缘那一角） */}
        <Checklist
          room={room}
          open={checklistOpen}
          onClose={closeChecklist}
          onGoStation={goStation}
          onGoDoor={goDoor}
          onClosed={onListClosed}
        />

        {/* 场景内互动模式（拼图/调酒）：一句提示 + 「先离开」 */}
        <AnimatePresence>
          {sceneFocus && (
            <motion.div
              key={`scene-ui-${sceneFocus.id}`}
              className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex flex-col items-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <p className="font-hand rounded-full bg-white/90 px-5 py-1.5 text-xl text-neutral-700 shadow-md">
                {pick(sceneFocus.hint)}
              </p>
              <button
                onClick={() => void closeFocus()}
                className="pointer-events-auto rounded-full border border-neutral-300 bg-white/95 px-4 py-1 text-sm text-neutral-500 shadow-sm transition hover:bg-white"
              >
                {t("life.focus.back")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 专注态互动面板（拼图/调酒站不用面板，互动在画面里） */}
        <StationFocus
          station={sceneFocus ? null : focus}
          done={focus ? isStationDone(room, focus.id) : false}
          onComplete={completeStation}
          onClose={() => void closeFocus()}
        />

        {/* 进场：接住开门过场，淡出露出房间（示意稿用中性白光）；从目录来的不放 */}
        {!fromMenu && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-50"
            style={{
              background: "radial-gradient(circle at 50% 60%, #FFFFFF 0%, #D9D9D9 70%)",
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        )}
      </div>
    </div>
  );
}
