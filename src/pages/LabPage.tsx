import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { labProjects, type LabProject } from "../data/labs";
import { useLanguage } from "../i18n/LanguageContext";
import { playNavigate } from "../audio/sfx";

/**
 * 实验室 · 画展。
 *
 * 一条滚动、两个阶段、同一个 3D 场景：
 * 1. 横向：沿入口墙往右走（招牌 → 欢迎语 → 拱门）
 * 2. 纵深：拱门居中后往里走，一面面展墙迎面而来
 *
 * 新视觉元素先用灰块占位，Figma 素材到位后按坐标替换。
 */

const ENTRY = 1400;
const GAP = 1500;
const EXIT = 900;
const WALL_X = 760;
const FLOOR_Y = 340;
const CEIL_Y = -420;
const PERSPECTIVE = 1050;

const N = labProjects.length;
/** NO.01 挂在入口墙上，走廊里只放剩下的项目 */
const N_WALLS = N - 1;
const WALL_Z = ENTRY + (N_WALLS - 1) * GAP + EXIT;
const CAM_END = WALL_Z - 620;
const DEPTH = WALL_Z + 400;

const WALL_W = WALL_X * 2; // 1520
const WALL_H = FLOOR_Y - CEIL_Y; // 760
/** 墙面向上延伸量：画面顶部不露出天花，与设计稿"满墙"一致 */
const WALL_EXT = 320;
const WALL_TOP_Y = -(WALL_H / 2 + WALL_EXT); // -700
const WALL_RUST = "#B26128"; // 墙面锈棕（切图噪点的平均色）
const SIDE_RUST = "#9C5322"; // 侧墙略深
const FLOOR_CREAM = "#F0CA7E"; // 地板暖黄（与砖纹瓦片底色一致）
const ghost =
  "border-2 border-dashed border-neutral-400/80 bg-white/45 text-neutral-500";

/* 走廊墙切图（含拱门洞，洞已抠透明）：显示高 760，黑色墙脚线正好落在地板线上
   注：Figma 导出按画板裁切，内容实际 720 设计宽（高 365.75），按高度等比得显示宽 1496 */
const ARCH_IMG_W = 1496;
const ARCH_IMG_H = 760;
const ARCH_TOP = -40; // 切图顶部相对内层(0..760)的 y
const ARCH_HOLE_CX = 1037; // 拱门洞中心在切图内的 x
const SKIRT_Y = 714; // 墙脚黑线（内层坐标）
const SKIRT_H = 5;

/* 入口墙：宽于走廊，拱门洞对准走廊中线（世界 x=0） */
const ENTRANCE_W = 5200;
const ENTRANCE_Z = 180; // 入口墙离相机的初始距离
const PAN = 1777; // 横向段：起点墙左端贴屏，终点拱门居中
const SCROLL_LEN = PAN + CAM_END;
const PAN_RATIO = PAN / SCROLL_LEN;

const FRAME = { x: 251, y: 252, w: 226, h: 279 };
const LAMP = { x: 231, y: 152, w: 266, h: 167 };
const PLAQUE = { x: 324, y: 520, w: 147, h: 131 };

/* 第一屏"假 3D"地板条：设计稿手绘斜砖，贴在入口墙同一平面上（非真 3D 地面）。
   三段入口墙各铺一条，backgroundPosition 按段起点偏移保证砖纹连续 */
const STRIP_W = 1806;
const STRIP_H = 489;
const STRIP_TOP = 1070; // 容器坐标：墙脚线正下方
/* 入口墙相对设计稿整体下移量：墙脚线从容器 1034 落到设计稿位置 1067 */
const WALL_SHIFT = 33;

function FloorStrip({ offset, width }: { offset: number; width: number }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: 0,
        top: STRIP_TOP,
        width,
        height: STRIP_H,
        background: "url(/assets/lab/gallery-floor-strip.webp) repeat-x",
        backgroundSize: `${STRIP_W}px ${STRIP_H}px`,
        backgroundPosition: `${-offset}px 0`,
      }}
    />
  );
}

/* ---------------- 灰块：号码牌 / 壁灯 ---------------- */

function GhostNumber({ n }: { n: number }) {
  const label = `NO.${String(n).padStart(2, "0")}`;
  return (
    <div
      className={`font-hand flex items-center justify-center ${ghost}`}
      style={{
        width: 88,
        height: 64,
        borderRadius: "50%",
      }}
    >
      {label}
    </div>
  );
}

/** 壁灯：两态手绘切图交叉淡入淡出（灭灯/亮灯同画布对位） */
function WallLamp({
  hover,
  width,
  height,
}: {
  hover: boolean;
  width: number;
  height: number;
}) {
  return (
    <div className="absolute" style={{ width, height }}>
      <img
        src="/assets/lab/gallery-lamp-off.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain"
        style={{ opacity: hover ? 0 : 1, transition: "opacity 0.35s ease" }}
      />
      <img
        src="/assets/lab/gallery-lamp-on.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain"
        style={{ opacity: hover ? 1 : 0, transition: "opacity 0.35s ease" }}
      />
    </div>
  );
}

/* ---------------- 入口墙（横向段） ---------------- */

/**
 * 珍珠小羊油画：复刻参考站邮票的 hover 手感——
 * 悬停缓动放大 1.02 并朝鼠标所在方向轻微 3D 倾斜（约 ±1.2°），移开弹回。
 * 开场动画播放期间隐藏（透明但可测量），避免与飞行中的大图重影。
 */
function EntrancePainting({
  hidden,
  pe,
}: {
  hidden: boolean;
  pe: MotionValue<"auto" | "none">;
}) {
  const spring = { stiffness: 160, damping: 19 };
  const rotateX = useSpring(0, spring);
  const rotateY = useSpring(0, spring);
  const scale = useSpring(1, { stiffness: 180, damping: 20 });

  return (
    <motion.img
      id="lab-entrance-painting"
      src="/assets/lab/gallery-painting-big.webp"
      alt=""
      draggable={false}
      className="absolute max-w-none cursor-pointer select-none"
      style={{
        left: 645,
        top: 166,
        width: 361,
        height: 394,
        opacity: hidden ? 0 : 1,
        pointerEvents: pe,
        rotateX,
        rotateY,
        scale,
        transformPerspective: 900,
      }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        rotateX.set(-dy * 3.6);
        rotateY.set(dx * 3.6);
        scale.set(1.02);
      }}
      onPointerLeave={() => {
        rotateX.set(0);
        rotateY.set(0);
        scale.set(1);
      }}
    />
  );
}

function EntranceWall({
  camZ,
  onOpen,
  paintingHidden,
}: {
  camZ: MotionValue<number>;
  onOpen: (project: LabProject) => void;
  paintingHidden: boolean;
}) {
  const opacity = useTransform(camZ, [40, 160], [1, 0]);
  const pe = useTransform(opacity, (o) =>
    o > 0.4 ? ("auto" as const) : ("none" as const),
  );
  const [artHover, setArtHover] = useState(false);
  const first = labProjects[0];
  /* 拱门切图摆放：洞中心对准墙中心（走廊轴线 x=0） */
  const archLeft = ENTRANCE_W / 2 - ARCH_HOLE_CX;
  const archRight = archLeft + ARCH_IMG_W;
  const archOuterTop = WALL_EXT + ARCH_TOP;

  /* 入口墙拆成三块并排图层：整面 5200px 超出 Chrome 单层光栅上限，
     滚动中整块墙会被随机丢弃；三段各自 ≤2150px，安全渲染 */
  const seg = (x0: number, w: number) => ({
    width: w,
    height: WALL_H + WALL_EXT,
    transform: `translate3d(${-ENTRANCE_W / 2 + x0}px, ${WALL_TOP_Y}px, ${-ENTRANCE_Z}px)`,
  });

  return (
    <>
      {/* 左段：转角 + 居中陈列的珍珠小羊油画（向左扩 120 容纳转角侧面） */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{ opacity, ...seg(-120, archLeft + 122) }}
      >
        <div className="absolute inset-0" style={{ background: WALL_RUST }} />
        {/* 假 3D 地板条：先铺砖纹，墙切图后画，墙脚自带投影会压在砖上 */}
        <FloorStrip offset={0} width={archLeft + 122} />
        {/* 第一屏整面墙切图（含左转角侧面、双转角线、墙脚线、墙脚投影）：
            按设计稿对位：回墙面几乎完整露出（屏幕上约 56px），
            转角双线落在屏幕 x≈56–91；右缘溢出段边界的部分被拱门段盖住；
            墙脚线落在容器 y≈1067（缩放 0.627） */}
        <img
          src="/assets/lab/gallery-wall-seg1.webp"
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ left: 93, top: 124 + WALL_SHIFT, width: 1677, height: 978 }}
        />
      {/* 内层内容（0..760 坐标系，底边即墙脚）：
          屏幕中心对应内层 x=823，油画/壁灯/陈列文字都以它为轴居中 */}
      <div
        className="absolute"
        style={{ left: 120, top: WALL_EXT, width: archLeft + 2, height: WALL_H }}
      >
        {/* 壁灯（蓝罩，画上方居中，灯座支架朝下几乎贴着画框顶） */}
        <img
          src="/assets/lab/gallery-lamp-entrance.webp"
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{ left: 770, top: 11, width: 112, height: 132 }}
        />
        {/* 珍珠小羊油画（透明底原生投影）：开场动画的落位目标；
            切图含右/下投影边距，框体位置尺寸按设计稿校准 */}
        <EntrancePainting hidden={paintingHidden} pe={pe} />
        {/* 陈列铭牌文字 */}
        <span
          className="font-title absolute text-center"
          style={{
            left: 523,
            top: 573,
            width: 600,
            fontSize: 38,
            letterSpacing: "0.06em",
            color: "#823804",
          }}
        >
          WOOLAB COLLECTION
        </span>
      </div>
      </motion.div>

      {/* 拱门段：拱门切图（洞是透明的）+ NO.01 集群 */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{ opacity, ...seg(archLeft, ARCH_IMG_W) }}
      >
        <div
          className="absolute left-0 right-0 top-0"
          style={{ height: archOuterTop + WALL_SHIFT + 1, background: WALL_RUST }}
        />
        {/* 假 3D 地板条：与左段砖纹连续 */}
        <FloorStrip offset={archLeft + 120} width={ARCH_IMG_W} />
        <img
          src="/assets/lab/gallery-arch.webp"
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{
            left: 0,
            top: archOuterTop + WALL_SHIFT,
            width: ARCH_IMG_W,
            height: ARCH_IMG_H,
          }}
        />
        {/* 内层内容（相对拱门段左缘，即全墙坐标 - archLeft），随墙整体下移 */}
        <div
          className="absolute left-0"
          style={{ top: WALL_EXT + WALL_SHIFT, width: ARCH_IMG_W, height: WALL_H }}
        >
        {/* 中间花瓶（欢迎语和 NO.01 之间） */}
        <img
          src="/assets/lab/gallery-vase.webp"
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none object-contain"
          style={{ left: 1820 - archLeft, top: 479, width: 168, height: 247 }}
        />

        {/* NO.01 号码牌（挂在画框左上方） */}
        <div className="absolute" style={{ left: 1910 - archLeft, top: 140 }}>
          <GhostNumber n={1} />
        </div>

        {/* NO.01 作品集群：壁灯 + 金框 + 说明牌，可点开详情 */}
        <motion.div
          className="absolute"
          style={{
            pointerEvents: pe,
            left: 2000 - archLeft,
            top: 120,
            width: FRAME.w + 60,
            height: 520,
          }}
        >
          <button
            type="button"
            onClick={() => {
              playNavigate();
              onOpen(first);
            }}
            onMouseEnter={() => setArtHover(true)}
            onMouseLeave={() => setArtHover(false)}
            aria-label={`${first.title.zh} / ${first.title.en}`}
            className="absolute inset-0 block cursor-pointer"
            style={{
              transform: artHover ? "scale(1.025)" : "scale(1)",
              transition: "transform 0.35s ease",
            }}
          >
          <img
            src="/assets/lab/gallery-frame-01.webp"
            alt=""
            draggable={false}
            className="absolute select-none"
            style={{
              left: 40,
              top: 112,
              width: FRAME.w,
              height: FRAME.h,
              filter: artHover ? "brightness(1.08)" : "brightness(1)",
              transition: "filter 0.35s ease",
            }}
          />
          <div
            className="absolute"
            style={{ left: 20, top: 12, width: LAMP.w, height: LAMP.h }}
          >
            <WallLamp hover={artHover} width={LAMP.w} height={LAMP.h} />
          </div>
          <img
            src="/assets/lab/gallery-plaque-01.webp"
            alt=""
            draggable={false}
            className="absolute select-none"
            style={{ left: 113, top: 380, width: PLAQUE.w, height: PLAQUE.h }}
          />
        </button>
        </motion.div>
      </div>
      </motion.div>

      {/* 右段：拱门右侧补墙 */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{ opacity, ...seg(archRight - 2, ENTRANCE_W - archRight + 2) }}
      >
        <div className="absolute inset-0" style={{ background: WALL_RUST }} />
        {/* 假 3D 地板条：与拱门段砖纹连续 */}
        <FloorStrip offset={archRight - 2 + 120} width={ENTRANCE_W - archRight + 2} />
        <div
          className="absolute left-0 right-0 bg-black"
          style={{ top: WALL_EXT + WALL_SHIFT + SKIRT_Y, height: SKIRT_H }}
        />
      </motion.div>
    </>
  );
}

/* ---------------- 单面展墙 ---------------- */

function GalleryWall({
  camZ,
  order,
  project,
  onOpen,
}: {
  camZ: MotionValue<number>;
  /** 走廊里第几面墙（0 起），对应项目 labProjects[order + 1] */
  order: number;
  project: LabProject;
  onOpen: (project: LabProject) => void;
}) {
  const z = ENTRY + order * GAP;
  const opacity = useTransform(
    camZ,
    [z - 4200, z - 2000, z - 170, z - 70],
    [0, 1, 1, 0],
  );
  const pe = useTransform(opacity, (o) =>
    o > 0.5 ? ("auto" as const) : ("none" as const),
  );
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        opacity,
        width: WALL_W,
        height: WALL_H + WALL_EXT,
        transform: `translate3d(-50%, ${WALL_TOP_Y}px, ${-z}px)`,
      }}
    >
      {/* 顶部延伸补墙 */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0"
        style={{ height: WALL_EXT + ARCH_TOP + 1, background: WALL_RUST }}
      />
      {/* 切图右侧补墙 + 墙脚黑线（切图洞中心对准走廊轴线后右端差一截） */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: WALL_W / 2 - ARCH_HOLE_CX + ARCH_IMG_W - 2,
          right: 0,
          top: WALL_EXT + ARCH_TOP,
          bottom: 0,
          background: WALL_RUST,
        }}
      />
      <div
        className="pointer-events-none absolute bg-black"
        style={{
          left: WALL_W / 2 - ARCH_HOLE_CX + ARCH_IMG_W - 2,
          right: 0,
          top: WALL_EXT + SKIRT_Y,
          height: SKIRT_H,
        }}
      />
      <img
        src="/assets/lab/gallery-arch.webp"
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none"
        style={{
          left: WALL_W / 2 - ARCH_HOLE_CX,
          top: WALL_EXT + ARCH_TOP,
          width: ARCH_IMG_W,
          height: ARCH_IMG_H,
        }}
      />

      {/* 内层内容（0..760 坐标系） */}
      <div
        className="absolute left-0"
        style={{ top: WALL_EXT, width: WALL_W, height: WALL_H }}
      >
        {/* 画框下方的花瓶 */}
        <img
          src="/assets/lab/gallery-vase.webp"
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none object-contain"
          style={{ left: 80, top: 479, width: 168, height: 247 }}
        />

        <motion.div
          className="absolute"
          style={{
            pointerEvents: pe,
            left: LAMP.x - 20,
            top: LAMP.y - 12,
            width: FRAME.w + 60,
            height: PLAQUE.y + PLAQUE.h - LAMP.y + 24,
          }}
        >
          <button
            type="button"
            onClick={() => {
              playNavigate();
              onOpen(project);
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            aria-label={`${project.title.zh} / ${project.title.en}`}
            className="absolute inset-0 block cursor-pointer"
            style={{
              transform: hover ? "scale(1.025)" : "scale(1)",
              transition: "transform 0.35s ease",
            }}
          >
            <img
              src="/assets/lab/gallery-frame-01.webp"
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                left: FRAME.x - LAMP.x + 20,
                top: FRAME.y - LAMP.y + 12,
                width: FRAME.w,
                height: FRAME.h,
                filter: hover ? "brightness(1.08)" : "brightness(1)",
                transition: "filter 0.35s ease",
              }}
            />
            <div
              className="absolute"
              style={{ left: 20, top: 12, width: LAMP.w, height: LAMP.h }}
            >
              <WallLamp hover={hover} width={LAMP.w} height={LAMP.h} />
            </div>
            <img
              src="/assets/lab/gallery-plaque-01.webp"
              alt=""
              draggable={false}
              className="absolute select-none"
              style={{
                left: PLAQUE.x - LAMP.x + 20,
                top: PLAQUE.y - LAMP.y + 12,
                width: PLAQUE.w,
                height: PLAQUE.h,
              }}
            />
          </button>
        </motion.div>

        {/* NO.0X 号码牌（挂在画框左上方，同设计稿） */}
        <div className="absolute" style={{ left: 120, top: 150 }}>
          <GhostNumber n={order + 2} />
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- 页内详情浮层 ---------------- */

function DetailOverlay({
  project,
  onClose,
}: {
  project: LabProject;
  onClose: () => void;
}) {
  const { t, pick } = useLanguage();

  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="flex h-full items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        aria-label={t("close")}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="absolute inset-0 bg-[#2A1C12]/45 backdrop-blur-[2px]"
      />
      <motion.article
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-detail-title"
        tabIndex={-1}
        ref={cardRef}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="relative z-10 max-h-[86vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[#F7F1E6] px-6 py-8 shadow-2xl outline-none sm:px-10"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.33, 1, 0.68, 1] }}
      >
        <button
          type="button"
          data-lab-detail-close=""
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-4 top-4 text-sm text-neutral-400 transition hover:text-neutral-700"
        >
          {t("close")}
        </button>
        <h1
          id="lab-detail-title"
          className="font-hand pr-12 text-3xl text-neutral-800"
        >
          {pick(project.title)}
        </h1>
        <p className="mt-2 text-neutral-500">{pick(project.description)}</p>

        {project.process && (
          <section className="mt-10">
            <h2 className="font-hand text-xl text-neutral-800">
              {t("lab.process")}
            </h2>
            <ol className="mt-5 space-y-6">
              {project.process.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-hand mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-sm text-neutral-500">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-hand text-lg text-neutral-700">
                      {pick(step.title)}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                      {pick(step.text)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {project.product && (
          <section className="mt-10">
            <h2 className="font-hand text-xl text-neutral-800">
              {t("lab.product")}
            </h2>
            <div className="mt-4 flex h-48 items-center justify-center rounded-xl bg-neutral-200/70">
              <img
                src={project.product.image}
                alt=""
                className="h-28 w-28 object-contain opacity-60"
              />
            </div>
            <p className="mt-2 text-center text-sm text-neutral-500">
              {pick(project.product.caption)}
            </p>
          </section>
        )}

        {project.download && (
          <section className="mt-10">
            <h2 className="font-hand text-xl text-neutral-800">
              {t("lab.download")}
            </h2>
            <div className="mt-4 rounded-xl border-2 border-dashed border-neutral-300 p-5 text-center">
              <p className="font-hand text-lg text-neutral-700">
                {pick(project.download.label)}
              </p>
              <span className="mt-3 inline-block rounded-full bg-neutral-200 px-5 py-1.5 text-sm text-neutral-400">
                {t("lab.download.cta")}
              </span>
            </div>
          </section>
        )}
      </motion.article>
    </div>
  );
}

/* ---------------- 开场动画 ---------------- */

/** 大油画切图尺寸与"画芯"（金框内的灰色衬底）在切图内的矩形，用于全屏铺满换算 */
const INTRO_IMG = { w: 1147, h: 1249 };
const INTRO_INNER = { x: 189, y: 153, w: 794, h: 882 };

type IntroRect = { left: number; top: number; width: number; height: number };

/**
 * 开场全屏矩形：把"画芯"放大到刚好铺满视口（金框被推到屏幕外），
 * 缩小归位时金框才逐渐进入视野——对应参考站邮票齿孔边框长出来的效果。
 */
function introBigRect(): IntroRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  /* 1.04 轻微过扫，保证手绘画芯的不规则边缘不露出黑底 */
  const s = Math.max(vw / INTRO_INNER.w, vh / INTRO_INNER.h) * 1.04;
  return {
    left: vw / 2 - (INTRO_INNER.x + INTRO_INNER.w / 2) * s,
    top: vh / 2 - (INTRO_INNER.y + INTRO_INNER.h / 2) * s,
    width: INTRO_IMG.w * s,
    height: INTRO_IMG.h * s,
  };
}

/** 开场文字阴影（叠在虚化画面上保证可读） */
const INTRO_TEXT_SHADOW = "0 2px 26px rgba(0,0,0,0.55)";

const INTRO_FILTER_DARK = "brightness(0.45) blur(16px)";
const INTRO_FILTER_LIT = "brightness(1) blur(0px)";

/**
 * 进入 Lab 页的开场（每次进入都播放），复刻参考站的节奏：
 * 油画画芯全屏铺满、压暗且虚化 → 文字叠在画面上亮出 → 文字渐隐 →
 * 画面由暗转亮、模糊散开 → 全屏画面缩小归位到墙面陈列位
 * （金框随缩小进入视野），黑幕同时揭开。
 * 点击任意处跳过；系统开启"减少动态"时直接跳过。
 */
function LabIntro({ onDone }: { onDone: () => void }) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [phase, setPhase] = useState<
    "text" | "fade" | "bright" | "shrink" | "skip"
  >("text");
  const [big] = useState<IntroRect>(() => introBigRect());
  const [target, setTarget] = useState<IntroRect | null>(null);
  const timers = useRef<number[]>([]);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    if (reduced) {
      finish();
      return;
    }
    /* 播放期间锁定滚动 */
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const at = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms));
    };
    /* 顺序：文字停留 → 文字先渐隐 → 画面再亮起、模糊散开 → 缩小归位 */
    at(3200, () => setPhase("fade"));
    at(3800, () => setPhase("bright"));
    at(5300, () => {
      /* 量取场景内油画当前的投影屏幕矩形作为归位目标 */
      const el = document.getElementById("lab-entrance-painting");
      if (el) setTarget(el.getBoundingClientRect());
      setPhase("shrink");
      /* 收尾在缩小真正开始后再计时：飞行 1.1s + 黑幕揭开的尾巴 */
      at(1400, finish);
    });

    return () => {
      document.documentElement.style.overflow = prev;
      timers.current.forEach(window.clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduced) return null;

  const skip = () => {
    if (phase === "skip") return;
    timers.current.forEach(window.clearTimeout);
    setPhase("skip");
    timers.current.push(window.setTimeout(finish, 280));
  };

  const textVisible = phase === "text";
  const lit = phase === "bright" || phase === "shrink";

  /* 文字行进出场动画（按块错峰入场，退场整组同步） */
  const lineAnim = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: textVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 },
    transition: textVisible
      ? { duration: 0.7, delay, ease: "easeOut" as const }
      : { duration: 0.5, ease: "easeIn" as const },
  });

  return (
    <motion.div
      className="fixed inset-0 z-50 cursor-pointer"
      data-intro="1"
      onPointerDown={skip}
      animate={phase === "skip" ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.26, ease: "easeOut" }}
    >
      {/* 黑幕：缩小归位时揭开 */}
      <motion.div
        className="absolute inset-0 bg-black"
        animate={{ opacity: phase === "shrink" ? 0 : 1 }}
        transition={{ duration: 0.9, delay: phase === "shrink" ? 0.15 : 0, ease: "easeInOut" }}
      />

      {/* 大油画：从第一帧就全屏铺满（压暗+虚化），文字退场后亮起，再缩小归位 */}
      <motion.img
        src="/assets/lab/gallery-painting-big.webp"
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        initial={{ ...big, filter: INTRO_FILTER_DARK }}
        animate={
          phase === "shrink" && target
            ? {
                left: target.left,
                top: target.top,
                width: target.width,
                height: target.height,
                filter: INTRO_FILTER_LIT,
              }
            : { ...big, filter: lit ? INTRO_FILTER_LIT : INTRO_FILTER_DARK }
        }
        transition={
          phase === "shrink"
            ? { duration: 1.1, ease: [0.65, 0, 0.35, 1] }
            : { filter: { duration: 1.4, ease: "easeInOut" } }
        }
      />

      {/* 开场文字：主组作为一个居中排版块（行距与字号同源 vw，
          任何窗口比例下间距比例都与设计稿一致），底部介绍单独锚定底边 */}
      <div
        className="pointer-events-none absolute inset-x-0 flex flex-col items-center text-center"
        style={{ top: "45.6vh", transform: "translateY(-50%)" }}
      >
        <motion.p
          className="font-title text-[#FFF1C2]"
          style={{
            fontSize: "1.7vw",
            letterSpacing: "0.1em",
            lineHeight: 1.3,
            textShadow: INTRO_TEXT_SHADOW,
          }}
          {...lineAnim(0.35)}
        >
          WELCOME TO THE
        </motion.p>
        <motion.p
          className="font-title text-[#FFF1C2]"
          style={{
            fontSize: "5vw",
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            marginTop: "0.7vw",
            textShadow: INTRO_TEXT_SHADOW,
          }}
          {...lineAnim(0.6)}
        >
          WOOLAB SHEEP
          <br />
          GALLERY
        </motion.p>
        <motion.p
          className="font-title text-[#FFF1C2]"
          style={{
            fontSize: "1.8vw",
            letterSpacing: "0.1em",
            lineHeight: 1.3,
            marginTop: "0.5vw",
            textShadow: INTRO_TEXT_SHADOW,
          }}
          {...lineAnim(0.9)}
        >
          THINGS MADE WITH A SHEEP
        </motion.p>
      </div>
      <motion.p
        className="pointer-events-none absolute inset-x-0 text-center font-title text-[#FFF1C2]"
        style={{
          bottom: "10.3vh",
          fontSize: "1.35vw",
          letterSpacing: "0.04em",
          lineHeight: 1.4,
          textShadow: INTRO_TEXT_SHADOW,
        }}
        {...lineAnim(1.2)}
      >
        A small gallery of WOOLAB sheep goods,
        <br />
        objects and illustrations.
        <br />
        Walk through and take a closer look.
      </motion.p>
    </motion.div>
  );
}

/* ---------------- 页面 ---------------- */

export default function LabPage() {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: scrollRef });

  const camX = useTransform(scrollYProgress, [0, PAN_RATIO, 1], [PAN, 0, 0]);
  const camZ = useTransform(
    scrollYProgress,
    [0, PAN_RATIO, 0.94, 1],
    [0, 0, CAM_END, CAM_END],
  );

  const intro = useMotionValue(-160);
  useEffect(() => {
    window.scrollTo(0, 0);
    const controls = animate(intro, 0, { duration: 0.9, ease: "easeOut" });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const camAllZ = useTransform([camZ, intro], (v: number[]) => v[0] + v[1]);
  const worldTransform = useMotionTemplate`translate3d(${camX}px, 0px, ${camAllZ}px)`;
  /* 地板纹理贴片：抵消世界平移，让贴片固定在相机前方的地面上 */
  const negCamX = useTransform(camX, (v) => -v);
  const floorPatchZ = useTransform(camAllZ, (v) => 401 - v);
  const floorPatchTransform = useMotionTemplate`translate3d(calc(-50% + ${negCamX}px), ${FLOOR_Y - 1}px, ${floorPatchZ}px) rotateX(-90deg)`;

  /** 横向段隐藏走廊侧墙，避免侧墙在画面中间形成"围挡"；推进时再淡入 */
  const sideWallOpacity = useTransform(
    scrollYProgress,
    [PAN_RATIO - 0.015, PAN_RATIO + 0.05],
    [0, 1],
  );
  /** 横向段用入口墙上的"假 3D"地板条（与设计稿一致），真 3D 地面藏起；
      穿过拱门推进时两者交叉淡化 */
  const floorOpacity = useTransform(camZ, [10, 140], [0, 1]);

  const [active, setActive] = useState(0);
  const [introPlaying, setIntroPlaying] = useState(true);
  const [open, setOpen] = useState<LabProject | null>(null);
  const blockOpen = useRef(false);
  const openProject = (project: LabProject) => {
    if (blockOpen.current) return;
    setOpen(project);
  };
  const closeProject = () => {
    blockOpen.current = true;
    setOpen(null);
    window.setTimeout(() => {
      blockOpen.current = false;
    }, 400);
  };

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (p < PAN_RATIO) {
      setActive(0);
      return;
    }
    const z = ((p - PAN_RATIO) / (1 - PAN_RATIO)) * CAM_END;
    const i = Math.min(
      N_WALLS - 1,
      Math.max(0, Math.round((z - ENTRY + 500) / GAP)),
    );
    setActive(i + 1);
  });

  return (
    <div
      ref={scrollRef}
      className="relative"
      data-lab-open={open ? open.id : ""}
      style={{ height: `calc(${SCROLL_LEN}px + 100vh)` }}
    >
      <div
        className="sticky top-0 h-screen overflow-hidden"
        style={{
          perspective: `${PERSPECTIVE}px`,
          perspectiveOrigin: "50% 46%",
          background: FLOOR_CREAM,
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            transform: worldTransform,
          }}
        >
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{
              opacity: sideWallOpacity,
              width: DEPTH,
              height: FLOOR_Y - WALL_TOP_Y,
              transform: `translate3d(${-WALL_X}px, ${WALL_TOP_Y}px, 400px) rotateY(90deg)`,
              transformOrigin: "left center",
              background: SIDE_RUST,
            }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{
              opacity: sideWallOpacity,
              width: DEPTH,
              height: FLOOR_Y - WALL_TOP_Y,
              transform: `translate3d(${WALL_X}px, ${WALL_TOP_Y}px, 400px) rotateY(90deg)`,
              transformOrigin: "left center",
              background: SIDE_RUST,
            }}
          />
          {/* 真 3D 地面从入口墙之后才开始：横向段地面由墙上的"假 3D"砖纹条呈现，
              门洞里则透出这块真地面的透视 */}
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: Math.max(WALL_W, ENTRANCE_W),
              height: DEPTH + 14,
              transform: `translate3d(-50%, ${FLOOR_Y}px, ${-ENTRANCE_Z - 6}px) rotateX(-90deg)`,
              transformOrigin: "center top",
              background: FLOOR_CREAM,
            }}
          />
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: Math.max(WALL_W, ENTRANCE_W),
              height: DEPTH + 600,
              transform: `translate3d(-50%, ${WALL_TOP_Y}px, 400px) rotateX(-90deg)`,
              transformOrigin: "center top",
              background: "#F4EDDE",
            }}
          />

          <div
            className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center"
            style={{
              width: WALL_W,
              height: FLOOR_Y - WALL_TOP_Y + 40,
              transform: `translate3d(-50%, ${WALL_TOP_Y}px, ${-WALL_Z}px)`,
              background: "#CBC9C2",
            }}
          >
            <div className="flex h-64 w-44 items-center justify-center rounded-t-full border-2 border-dashed border-neutral-400/70 bg-white/40">
              <span className="font-hand text-xl text-neutral-500">
                {t("lab.gallery.exit")}
              </span>
            </div>
            <p className="mt-4 text-xs text-neutral-400">
              {t("lab.gallery.wip")}
            </p>
          </div>

          {labProjects.slice(1).map((p, i) => (
            <GalleryWall
              key={p.id}
              camZ={camZ}
              order={i}
              project={p}
              onOpen={openProject}
            />
          ))}
          {/* 相机附近的地板纹理贴片：大地板保持纯色（纯色层无光栅成本），
              纹理只铺近处并向四周渐隐——整条走廊铺纹理会撑爆 GPU 瓦片内存导致墙面丢块。
              在世界容器内用相机量反向补偿，使贴片始终跟随相机并被墙体正确遮挡；
              噪点无方向特征，纹理不随行走滚动也无法察觉 */}
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{
              opacity: floorOpacity,
              width: 2600,
              height: 2600,
              transform: floorPatchTransform,
              transformOrigin: "center top",
              background: "url(/assets/lab/gallery-floor.webp) repeat",
              maskImage:
                "radial-gradient(ellipse 70% 75% at 50% 12%, black 55%, transparent 96%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 70% 75% at 50% 12%, black 55%, transparent 96%)",
            }}
          />
          {/* 入口墙后画：横向段盖住走廊，门洞才透出后面的展墙 */}
          <EntranceWall
            camZ={camZ}
            onOpen={openProject}
            paintingHidden={introPlaying}
          />
        </motion.div>

        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {Array.from({ length: N_WALLS + 1 }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full border border-white/50 transition ${
                i === active ? "bg-[#FFF6E4]" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      </div>

      {introPlaying && <LabIntro onDone={() => setIntroPlaying(false)} />}

      {open && (
        <div className="fixed inset-0 z-50">
          <DetailOverlay project={open} onClose={closeProject} />
        </div>
      )}
    </div>
  );
}
