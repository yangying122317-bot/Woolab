import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import LangSwitcher from "../components/LangSwitcher";
import SoundToggle from "../components/SoundToggle";
import Checklist from "../components/life/Checklist";
import RoomStage, { type PaintPhase } from "../components/life/RoomStage";
import StationFocus from "../components/life/StationFocus";
import { ROOM_TOTAL_VH, lifeStations } from "../data/lifeStations";
import type { LifeStation } from "../data/lifeStations";
import { seg01Layers } from "../data/seg01Layers";
import {
  DEFAULT_ROOM,
  isNight,
  isStationDone,
  loadRoomState,
  saveRoomState,
} from "../state/roomState";
import type { DrinkChoice, RoomState } from "../state/roomState";
import { playNavigate } from "../audio/sfx";
import { useLanguage } from "../i18n/LanguageContext";

const photoStation = lifeStations.find((s) => s.id === "photo")!;

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
  const { t, pick } = useLanguage();
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
  const x = useTransform(
    scrollYProgress,
    [0, 0.92, 1],
    [0, -maxShift, -maxShift],
  );

  /* ---------------- 房间状态（持久化） ---------------- */
  // 带 ?reset 打开时清空进度，方便从头体验一遍
  const [room, setRoom] = useState<RoomState>(() => {
    if (new URLSearchParams(window.location.search).has("reset")) {
      window.history.replaceState(null, "", window.location.pathname);
      return { ...DEFAULT_ROOM };
    }
    return loadRoomState();
  });
  useEffect(() => {
    saveRoomState(room);
  }, [room]);

  const night = isNight(room);
  /** 进页面时就已是夜晚 → 不再放入夜仪式，直接呈现夜晚状态 */
  const bornAtNight = useRef(night);
  const [nightLine, setNightLine] = useState(false);

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

  // 墙上的清单滚出画面后，右下角浮出它的小缩影当入口
  const listLayer = seg01Layers.find((l) => l.src === "list")!;
  const [miniList, setMiniList] = useState(false);
  useMotionValueEvent(x, "change", (v) => {
    const listRightPx = ((listLayer.x + listLayer.w) / 18 / 100) * window.innerHeight;
    setMiniList(-v > listRightPx);
  });

  // 隐藏原生滚动条（底部进度条代替）；离开页面时恢复滚动锁
  useEffect(() => {
    document.documentElement.classList.add("scrollbar-hidden");
    return () => {
      document.documentElement.classList.remove("scrollbar-hidden");
      document.documentElement.style.overflow = "";
      window.clearTimeout(collapseTimer.current);
    };
  }, []);

  // 入夜仪式：集齐后停一拍 → 夜色里浮出一句话，再淡走
  useEffect(() => {
    if (!night || bornAtNight.current) return;
    const t1 = window.setTimeout(() => setNightLine(true), 1600);
    const t2 = window.setTimeout(() => setNightLine(false), 6400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [night]);

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
  const [labEntry, setLabEntry] = useState<{ cx: number; cy: number } | null>(null);
  const labGoTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(labGoTimer.current), []);
  const enterLab = (r: DOMRect) => {
    if (focus || labEntry) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    // 推进目标是门后的黄色门洞：开门后洞口在门框热区的左缘
    const cx = r.left + r.width * 0.1;
    const cy = r.top + r.height * 0.5;
    setZoomOrigin(`${cx - wr.left}px ${cy - wr.top}px`);
    document.documentElement.style.overflow = "hidden";
    setLabEntry({ cx, cy });
    void zoomControls.start({
      scale: 3,
      x: window.innerWidth / 2 - cx,
      y: window.innerHeight / 2 - cy,
      transition: { duration: 1.15, ease: [0.55, 0, 0.68, 0.4] },
    });
    labGoTimer.current = window.setTimeout(() => {
      playNavigate();
      navigate("/lab");
    }, 1300);
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
      collapseTimer.current = window.setTimeout(
        () => setChecklistOpen(false),
        2800,
      );
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
  const sceneFocus = photoFocus
    ? photoStation
    : drinkFocus || candleFocus
      ? focus
      : null;

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
    collapseTimer.current = window.setTimeout(
      () => setChecklistOpen(false),
      2800,
    );
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

  /** 挂衣互动完成（场景内直接完成，不经过专注态）：盖章 + 弹清单 */
  const completeTee = () => {
    playNavigate();
    setRoom((r) => ({ ...r, tee: true }));
    window.clearTimeout(collapseTimer.current);
    setChecklistOpen(true);
    collapseTimer.current = window.setTimeout(
      () => setChecklistOpen(false),
      2800,
    );
  };

  /** 重新过一晚 */
  const resetRoom = () => {
    setRoom({ ...DEFAULT_ROOM });
    bornAtNight.current = false;
    setNightLine(false);
    setChecklistOpen(false);
    setPaint("idle");
  };

  return (
    <div
      ref={scrollRef}
      className="relative"
      style={{ height: `${Math.round(ROOM_TOTAL_VH * 0.9)}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* 镜头层：专注态时以站点为原点推近 */}
        <motion.div
          ref={wrapRef}
          className="absolute inset-0"
          animate={zoomControls}
          style={{ transformOrigin: zoomOrigin }}
        >
          {/* 房间长卷：滚动驱动横移 */}
          <motion.div
            className="relative h-full"
            style={{ x, width: `${ROOM_TOTAL_VH}vh` }}
          >
            {/* 画稿下缘的蓝地板延伸：镜头推近时底部不露白 */}
            <div
              className="absolute left-0 w-full"
              style={{ top: "100%", height: "60vh", background: "#43A0CC" }}
            />
            <RoomStage
              room={room}
              night={night}
              interactive={!focus}
              onOpen={openStation}
              onChecklist={openChecklist}
              onTeeDone={completeTee}
              photoActive={photoFocus}
              onPhotoDone={completePhoto}
              drinkActive={focus?.id === "drink"}
              onDrinkDone={completeDrink}
              candleActive={focus?.id === "candle"}
              onCandleDone={completeCandle}
              onDressed={() =>
                setRoom((r) => ({ ...r, dressed: true }))
              }
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

        {/* 夜色：四件小事集齐后整间屋子暗下来 */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background: "linear-gradient(180deg, #3A3A3A 0%, #141414 100%)",
            mixBlendMode: "multiply",
          }}
          initial={false}
          animate={{ opacity: night ? 0.55 : 0 }}
          transition={{
            duration: bornAtNight.current ? 0 : 2.6,
            ease: "easeInOut",
          }}
        />

        {/* 入夜的一句话 */}
        <AnimatePresence>
          {nightLine && (
            <motion.p
              key="night-line"
              className="font-hand pointer-events-none absolute inset-x-0 top-[30%] z-20 px-6 text-center text-3xl text-white"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            >
              {t("life.night.line")}
            </motion.p>
          )}
        </AnimatePresence>

        {/* 轻顶栏：回首页 + 声音/语言 */}
        <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/assets/logo.svg" alt="logo" className="h-8 w-8" />
            <span
              className={`font-hand text-lg ${
                night ? "text-white" : "text-neutral-700"
              }`}
            >
              {t("nav.life")}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <LangSwitcher />
          </div>
        </header>

        {/* 底部进度条 */}
        <div className="absolute inset-x-0 bottom-5 z-20 mx-auto w-40 rounded-full bg-black/10">
          <motion.div
            className="h-1.5 rounded-full bg-neutral-700/70"
            style={{ scaleX: scrollYProgress, transformOrigin: "0 50%" }}
          />
        </div>

        {/* 墙上的清单不在画面里时，右下角浮出小缩影当入口 */}
        <AnimatePresence>
          {miniList && !checklistOpen && !focus && (
            <motion.button
              key="mini-list"
              onClick={openChecklist}
              aria-label={t("life.checklist.title")}
              initial={{ opacity: 0, y: 20, rotate: 4 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, y: 20, rotate: 4 }}
              whileHover={{ rotate: -5, scale: 1.08 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="absolute bottom-5 right-5 z-20"
            >
              <img
                src="/assets/life/seg01/list.webp"
                alt=""
                draggable={false}
                className="h-24 w-auto drop-shadow-lg"
              />
            </motion.button>
          )}
        </AnimatePresence>

        {/* 今晚的小事清单（入口在墙上挂着的清单素材） */}
        <Checklist
          room={room}
          open={checklistOpen}
          onToggle={() => setChecklistOpen((v) => !v)}
          onReset={resetRoom}
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

        {/* 进场：接住开门过场，淡出露出房间（示意稿用中性白光） */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-50"
          style={{
            background:
              "radial-gradient(circle at 50% 60%, #FFFFFF 0%, #D9D9D9 70%)",
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
