# WOOLAB 数据与素材索引

这份文件回答“内容在哪里改、素材从哪里来”。架构和交互约束见 `CODEX_HANDOFF.md`。

## 内容数据

- `src/i18n/dict.ts`
  - 全局界面文案、导航、按钮和提示。
  - 必须同时维护 `zh`、`en`，键名由 `DictKey` 约束。
- `src/data/aboutShots.ts`
  - About 五张拍立得的图片、标题与中英文说明。
- `src/data/contact.ts`
  - Contact 邮箱、社交平台及链接。
- `src/data/drinks.ts`
  - Life 调酒瓶、配方选择、成品名称和素材映射。
- `src/data/heroHotspots.ts`
  - 首页可点击热点、提示、坐标和目标路由。
- `src/data/labs.ts`
  - Lab 四个项目的标题、介绍、过程、产品信息、下载内容和详情素材。
  - 正式 `/lab` Overlay 与遗留 `/lab/:projectId` 都会读取其中一部分数据。
- `src/data/lifeStations.ts`
  - Life 四个任务的名称、清单文案、位置与完成判断。
- `src/data/news.ts`
  - News 内容及已读状态；目前不在主导航。
- `src/data/stories.ts`
  - Stories 系列与文章；目前多数为保留内容。
- `src/data/characters.ts`
  - 遗留 Characters 数据；页面当前没有路由。

## 坐标与图层数据

- `src/data/seg01Layers.ts`：Life 衣帽区
- `src/data/seg02Layers.ts`：Life 起居/创作区
- `src/data/seg03Layers.ts`：Life 厨房、蜡烛和 Lab 门
- `src/components/HeroScene.tsx`：首页 1440×900 精确场景与动画坐标
- `src/pages/AboutPage.tsx`：About 相机与拍立得布局
- `src/pages/ContactPage.tsx`：信封、信纸、电话布局
- `src/pages/LabPage.tsx`：Lab 走廊透视、站位与画框配置
- `src/pages/LabDetail.tsx`：Lab 详情首屏、底部画框墙及产品表布局

这些坐标不是普通响应式占位值。改素材尺寸、裁边或画布比例时，要同步校准坐标、遮罩、命中区和手机布局。

## 资源与预载清单

- `src/data/lifeAssets.ts`
  - Life 图片预载清单，由 `scripts/gen-life-assets.py` 生成。
  - 修改 `public/assets/life/` 后运行 `npm run assets:life`。
- `src/data/pageAssets.ts`
  - About、Contact、Lab 等跨页首屏预热。
- `src/components/life/preload.ts`
  - Life 分批下载、解码、缓存与手机释放策略。
- `src/components/lab/preload.ts`
  - Lab 公共资源和按项目详情预热。
- `index.html`
  - 电视框、首屏字体和首页底图的 HTML preload。

资源路径变更时必须搜索旧路径，并检查以上所有预载入口。构建只检查 TypeScript，不保证静态文件真实存在。

## 运行时素材目录

- `public/assets/`
  - 首页公共素材、Logo 与旧地图资源
- `public/assets/about/`
  - 相机、拍立得和照片
- `public/assets/audio/`
  - 首页环境音、Life 音乐、电话和短音效
- `public/assets/contact/`
  - Contact 信件、电话和社交图形
- `public/assets/fonts/`
  - 中文手写子集、英文字体与 DM Sans
- `public/assets/lab/`
  - 走廊、展品、尽头门与四个项目详情
- `public/assets/life/`
  - 三段房间、任务素材和四套逐帧动画
- `public/assets/menu/`
  - 吊牌菜单、绳、贴纸与图标
- `public/assets/mobile/`
  - 旧 Mobile Gate
- `public/assets/stories/`
  - Stories 保留封面
- `public/og.jpg`
  - 社交分享图

当前运行时资源约 26 MiB，以 WebP 为主。Life 数量最多；性能瓶颈主要是浏览器解码后的 RGBA/GPU 内存，不只是网络压缩体积。

## 生成素材与原始素材

- `网站素材/`
  - 原始设计与补充素材档案，约 115 MiB。
  - 不被 Vite 直接引用，但保留了重新导出和校准所需源文件。
- `exports/`
  - Figma 截图、英文提交包和操作视频。
  - 不参与网站，不进入 Git；大视频超过 GitHub 普通 Git 单文件限制。
- `dist/`
  - `npm run build` 的生成结果，不进入 Git。

不要把原始素材路径直接写进应用。网站只应引用 `public/assets/` 中经过处理的运行时版本。

## 全局配置与运行数据

- `src/config.ts`
  - 开场开关、身份卡开关和遗留 Mobile Map 配置。
- `src/timeOfDay.ts`
  - 本地时间到 dawn/day/dusk/night 的映射。
- `src/weather.ts`
  - 晴雨查询、URL 强制值、session 缓存与随机兜底。
- `api/weather.ts`
  - Vercel 访客位置到 Open-Meteo 的服务端查询。
- `src/state/roomState.ts`
  - Life 任务状态结构、读取和持久化。
- `src/state/intro.ts`
  - 开场 session key 与离场事件。
- `src/state/chrome.ts`
  - 顶栏颜色、Logo 和页面覆盖层状态。
- `src/audio/sfx.ts`
  - 音频文件、时间点、环境音切换和静音状态。

## 遗留但仍在仓库的内容

- `src/components/MapNav.tsx`
- `src/data/mapLocations.ts`
- `public/assets/map-bg.svg`
- `public/assets/map-portrait.svg`
- `src/pages/CharactersPage.tsx`
- `src/pages/DownloadsPage.tsx`
- `src/pages/LabProjectPage.tsx`
- `src/components/MobileGate.tsx`

这些文件不等于都可以删除：部分仍可通过直达路由或调试参数使用。删除前要先做引用搜索并确认产品不再需要旧方案。
