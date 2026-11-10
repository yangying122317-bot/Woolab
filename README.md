# WOOLAB

WOOLAB 是一个中英双语的沉浸式互动网站。首页、Life 房间、Lab 画廊、About 相机和 Contact 信件均有独立动画、音频、触控与 Safari 兼容逻辑。

- 线上地址：<https://woolab.art>
- GitHub：<https://github.com/yangying122317-bot/Woolab>
- 技术栈：React 19、TypeScript、Vite 8、React Router、Framer Motion、Lenis、Tailwind CSS 4

## 本地运行

要求 Node `>=20.19.0`，推荐使用仓库 `.nvmrc` 指定的 Node 22。

```bash
nvm use
npm ci
npm run dev -- --host 0.0.0.0
```

常用命令：

```bash
npm run check       # 类型检查（前端 + 天气 API）并生产构建
npm run preview     # 预览 dist/
npm run assets:life # Life 素材变化后重新生成资源清单
```

项目没有必需环境变量，也没有数据库。`npm run dev` 默认使用 Vite；本地不会运行 Vercel Weather API，首页天气会使用前端兜底。

## 导入 OpenAI Codex

1. 在 Codex 中连接 GitHub。
2. 选择 `yangying122317-bot/Woolab`，分支选择 `main`。
3. Setup command 填写 `npm ci`。
4. 验证命令使用 `npm run check`；需要预览时运行 `npm run dev -- --host 0.0.0.0`。

Codex 会自动读取根目录 `AGENTS.md`。完整架构与已知问题见 `docs/CODEX_HANDOFF.md`，内容和素材位置见 `docs/DATA_MAP.md`。

## 主要路由

- `/`：首页四时段与晴雨场景
- `/life`：横向房间与四项互动任务
- `/about`：拍立得相机与 What's Next
- `/lab`：沉浸式画廊及同页产品详情
- `/contact`：信件、社交链接与电话
- `/stories`、`/news`：保留页面，目前不在主导航中
- `/intro`：首页开场动画预览

## 目录

```text
api/             Vercel Edge 天气函数
public/assets/   网站运行时图片、字体和音频
scripts/         素材清单生成脚本
src/components/  全局及页面交互组件
src/data/        双语内容、图层坐标和资源清单
src/i18n/        语言 Context 与界面字典
src/pages/       页面与 Lab 详情
src/state/       页面外壳、开场及 Life 持久状态
网站素材/        原始设计档案，不参与运行
```

`src/data/lifeAssets.ts` 由脚本生成，不要手动修改。`exports/` 是本地交付文件，不属于应用，也不会提交到 Git。

## 部署

Vercel 使用 `vercel.json`：

- 所有 SPA 深链回写到 `index.html`
- `/api/weather` 根据访客位置请求 Open-Meteo
- 静态资源使用长期缓存
- 旧 Vercel 域名重定向到 `woolab.art`

若部署到其他平台，必须另外配置 SPA fallback，并重写天气函数；仅上传 `dist/` 时网站仍可运行，但天气会走随机兜底。
