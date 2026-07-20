import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  motion,
  useAnimationControls,
  useReducedMotion,
  type TargetAndTransition,
} from "framer-motion";
import { heroHotspots } from "../data/heroHotspots";
import { useLanguage } from "../i18n/LanguageContext";

/** 原图画板尺寸（Figma 1440 x 900），所有定位按它换算成百分比 */
const FRAME_W = 1440;
const FRAME_H = 900;
const HERO_RATIO = FRAME_W / FRAME_H;

/** Figma 画板的天空渐变背景 */
const SKY_GRADIENT = "linear-gradient(to bottom, #0E8DD9, #BFEFFD 117%)";

const px = (x: number) => `${(x / FRAME_W) * 100}%`;
const py = (y: number) => `${(y / FRAME_H) * 100}%`;

/**
 * 分层素材的位置（来自 Figma 各图层的渲染边界，单位为画板像素）。
 * 若在 Figma 里挪动了元素，重新导出对应 PNG 并更新这里的数值。
 */
const SPRITES = {
  cloudBig: { src: "/assets/hero-cloud-big.png", x: 0, y: 117.3, w: 1440 },
  cloud1: { src: "/assets/hero-cloud-1.png", x: 1084.7, y: 208.8, w: 153.9 },
  cloud2: { src: "/assets/hero-cloud-2.png", x: 1208.1, y: 194.6, w: 89.7 },
  base: { src: "/assets/hero-base.png" },
  openSign: { src: "/assets/hero-open-sign.png", x: 611.8, y: 554.9, w: 98.8 },
  sheep: { src: "/assets/hero-sheep.png", x: 828.2, y: 588, w: 170.2 },
  mailbox: { src: "/assets/hero-mailbox.png", x: 1157.6, y: 587.7, w: 115.7 },
  woolabSign: { src: "/assets/hero-sign.png", x: 620.8, y: 439.1, w: 198.4 },
  board: { src: "/assets/hero-board.png", x: 158.3, y: 693.2, w: 159.4 },
  bush: { src: "/assets/hero-bush.png", x: 1116, y: 763.9, w: 98.2 },
} as const;

/**
 * 小鸟的三帧姿态（宽高为 1 倍图尺寸，单位画板像素）。
 * 三帧在容器内底部居中对齐，切换帧时脚的位置不变。
 */
const BIRD_FRAMES = {
  fly: { src: "/assets/hero-bird-fly.png", w: 114, h: 77 },
  brake: { src: "/assets/hero-bird-brake.png", w: 109, h: 87 },
  stand: { src: "/assets/hero-bird-stand.png", w: 119, h: 91 },
} as const;

type BirdFrame = keyof typeof BIRD_FRAMES;

/** 小鸟容器尺寸（画板像素），取三帧的最大值再留一点余量 */
const BIRD_BOX = { w: 120, h: 95 };

/** 降落点：屋顶栏杆（横杆顶边 y≈300，花箱左侧空档 x≈860） */
const PERCH = {
  left: `${((860 - BIRD_BOX.w / 2) / FRAME_W) * 100}%`,
  top: `${((300 - BIRD_BOX.h) / FRAME_H) * 100}%`,
};

/** 悬停时每个热区元素"轻轻活起来"的小动作 */
const HOVER_MOTION: Record<string, TargetAndTransition> = {
  characters: {
    // 小羊轻轻蹦一下
    y: [0, -10, 0, -4, 0],
    transition: { duration: 0.7, ease: "easeOut" },
  },
  lab: {
    // 招牌微微歪头
    rotate: [0, -1.6, 1.2, 0],
    scale: [1, 1.03, 1.03, 1],
    transition: { duration: 0.8, ease: "easeInOut" },
  },
  downloads: {
    // 小黑板晃一下
    rotate: [0, -3, 2, -1, 0],
    transition: { duration: 0.8, ease: "easeInOut" },
  },
  contact: {
    // 邮箱左右摇摆
    rotate: [0, -2.5, 2, -1, 0],
    transition: { duration: 0.8, ease: "easeInOut" },
  },
};

/** OPEN 吊牌的摆动（进场时播一次，悬停玻璃门时再播一次） */
const SIGN_SWING: TargetAndTransition = {
  rotate: [0, -7, 5, -2.5, 1, 0],
  transition: { duration: 2.4, ease: "easeInOut" },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function HeroScene() {
  return (
    <>
      {/* 桌面端：全屏场景 */}
      <div className="hidden h-full md:block">
        <SceneCanvas cover />
      </div>

      {/* 移动端：完整插画 + 列表导航 */}
      <div className="flex h-full flex-col md:hidden">
        <SceneCanvas cover={false} />
        <HotspotList />
      </div>
    </>
  );
}

function SceneCanvas({ cover }: { cover: boolean }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);

  const signControls = useAnimationControls();
  const birdControls = useAnimationControls();
  const [birdFrame, setBirdFrame] = useState<BirdFrame>("fly");

  // 进场：OPEN 吊牌轻晃一两下后停
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setTimeout(() => signControls.start(SIGN_SWING), 1200);
    return () => clearTimeout(timer);
  }, [reducedMotion, signControls]);

  // 小鸟：不定期从右侧飞过，偶尔落在屋顶栏杆上歇一会
  // 三帧姿态：fly 巡航 → brake 展翅减速 → stand 站立，起飞时反过来
  useEffect(() => {
    if (reducedMotion) return;
    let alive = true;

    (async () => {
      while (alive) {
        await sleep(rand(4000, 12000));
        if (!alive) break;

        const cruiseTop = rand(10, 18);
        setBirdFrame("fly");
        birdControls.set({
          left: "106%",
          top: `${cruiseTop}%`,
          opacity: 1,
          y: 0,
        });

        if (Math.random() < 0.45) {
          // 巡航接近栏杆上方
          await birdControls.start({
            left: ["106%", "70%"],
            top: [`${cruiseTop}%`, "13.5%"],
            transition: { duration: 4.2, ease: "easeOut" },
          });
          if (!alive) break;

          // 展翅刹车，缓缓降到栏杆上
          setBirdFrame("brake");
          await birdControls.start({
            left: ["70%", PERCH.left],
            top: ["13.5%", PERCH.top],
            transition: { duration: 1.1, ease: "easeOut" },
          });
          if (!alive) break;

          // 落地缓冲：轻轻下沉一下
          setBirdFrame("stand");
          await birdControls.start({
            y: [-3, 1, 0],
            transition: { duration: 0.35, ease: "easeOut" },
          });
          if (!alive) break;

          // 站着歇一会，偶尔轻微起伏
          await birdControls.start({
            y: [0, -2, 0],
            transition: {
              duration: 1.6,
              repeat: Math.floor(rand(2, 5)),
              ease: "easeInOut",
            },
          });
          if (!alive) break;
          await sleep(rand(1000, 3000));
          if (!alive) break;

          // 起飞：先展翅向上一蹬，再切回飞行姿态飞走
          setBirdFrame("brake");
          await birdControls.start({
            y: [0, -14],
            transition: { duration: 0.35, ease: "easeOut" },
          });
          if (!alive) break;
          setBirdFrame("fly");
          await birdControls.start({
            left: [PERCH.left, "-12%"],
            top: [PERCH.top, `${rand(8, 13)}%`],
            y: 0,
            transition: { duration: 6, ease: "easeIn" },
          });
        } else {
          // 直接横穿画面
          await birdControls.start({
            left: ["106%", "-12%"],
            top: [
              `${cruiseTop}%`,
              `${cruiseTop + rand(-4, 2)}%`,
              `${cruiseTop + rand(-2, 4)}%`,
            ],
            transition: { duration: rand(11, 15), ease: "linear" },
          });
        }
        birdControls.set({ opacity: 0 });
      }
    })();

    return () => {
      alive = false;
    };
  }, [reducedMotion, birdControls]);

  // 悬停玻璃门时，OPEN 吊牌再晃一次
  useEffect(() => {
    if (hovered === "about" && !reducedMotion) signControls.start(SIGN_SWING);
  }, [hovered, reducedMotion, signControls]);

  const drift = (amount: number, duration: number) =>
    reducedMotion
      ? undefined
      : {
          x: [0, amount, 0, -amount, 0],
          transition: { duration, repeat: Infinity, ease: "easeInOut" as const },
        };

  return (
    <div
      className={`relative overflow-hidden ${
        cover ? "flex h-full items-center justify-center" : ""
      }`}
      style={{ background: SKY_GRADIENT }}
    >
      {/* 场景本体：保持原图比例，桌面端等效 object-cover 铺满视口 */}
      <div
        className="relative shrink-0"
        style={
          cover
            ? {
                aspectRatio: `${HERO_RATIO}`,
                width: `max(100vw, calc(100vh * ${HERO_RATIO}))`,
              }
            : { aspectRatio: `${HERO_RATIO}`, width: "100%" }
        }
      >
        {/* 云层（在建筑后面缓慢漂移） */}
        <motion.img
          src={SPRITES.cloudBig.src}
          alt=""
          className="pointer-events-none absolute select-none"
          style={{
            left: "-1.5%",
            top: py(SPRITES.cloudBig.y),
            width: "103%",
            maxWidth: "none",
          }}
          animate={drift(9, 90)}
          draggable={false}
        />
        <motion.img
          src={SPRITES.cloud1.src}
          alt=""
          className="pointer-events-none absolute select-none"
          style={{
            left: px(SPRITES.cloud1.x),
            top: py(SPRITES.cloud1.y),
            width: px(SPRITES.cloud1.w),
          }}
          animate={drift(-22, 64)}
          draggable={false}
        />
        <motion.img
          src={SPRITES.cloud2.src}
          alt=""
          className="pointer-events-none absolute select-none"
          style={{
            left: px(SPRITES.cloud2.x),
            top: py(SPRITES.cloud2.y),
            width: px(SPRITES.cloud2.w),
          }}
          animate={drift(-14, 48)}
          draggable={false}
        />

        {/* 建筑与地面（静止底图） */}
        <img
          src={SPRITES.base.src}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          draggable={false}
        />

        {/* OPEN 吊牌：以挂点为轴摆动 */}
        <motion.img
          src={SPRITES.openSign.src}
          alt=""
          className="pointer-events-none absolute select-none"
          style={{
            left: px(SPRITES.openSign.x),
            top: py(SPRITES.openSign.y),
            width: px(SPRITES.openSign.w),
            transformOrigin: "50% 8%",
          }}
          animate={signControls}
          draggable={false}
        />

        {/* 四个热区元素：悬停时各自轻轻动一下 */}
        <HotspotSprite sprite={SPRITES.woolabSign} active={hovered === "lab"} motionSpec={HOVER_MOTION.lab} origin="50% 50%" />
        <HotspotSprite sprite={SPRITES.board} active={hovered === "downloads"} motionSpec={HOVER_MOTION.downloads} origin="50% 100%" />
        <HotspotSprite sprite={SPRITES.sheep} active={hovered === "characters"} motionSpec={HOVER_MOTION.characters} origin="50% 100%" />
        <HotspotSprite sprite={SPRITES.mailbox} active={hovered === "contact"} motionSpec={HOVER_MOTION.contact} origin="50% 100%" />

        {/* 邮箱前的灌木（盖在邮箱杆前面） */}
        <img
          src={SPRITES.bush.src}
          alt=""
          className="pointer-events-none absolute select-none"
          style={{
            left: px(SPRITES.bush.x),
            top: py(SPRITES.bush.y),
            width: px(SPRITES.bush.w),
          }}
          draggable={false}
        />

        {/* 小鸟：三帧共用一个容器，底部居中对齐，切帧时脚位不变 */}
        <motion.div
          className="pointer-events-none absolute select-none"
          style={{ width: px(BIRD_BOX.w), height: py(BIRD_BOX.h) }}
          initial={{ left: "106%", top: "14%", opacity: 0 }}
          animate={birdControls}
        >
          {(Object.keys(BIRD_FRAMES) as BirdFrame[]).map((k) => (
            <img
              key={k}
              src={BIRD_FRAMES[k].src}
              alt=""
              draggable={false}
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
              style={{
                width: `${(BIRD_FRAMES[k].w / BIRD_BOX.w) * 100}%`,
                display: birdFrame === k ? "block" : "none",
              }}
            />
          ))}
        </motion.div>

        {/* 透明热区（点击跳转 + 悬停触发上面的微动效） */}
        {heroHotspots.map((h) => (
          <div
            key={h.id}
            role="link"
            tabIndex={0}
            aria-label={t(h.labelKey)}
            className="group absolute z-20 cursor-pointer outline-none"
            style={{
              left: `${h.left}%`,
              top: `${h.top}%`,
              width: `${h.width}%`,
              height: `${h.height}%`,
            }}
            onMouseEnter={() => setHovered(h.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(h.id)}
            onBlur={() => setHovered(null)}
            onClick={() => navigate(h.path)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") navigate(h.path);
            }}
          >
            {/* 名称标签：悬停时淡入 */}
            <span
              className={`absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-neutral-800 shadow-md transition-opacity duration-300 ${
                hovered === h.id
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
            >
              {t(h.labelKey)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HotspotSprite({
  sprite,
  active,
  motionSpec,
  origin,
}: {
  sprite: { src: string; x: number; y: number; w: number };
  active: boolean;
  motionSpec: TargetAndTransition;
  origin: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.img
      src={sprite.src}
      alt=""
      className="pointer-events-none absolute select-none"
      style={{
        left: px(sprite.x),
        top: py(sprite.y),
        width: px(sprite.w),
        transformOrigin: origin,
      }}
      animate={active && !reducedMotion ? motionSpec : { y: 0, rotate: 0, scale: 1 }}
      draggable={false}
    />
  );
}

function HotspotList() {
  const { t } = useLanguage();

  return (
    <ul className="flex flex-1 flex-col gap-3 bg-[#FFF6E9] px-4 py-5">
      {heroHotspots.map((h) => (
        <li key={h.id}>
          <Link
            to={h.path}
            className="flex items-center justify-between rounded-xl border border-[#F0E2CC] bg-white px-4 py-4 shadow-sm transition active:scale-[0.98]"
          >
            <span className="font-medium">{t(h.labelKey)}</span>
            <span aria-hidden className="text-neutral-400">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
