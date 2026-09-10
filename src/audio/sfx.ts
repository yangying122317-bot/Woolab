/**
 * 轻量音效模块：全部用 Web Audio 现场合成，无音频文件。
 * - 浏览器要求用户先有点击/按键等手势才允许出声，
 *   模块会在第一次手势时自动解锁；解锁前的音效静默跳过。
 * - 静音状态存在 localStorage，全站共享。
 */

const STORAGE_KEY = "woolab-sfx-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

let muted =
  typeof localStorage !== "undefined" &&
  localStorage.getItem(STORAGE_KEY) === "1";

/** 静音状态变化的订阅（给按钮组件用） */
const listeners = new Set<(muted: boolean) => void>();

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  listeners.forEach((fn) => fn(muted));
  syncAmbient();
}

export function onMutedChange(fn: (muted: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function ensureContext() {
  if (ctx) return;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

function unlock() {
  ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  unlocked = true;
  syncAmbient();
}

if (typeof window !== "undefined") {
  // 第一次点击/按键/触摸时解锁音频
  const once = { once: true, capture: true } as const;
  window.addEventListener("pointerdown", unlock, once);
  window.addEventListener("keydown", unlock, once);
  window.addEventListener("touchstart", unlock, once);
}

function ready(): boolean {
  if (muted) return false;
  if (!unlocked) return false;
  ensureContext();
  return !!ctx && ctx.state === "running";
}

/* ------------------------------------------------------------------ */
/* 场景背景音（环境音）                                                  */
/* ------------------------------------------------------------------ */

/**
 * 各场景的背景音。之后首页做不同场景（如夜晚）时，
 * 在这里加一条，再在场景组件里 startAmbient("night") 即可。
 */
const AMBIENTS = {
  day: { src: "/assets/audio/ambient-day.m4a", volume: 0.9 },
  /** 夜晚暂时还是白天那条，只是压低；有了虫鸣/夜风的素材换 src 即可 */
  night: { src: "/assets/audio/ambient-day.m4a", volume: 0.45 },
} as const;

export type AmbientId = keyof typeof AMBIENTS;

/** 当前想要播放的场景背景音（null = 不播） */
let ambientWanted: AmbientId | null = null;
let ambientAudio: HTMLAudioElement | null = null;
let ambientFade: ReturnType<typeof setInterval> | undefined;

/** 把背景音音量渐变到目标值，到 0 时暂停 */
function fadeAmbientTo(target: number, ms: number) {
  if (!ambientAudio) return;
  clearInterval(ambientFade);
  const audio = ambientAudio;
  const from = audio.volume;
  const start = Date.now();
  ambientFade = setInterval(() => {
    const k = Math.min((Date.now() - start) / ms, 1);
    audio.volume = from + (target - from) * k;
    if (k === 1) {
      clearInterval(ambientFade);
      if (target === 0) audio.pause();
    }
  }, 50);
}

/**
 * 让实际播放状态跟上「想播什么 + 是否静音 + 是否已解锁」。
 * 浏览器要求先有用户手势才能出声，解锁前先记下想播的场景，
 * 解锁（第一次点击/触摸）时会自动补播。
 */
function syncAmbient() {
  const spec = ambientWanted ? AMBIENTS[ambientWanted] : null;

  if (!spec || muted || !unlocked) {
    if (ambientAudio && !ambientAudio.paused) fadeAmbientTo(0, 600);
    return;
  }

  if (!ambientAudio || !ambientAudio.src.endsWith(spec.src)) {
    ambientAudio?.pause();
    ambientAudio = new Audio(spec.src);
    ambientAudio.loop = true;
    ambientAudio.volume = 0;
  }
  if (ambientAudio.paused) {
    void ambientAudio.play().catch(() => {});
  }
  fadeAmbientTo(spec.volume, 1500);
}

/** 进入场景时调用：淡入该场景的背景音（自动等待音频解锁） */
export function startAmbient(id: AmbientId) {
  ambientWanted = id;
  syncAmbient();
}

/** 离开场景时调用：淡出并停止背景音 */
export function stopAmbient() {
  ambientWanted = null;
  syncAmbient();
}

/* ------------------------------------------------------------------ */
/* 交互音效                                                             */
/* ------------------------------------------------------------------ */

/** 一段简单的振荡器音符：频率从 f0 滑到 f1，音量快速衰减 */
function tone(
  type: OscillatorType,
  f0: number,
  f1: number,
  duration: number,
  volume: number,
  startAt = 0,
) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + startAt;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** 一小段滤波噪声（用于"咔嗒"的质感） */
function click(volume: number, startAt = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + startAt;
  const len = Math.floor(ctx.sampleRate * 0.012);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2500;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

/** 开灯：清脆的"咔嗒" */
export function playLightOn() {
  if (!ready()) return;
  click(0.5);
  tone("square", 2100, 1500, 0.045, 0.12, 0.008);
}

/** 关灯：低一点的轻响 */
export function playLightOff() {
  if (!ready()) return;
  click(0.3);
  tone("square", 1100, 800, 0.04, 0.08, 0.004);
}

/** 邮箱开盖：轻快的"啵" */
export function playMailboxOpen() {
  if (!ready()) return;
  tone("sine", 300, 560, 0.1, 0.22);
}

/** 邮箱合盖 */
export function playMailboxClose() {
  if (!ready()) return;
  tone("sine", 420, 260, 0.08, 0.14);
}

/** 纸片按上软木板：轻轻的"啪嗒" */
export function playPaperSnap() {
  if (!ready()) return;
  click(0.35);
  tone("sine", 230, 150, 0.09, 0.18, 0.006);
}

/** 玻璃门滑开：轻柔的"唰——" */
export function playDoorSlide() {
  if (!ready()) return;
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const dur = 0.5;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // 白噪声整体包一个正弦包络，避免起止有爆音
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(500, t);
  filter.frequency.exponentialRampToValueAtTime(1500, t + dur);
  filter.Q.value = 1.4;
  const gain = ctx.createGain();
  gain.gain.value = 0.28;
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

/** 点击热区进入栏目：柔和的上行提示音 */
export function playNavigate() {
  if (!ready()) return;
  tone("triangle", 520, 780, 0.12, 0.2);
  tone("triangle", 780, 1040, 0.14, 0.16, 0.09);
}

/** 切柠檬：刀落在木板上的"咚咔" */
export function playKnifeChop() {
  if (!ready()) return;
  click(0.5);
  tone("triangle", 170, 90, 0.09, 0.3, 0.004);
  tone("square", 950, 620, 0.03, 0.07);
}

/** 冰块进杯：两声清脆的"叮" */
export function playIceClink() {
  if (!ready()) return;
  tone("triangle", 2400, 1900, 0.07, 0.13);
  tone("triangle", 2900, 2250, 0.06, 0.1, 0.13);
}

/** 倒饮料：一段带气泡感的"咕嘟"水声 */
export function playPour() {
  if (!ready()) return;
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const dur = 1.3;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1500, t);
  filter.frequency.exponentialRampToValueAtTime(650, t + dur);
  const gain = ctx.createGain();
  gain.gain.value = 0.2;
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  // 几声咕嘟气泡
  tone("sine", 320, 520, 0.12, 0.07, 0.15);
  tone("sine", 280, 470, 0.12, 0.06, 0.55);
  tone("sine", 350, 560, 0.12, 0.06, 0.95);
}

/** 浇水：一小股水声 */
export function playWater() {
  if (!ready()) return;
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const dur = 0.55;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, t);
  filter.frequency.exponentialRampToValueAtTime(700, t + dur);
  const gain = ctx.createGain();
  gain.gain.value = 0.22;
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  tone("sine", 480, 340, 0.2, 0.06);
}