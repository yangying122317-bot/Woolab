# 小羊的世界 · 角色展示网站框架

原创角色展示网站的基础框架，不预设视觉风格。首页以角色居住地的地图作为全站导航，所有图片、文案、导航名称均可替换。

## 快速开始

```bash
npm install     # 安装依赖
npm run dev     # 启动开发服务器
npm run build   # 类型检查 + 生产构建（输出到 dist/）
```

技术栈：Vite + React + TypeScript + Tailwind CSS + Framer Motion + React Router。纯静态站点，可直接部署到 Vercel / Netlify。

## 如何替换内容

### 图片素材（`public/assets/`）

| 文件 | 用途 |
| --- | --- |
| `logo.svg` | 站点 logo（页头、开场动画、favicon） |
| `map-bg.svg` | 首页横版地图底图 |
| `map-portrait.svg` | 首页竖版地图底图（移动端地图模式用） |
| `about-hero.svg` | About 页头图 |
| `characters/*.svg` | 角色立绘（建议透明底 PNG/SVG） |
| `stories/*.svg` | 故事系列封面与配图 |
| `lab/*.svg` | 实验室项目配图 |

替换时保持文件路径不变即可；换文件名的话同步修改对应数据文件里的 `image` / `cover` 字段。

### 文案与数据

| 文件 | 内容 |
| --- | --- |
| `src/i18n/dict.ts` | 所有界面文案（站名、导航名称、标题等），中英两份 |
| `src/data/characters.ts` | 角色列表：加一条记录 + 一张图即可新增角色 |
| `src/data/stories.ts` | 故事系列与篇章：详情页模板自动复用 |
| `src/data/labs.ts` | 实验室项目列表：持续追加即可 |
| `src/data/mapLocations.ts` | 地图上各地点的位置（百分比坐标）与路由 |
| `src/pages/AboutPage.tsx` | About 页正文段落 |

所有需要翻译的字段都是 `{ zh: "...", en: "..." }` 结构。

### 全局开关（`src/config.ts`）

- `introEnabled`：是否播放开场动画（每个浏览器会话一次）。开场动画本体在 `src/components/IntroLoader.tsx`，以后可替换为序列帧 / Lottie / 视频。
- `mobileMapMode`：移动端首页地图的形态，`"list"`（默认，列表导航）或 `"map"`（使用竖版地图素材）。

## 目录结构

```
src/
├── components/   # 开场动画、地图导航、内页布局、角色弹窗、语言切换
├── data/         # 角色 / 故事 / 实验室 / 地图地点（数据驱动）
├── i18n/         # 语言字典 + 中英切换 Context
├── pages/        # 首页 + 六个板块页面
└── config.ts     # 全局开关
```
