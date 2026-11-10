# WOOLAB 开发规则

本文件适用于整个仓库。开始修改前先读 `docs/CODEX_HANDOFF.md`；改内容或素材时再读 `docs/DATA_MAP.md`。

## 环境与命令

- 使用 Node 22（最低 `20.19.0`）与 npm；首次安装运行 `npm ci`。
- 本地开发：`npm run dev -- --host 0.0.0.0`。
- 最低验收：`npm run check`（前端、天气 API 类型检查及生产构建）。
- 预览生产包：`npm run preview -- --host 0.0.0.0`。
- 当前没有自动测试、lint 或格式化命令，不要声称未执行的检查已通过。
- 项目没有必需环境变量；本地 Vite 不运行 Vercel `/api/weather`，天气会走前端兜底。

## 修改原则

- 只改任务要求的范围；未经明确要求，不重做视觉、不“顺手”重构动画或交互。
- 保留已有中文和英文的独立字号、断行、坐标与字体处理，并分别验收。
- 首页必须继续由 `PageShiftProvider` 持久渲染，不能改成普通路由后反复挂载。
- 保留 `{ from: "door" | "menu" | "lab-door" }` 导航状态及页面过渡时序。
- 不删除 `data-lenis-prevent`、拖拽区的 `touch-action: none`、左右 24px 系统返回手势保护。
- 不破坏 Lab 画框 3D Hover、翻面遮罩、底部画框切换、产品名淡入淡出和 history 返回协议。
- 不破坏 Life Tee 的两阶段完成、冰箱 Hover、调酒瓶前后层级与四项任务状态。
- Safari 的资源分批解码、Canvas/ImageBitmap 帧动画、深度钳位和近景卸载是稳定性保护，不可改回全量图片常驻。
- 首次环境音必须在用户手势的同步调用栈中启动；不要先 `await` 再 `play()`。
- 新增中文字符后检查 `hand-zh.woff2` 是否缺字；字体源文件不在仓库内。

## 数据与素材

- 运行时素材位于 `public/assets/`，代码使用 `/assets/...` 绝对路径。
- `src/data/lifeAssets.ts` 是生成文件；素材变化后运行 `npm run assets:life`，不要手改。
- 同名替换静态素材会受缓存影响；优先改文件名，或同步更新版本参数及所有预载引用。
- `网站素材/` 是原始设计档案，不进入运行时；`exports/` 是本地交付物，不得提交。
- 不提交 `dist/`、`node_modules/`、`.env*`、日志或本地缓存。

## 验收

- 所有代码改动至少运行 `npm run check`。
- 路由改动检查直接打开深链；资源改动检查路径、预载清单和生产构建。
- 交互改动至少检查中文/英文、桌面、390px 手机预览（`?mobile=1`）及返回行为。
- 涉及动画、字体、音频、Life 或 Lab 时，必须额外检查 Safari；无法实测时明确说明。
- 不要用构建成功替代浏览器视觉验收。
