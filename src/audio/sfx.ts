/**
 * 轻量音效模块：基本都用 Web Audio 现场合成；只有背景环境音和电话里那句「hello?」是音频文件。
 * - 浏览器要求用户先有点击/按键等手势才允许出声，
 *   模块会在第一次手势时自动解锁；解锁前的音效静默跳过。
 * - 静音状态存在 localStorage，全站共享。
 */

const STORAGE_KEY = "woolab-sfx-muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

let muted = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1";

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
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
function tone(type: OscillatorType, f0: number, f1: number, duration: number, volume: number, startAt = 0) {
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

/* ------------------------------------------------------------------ */
/* About 页拍立得                                                        */
/* ------------------------------------------------------------------ */

/** 一段带包络的滤波噪声：type/频率滑动/音量曲线都可调，出片、落纸都靠它 */
function noise(
  dur: number,
  filterType: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  envelope: (p: number) => number,
  volume: number,
  startAt = 0,
) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + startAt;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * envelope(i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

/** 快门：两下极短的机械"咔"叠一点低频的"咚" */
export function playShutter() {
  if (!ready()) return;
  click(0.55);
  tone("square", 1800, 900, 0.03, 0.1, 0.004);
  click(0.4, 0.055);
  tone("triangle", 160, 90, 0.09, 0.22, 0.05);
}

/** 出片：约 1s 的马达"嗞——"，带滚轮的颗粒感，尾巴收掉 */
export function playEject(dur = 1.0) {
  if (!ready()) return;
  if (!ctx || !master) return;
  // 马达嗡嗡：低频锯齿 + 微微抖
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(95, t);
  osc.frequency.linearRampToValueAtTime(82, t + dur);
  lfo.type = "sine";
  lfo.frequency.value = 27;
  lfoGain.gain.value = 6;
  lfo.connect(lfoGain).connect(osc.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.09, t + 0.06);
  gain.gain.setValueAtTime(0.09, t + dur * 0.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp).connect(gain).connect(master);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + dur + 0.02);
  lfo.stop(t + dur + 0.02);
  // 滚轮摩擦相纸的沙沙
  noise(
    dur,
    "bandpass",
    2600,
    1900,
    0.9,
    (p) => Math.sin(Math.min(p / 0.12, 1) * (Math.PI / 2)) * (1 - Math.max(0, (p - 0.75) / 0.25)),
    0.11,
  );
}

/** 落纸：相纸松开时轻轻一"啪"，接一小段纸片飘下的"呼" */
export function playPhotoDrop() {
  if (!ready()) return;
  click(0.3);
  tone("sine", 210, 130, 0.07, 0.12, 0.004);
  noise(0.45, "bandpass", 900, 380, 0.8, (p) => Math.sin(p * Math.PI) ** 1.4, 0.13, 0.05);
}

/* ------------------------------------------------------------------ */
/* Contact 页电话                                                        */
/* ------------------------------------------------------------------ */

/** 对面那句「hello?」：真人录音（ElevenLabs），过一遍电话线路滤波 */
const HELLO_SRC = "/assets/audio/phone-hello.mp3";
/** 录音里人声从 0.18s 开始、1.38s 结束；从这儿开始放，正好在 helloAt 出声 */
const HELLO_OFFSET = 0.12;
const HELLO_DUR = 1.3;

/** 拿起电话后的节拍（秒），页面上听筒的抖动 / 气泡文字按这个对时 */
export const PHONE = {
  /** 「嘟——」开始 / 结束 */
  ringAt: 0.18,
  ringEnd: 1.15,
  /** 对面那句「hello?」开始 / 结束 */
  helloAt: 1.6,
  helloEnd: 1.6 + HELLO_DUR,
} as const;

let helloBuf: AudioBuffer | null = null;
let helloLoading: Promise<void> | null = null;

/** 提前把那句 hello 拉下来解码好（Contact 页挂上来时调一次）；没解码好就退回合成的两个音节 */
export function preloadPhoneHello() {
  if (helloBuf || helloLoading) return;
  ensureContext();
  const c = ctx;
  if (!c) return;
  helloLoading = fetch(HELLO_SRC)
    .then((r) => r.arrayBuffer())
    .then((b) => c.decodeAudioData(b))
    .then((buf) => {
      helloBuf = buf;
    })
    .catch(() => {
      helloLoading = null;
    });
}

/** 电话线路那种 300–3400Hz 的窄带：所有从听筒里传出来的声音都先过这一层 */
function phoneLine(): AudioNode | null {
  if (!ctx || !master) return null;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 320;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  hp.connect(lp).connect(master);
  return hp;
}

/**
 * 一个闷在听筒里的音节：锯齿波当声带，两个带通当口腔共鸣（F1 / F2），
 * 音高从 p0 滑到 p1，音量按 sin 包络起落。听着像电话另一头有人在说话，但听不清词。
 */
function syllable(
  out: AudioNode,
  startAt: number,
  dur: number,
  p0: number,
  p1: number,
  f1: number,
  f2: number,
  volume: number,
) {
  if (!ctx) return;
  const t = ctx.currentTime + startAt;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(p0, t);
  osc.frequency.exponentialRampToValueAtTime(p1, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + dur * 0.25);
  gain.gain.setValueAtTime(volume, t + dur * 0.55);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [f, q, g] of [
    [f1, 6, 1],
    [f2, 8, 0.55],
  ] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = q;
    const fg = ctx.createGain();
    fg.gain.value = g;
    osc.connect(bp).connect(fg).connect(gain);
  }
  gain.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/**
 * 拿起电话：听筒离座的一下"咔"，线路里一声「嘟——」（450Hz 回铃音），
 * 停一拍，对面传来一句闷闷的「hel-lo?」（两个音节，尾音上扬）。
 */
export function playPhonePickup() {
  if (!ready()) return;
  if (!ctx || !master) return;
  const line = phoneLine();
  if (!line) return;
  // 听筒离座
  click(0.3);
  tone("triangle", 760, 420, 0.05, 0.07, 0.01);
  // 嘟——：450Hz 基音 + 一点二次谐波，起落各 30ms，中间恒定
  const t = ctx.currentTime + PHONE.ringAt;
  const dur = PHONE.ringEnd - PHONE.ringAt;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.11, t + 0.03);
  gain.gain.setValueAtTime(0.11, t + dur - 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [f, g] of [
    [450, 1],
    [900, 0.18],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const og = ctx.createGain();
    og.gain.value = g;
    osc.connect(og).connect(gain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  gain.connect(line);
  // 线路底噪：嘟声期间一点沙沙
  noise(dur + 0.1, "bandpass", 1800, 1600, 0.6, () => 1, 0.012, PHONE.ringAt - 0.05);
  // hel- lo?
  const a = PHONE.helloAt;
  if (helloBuf) {
    const src = ctx.createBufferSource();
    src.buffer = helloBuf;
    const g = ctx.createGain();
    g.gain.value = 1.4;
    src.connect(g).connect(line);
    src.start(ctx.currentTime + a, HELLO_OFFSET);
    return;
  }
  syllable(line, a, 0.2, 200, 178, 560, 1700, 0.5);
  syllable(line, a + 0.24, PHONE.helloEnd - a - 0.24, 172, 262, 480, 1250, 0.45);
}
