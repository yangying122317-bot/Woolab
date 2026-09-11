/** 开场加载页的会话标记 / 离场事件（单独放一份，首页场景和加载页互相引用时不绕圈） */
export const INTRO_SESSION_KEY = "intro-played";

/** 开屏滑开、完全离场时广播；首页的常驻小动作、About 的自动拍照、Life 的进屋都等这一下 */
export const INTRO_DISMISSED_EVENT = "woolab:intro-dismissed";

/** 加载动画的预览路由：底下是首页，开屏不看会话标记、可反复播 */
export const INTRO_PREVIEW_PATH = "/intro";

/** 预览页点 REPLAY 时广播，首页场景把蓝布重新盖上再播一遍 */
export const INTRO_REPLAY_EVENT = "woolab:intro-replay";
