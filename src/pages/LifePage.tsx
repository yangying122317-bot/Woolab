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
import { preloadLifeRest, whenLifeFirstReady } from "../components/life/preload";

/** 第一屏素材最多等这么久；网再慢也先揭开（图会陆续补上） */
const READY_CAP_MS = 4000;

const photoStation = lifeStations.find((s) => s.id === "photo")!;

/** 清单抽屉是谁推出来的：决定要不要锁滚、要不要自动收 */
type ListReason = "guide" | "stamp" | "user" | "done";
/** 做完一件后抽屉停多久自己收（划线 0.4s + 盖章 0.95s 之后还留一秒多） */
const STAMP_STAY = 2800;
/** 引导那次停多久 */
const GUIDE_STAY = 3600;

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
  const x = useTransform(scrollYProgress, [0, 0.92, 1], [0, -maxShift, -maxShift]);

  /*
   * 进门先把第一屏的图在幕后解码完（见 components/life/preload.ts），就位前房间不挂、白光不散；
   * 就位后再把后面两段的图在后台拉齐。这样揭开的那一刻主线程是空的，滚轮立刻有反应。
   */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void whenLifeFirstReady(READY_CAP_MS).then(() => {
      if (!alive) return;
      setReady(true);
      void preloadLifeRest();
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ---------------- 房间状态（持久化） ---------------- */
  // 带 ?reset 打开时清空进度（引导只看进度，清了自然重演），方便从头体验一遍
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

  /* ---------------- 专注态（镜头推近） ---------------- */
  const [focus, setFocus] = useState<LifeStation | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const zoomControls = useAnimationControls();

  /* ---------------- 清单 ---------------- */
  /**
   * 抽屉只有一个开关 showList / hideList，谁要弹都从这儿走，按"谁推出来的"分四种：
   *   guide  第一次进门（一件都没做过）自动推出来看几秒——不锁滚，人一滚就收
   *   stamp  刚做完一件，推出来划线盖章，几秒后自己收——鼠标放上去就等着，移开再倒数
   *   user   自己点开的（墙上那张 / 左边缘一角）——锁滚，点空处 / Esc 收
   *   done   四件全做完那次——不自动收，底下浮出"带我过去"
   */
  const [list, setList] = useState<{ open: boolean; reason: ListReason }>({ open: false, reason: "user" });
  const checklistOpen = list.open;
  const listRef = useRef(list);
  listRef.current = list;
  /** 自动收回的倒计时：鼠标进抽屉时暂停（记下剩多少），出来再续 */
  const collapseTimer = useRef<number | undefined>(undefined);
  const collapseLeft = useRef(0);
  const collapseFrom = useRef(0);
  const stopCollapse = () => {
    if (collapseTimer.current !== undefined) {
      collapseLeft.current = Math.max(0, collapseLeft.current - (performance.now() - collapseFrom.current));
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = undefined;
    }
  };
  const startCollapse = (ms: number) => {
    window.clearTimeout(collapseTimer.current);
    collapseLeft.current = ms;
    collapseFrom.current = performance.now();
    collapseTimer.current = window.setTimeout(() => {
      collapseTimer.current = undefined;
      setList((l) => ({ ...l, open: false }));
    }, ms);
  };
  const showList = (reason: ListReason, autoCloseMs?: number) => {
    stopCollapse();
    setList({ open: true, reason });
    if (autoCloseMs) startCollapse(autoCloseMs);
  };
  const hideList = () => {
    stopCollapse();
    setList((l) => ({ ...l, open: false }));
  };
  /** 鼠标进了抽屉：自动收的先别倒数 */
  const onListEnter = () => {
    if (list.reason === "stamp" || list.reason === "guide") stopCollapse();
  };
  /** 鼠标离开抽屉：接着倒数，至少再留一秒多 */
  const onListLeave = () => {
    if (list.open && (list.reason === "stamp" || list.reason === "guide"))
      startCollapse(Math.max(collapseLeft.current, 1200));
  };
  /** 在抽屉里点了什么：这就是人家要看的东西了，不再自动收，按自己点开的算 */
  const onListInteract = () => {
    if (list.reason !== "user" && list.reason !== "done") showList("user");
  };
  /* 刚做完的这件正好是最后一件：纸要被揭走、露出"带我过去"，不能自动收 */
  useEffect(() => {
    if (list.open && list.reason === "stamp" && isAllDone(room)) showList("done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, room]);
  useEffect(() => () => window.clearTimeout(collapseTimer.current), []);

  /** 专注态里刚完成了一项，拉回后要弹清单盖章 */
  const pendingStamp = useRef(false);
  /** 作画动画阶段：拼图完成 → wait（拉回中）→ play（原位作画）→ idle */
  const [paint, setPaint] = useState<PaintPhase>("idle");

  const openChecklist = () => showList("user");
  const closeChecklist = () => hideList();

  /*
   * 自己点开的 / 全做完那次：抽屉盖在房间上，滚轮锁住（房间别在后面自己跑）。
   * 自动弹出来的（引导 / 盖章）不锁：人要是滚了，说明不想看，抽屉自己收（见下面 x 的监听）。
   * listKick：面板收回去那一刻，墙上挂着的那张清单荡两下，提醒"它就住在这儿"。
   * 引导那次收回去之后，再补一支箭头指着墙上那张。
   */
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    if (list.open && (list.reason === "user" || list.reason === "done")) lenis.stop();
    else lenis.start();
  }, [list, lenis]);
  /*
   * 抽屉是牛皮色、顶到屏幕顶，压着左上角的 logo：开着时 logo 画成纯白。
   * 收回是 0.42s 的滑出动画，checklistOpen 一变假抽屉还盖在 logo 底下——这段时间 logo 要是切回
   * difference 混合，白字压在牛皮色上就闪成蓝的；所以纯白要一直保持到抽屉真正滑出画面（onClosed）。
   */
  const [drawerShown, setDrawerShown] = useState(false);
  useEffect(() => {
    if (checklistOpen) setDrawerShown(true);
  }, [checklistOpen]);
  useReportPlainLogo(checklistOpen || drawerShown);
  const [listKick, setListKick] = useState(0);
  const guideHint = useRef(false);
  const hintTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  const onListClosed = () => {
    setDrawerShown(false);
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

  // 墙上的清单滚出画面后，右下角浮出它的小缩影当入口
  const listLayer = seg01Layers.find((l) => l.src === "list")!;
  const [miniList, setMiniList] = useState(false);
  /** 画面右边缘在长卷里的位置（vh），判断右边还有没有没做的事 */
  const [viewRight, setViewRight] = useState(() => (window.innerWidth / window.innerHeight) * 100);
  /** 抽屉推出来时房间在哪：自动弹出的那两种，房间一动（滚了 8px 以上）就当人不想看，收掉 */
  const xAtOpen = useRef(0);
  useEffect(() => {
    if (list.open) xAtOpen.current = x.get();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.open]);
  /** 揭开后人已经自己滚过房间了：会玩了，这次不用引导 */
  const guideDone = useRef(false);
  useMotionValueEvent(x, "change", (v) => {
    const listRightPx = ((listLayer.x + listLayer.w) / 18 / 100) * window.innerHeight;
    setMiniList(-v > listRightPx);
    setViewRight(((-v + window.innerWidth) / window.innerHeight) * 100);
    const moved = Math.abs(v - xAtOpen.current) > 8;
    const l = listRef.current;
    if (l.open && (l.reason === "guide" || l.reason === "stamp") && moved) hideList();
    if (Math.abs(v) > 8) guideDone.current = true;
  });

  /* ---------------- 引导 ---------------- */
  /**
   * 引导只看进度，不另记标记：
   *  - 一件都没做过：房间揭开后，人停下来 1.5s 没动，清单抽屉从左边推出来让人看几秒（四件小事）→
   *    自己收回去、墙上那张荡两下 → 一支手绘箭头指着它"今晚的清单住在这儿"。
   *    每次进来都这样；但揭开后人已经自己滚了 / 点了站点，说明会玩了，这次就不弹。
   *  - 做过任何一件（没做完）：不弹抽屉，只让墙上那张晃两下 + 箭头，提醒清单在这儿。
   *  - 全做完：什么都不提醒。
   * 之后靠"停下来就出箭头"的站点引导接力。
   */
  const [entryHint, setEntryHint] = useState(false);
  const noProgress = !lifeStations.some((s) => isStationDone(room, s.id));
  const guideIdle = useIdle(1500, ready && noProgress && !guideDone.current && !focus && !list.open);
  useEffect(() => {
    if (!guideIdle || guideDone.current) return;
    guideDone.current = true;
    guideHint.current = true;
    showList("guide", GUIDE_STAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideIdle]);
  useEffect(() => {
    if (!ready || noProgress || isAllDone(room)) return;
    const t = window.setTimeout(() => {
      setListKick((n) => n + 1);
      setEntryHint(true);
      hintTimer.current = window.setTimeout(() => setEntryHint(false), 2600);
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 隐藏原生滚动条（底部进度条代替）；离开页面时恢复滚动锁
  useEffect(() => {
    document.documentElement.classList.add("scrollbar-hidden");
    return () => {
      document.documentElement.classList.remove("scrollbar-hidden");
      document.documentElement.style.overflow = "";
    };
  }, []);

  /** 点击站点：镜头以站点为原点推近，锁住滚动 */
  const openStation = (station: LifeStation, el: HTMLElement) => {
    if (focus) return;
    /* 人已经自己上手点站点了，这次不用再推引导 */
    guideDone.current = true;
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
      showList("stamp", STAMP_STAY);
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
    showList("stamp", STAMP_STAY);
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
    showList("stamp", STAMP_STAY);
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
          {/* 房间长卷：滚动驱动横移；willChange 让它独立成层，横移时不重绘整条墙 */}
          <motion.div className="relative h-full" style={{ x, width: `${ROOM_TOTAL_VH}vh`, willChange: "transform" }}>
            {/* 画稿下缘的蓝地板延伸：镜头推近时底部不露白 */}
            <div className="absolute left-0 w-full" style={{ top: "100%", height: "60vh", background: "#43A0CC" }} />
            {/* 第一屏的图解码完才挂房间：否则三百多张图一起抢带宽、抢主线程，揭开时滚不动 */}
            {ready && (
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
            )}
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

        {/* 墙上的清单不在画面里时，右下角浮出它的小缩影当入口（往右走的箭头会让到它上面） */}
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
              className="absolute z-20 cursor-pointer"
              style={{ right: "3vh", bottom: "3vh" }}
            >
              <img
                src="/assets/life/seg01/list.webp"
                alt=""
                draggable={false}
                className="w-auto drop-shadow-lg"
                style={{ height: "11vh" }}
              />
            </motion.button>
          )}
        </AnimatePresence>

        {/* 今晚的小事清单：从左边推出来的牛皮板（入口是墙上挂着的清单 / 右下角的小缩影） */}
        <Checklist
          room={room}
          open={checklistOpen}
          onClose={closeChecklist}
          onGoStation={goStation}
          onGoDoor={goDoor}
          onClosed={onListClosed}
          onEnter={onListEnter}
          onLeave={onListLeave}
          onInteract={onListInteract}
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

        {/* 进场：接住开门过场，等第一屏的图就位再淡出露出房间（示意稿用中性白光）；从目录来的不放 */}
        {!fromMenu && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-50"
            style={{
              background: "radial-gradient(circle at 50% 60%, #FFFFFF 0%, #D9D9D9 70%)",
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: ready ? 0 : 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        )}
      </div>
    </div>
  );
}
