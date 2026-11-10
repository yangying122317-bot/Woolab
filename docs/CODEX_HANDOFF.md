# WOOLAB · Codex 项目交接

- 最后整理：2026-11-10
- 代码基线：`main` / `7cc64c5`
- 生产站：<https://woolab.art>
- 仓库：<https://github.com/yangying122317-bot/Woolab>

本文是当前实现说明，不是早期策划。Codex 开始任务前还应读取根目录 `AGENTS.md`。

## 1. 直接接入

- Node：推荐 22，最低 `20.19.0`
- 包管理器：npm 10
- 安装：`npm ci`
- 开发：`npm run dev -- --host 0.0.0.0`
- 完整检查：`npm run check`
- 生产预览：`npm run preview -- --host 0.0.0.0`
- 环境变量：无
- 数据库：无
- 外部服务：Open-Meteo，仅由 Vercel `/api/weather` 调用，不需要 Key

Codex Cloud 连接 GitHub 后选择 `yangying122317-bot/Woolab` 的 `main` 分支即可。运行时所需源码与素材都已跟踪；本地 `exports/` 不参与构建。

## 2. 技术栈

- React 19.2
- TypeScript 7，严格模式
- Vite 8
- React Router 7
- Framer Motion 12
- Lenis 1.3
- Tailwind CSS 4（通过 `@tailwindcss/vite`，没有独立 Tailwind 配置）
- Vercel Edge Function

当前没有测试框架、ESLint、Prettier 或 CI。`npm run check` 是最低自动验收，不等于浏览器视觉验收。

## 3. 目录职责

```text
api/weather.ts              Vercel Edge 天气接口
public/assets/              运行时图片、字体、音频
scripts/gen-life-assets.py  生成 Life 资源清单
src/audio/sfx.ts            全站音效、环境音、静音状态
src/components/             全局与页面交互组件
src/components/lab/         Lab 预加载
src/components/life/        Life 房间、任务、预加载和逐帧动画
src/data/                   文案、坐标、项目及资源数据
src/i18n/                   双语字典与 Context
src/pages/                  页面和 Lab 详情
src/state/                  顶栏、开场、Life 持久状态
src/App.tsx                 Provider、路由、拆包和兜底
src/main.tsx                启动与旧 Mobile Gate 分流
src/index.css               全局样式及自托管字体
vercel.json                 SPA 重写、旧域跳转和缓存头
网站素材/                   原始设计档案，不进入网站产物
exports/                    本地截图与视频交付，不提交
```

`src/data/lifeAssets.ts` 是生成文件。Life 素材有增删时执行 `npm run assets:life`，不要手改。

## 4. 启动与应用外壳

入口顺序：

1. `index.html`
2. `src/main.tsx`
3. `src/App.tsx`
4. `src/index.css`

`main.tsx` 中的 `isPhone()` 名称容易误解：现在只在 URL 有 `?gate=1` 时进入旧 `MobileGate`，真实手机默认加载完整 App。

主应用 Provider 顺序：

1. `LanguageProvider`
2. `BrowserRouter`
3. `SmoothScrollProvider`
4. `MobilePreviewShell`
5. `IntroLoader`
6. `PageShiftProvider`
7. `TopNav`
8. `PageShiftFrame`
9. lazy routes

首页不在普通 Route 中渲染，而是作为 `PageShiftProvider` 的持久 backdrop。这样从内页掀开时露出的仍是同一个 Home 实例，不能改成普通路由后重复挂载。

首页同步进首包，其他页面按路由拆包。应用挂载约 3.5 秒后，`src/App.tsx` 的 `WarmPages` 会后台导入其余页面 chunk。

## 5. 路由与可达性

- `/`：Home；实际由持久 backdrop 渲染
- `/intro`：可重复播放首页开场
- `/life`：Life 长房间，不经过通用 `Layout`
- `/about`：About 相机页
- `/stories`：故事列表
- `/stories/:seriesId`：故事详情
- `/lab`：正式 Lab 沉浸画廊与同页详情
- `/lab/:projectId`：遗留通用详情模板，不是正式 Lab Overlay
- `/news`：新闻页
- `/contact`：Contact

主导航目前只公开 About、Lab、Life、Contact。Stories 与 News 可直接访问，但不在主菜单。`CharactersPage.tsx`、`DownloadsPage.tsx` 未注册路由。

当前没有 `*`/404 Route，未知路径会得到空内容区域。`public/sitemap.xml` 仅列公开主路由。

导航状态属于过渡协议：

- `{ from: "door" }`：Home 玻璃门进入 Life
- `{ from: "menu" }`：吊牌菜单进入内页
- `{ from: "lab-door" }`：Lab 尽头门返回 Home

不要用普通 `<a>` 或无状态跳转替换这些导航。

## 6. 全局滚动、顶栏与开场

### Lenis

`src/components/SmoothScroll.tsx` 使用 `lerp: 0.1`、平滑滚轮、原生触摸。交互层和嵌套滚动必须保留 `data-lenis-prevent`。

Life、Lab、About 都为 iOS/Android 左右边缘返回手势保留 24px。拖拽区依赖 `touch-action: none`，不要删除。

### PageShift

`src/components/PageShift.tsx` 负责菜单上拉和页面掀开：

- 目标路由先在蓝布后挂载，再一起上移。
- 点内页 Logo 时当前页向上掀走，露出持久 Home。
- 空闲时容器必须恢复 `transform: none`，否则 fixed/sticky 定位上下文会改变。
- `.is-peeling`、`--peel-sy` 是掀页期间的 sticky 修正。

### 顶栏

`src/state/chrome.ts` 与 `src/components/TopNav.tsx` 共同控制差值混合、纯色、隐藏 Logo 和导航层级。大致层级为：普通顶栏 45、Lab 详情 50、详情顶栏 55、菜单 Portal 60。

### 开场

- Home：`HeroCurtain.tsx`
- 普通桌面内页直达：`IntroLoader.tsx`
- Lab：自有 `LabIntro`
- 手机：跳过普通 `IntroLoader`
- `/intro`：忽略会话标记并允许 Replay

`woolab:intro-dismissed` 会启动首页常驻动画、About 首拍和 Life 引导。只改视觉但漏发事件会让页面逻辑停住。

## 7. Home

核心文件：

- `src/pages/Home.tsx`
- `src/components/HeroScene.tsx`
- `src/components/HeroCurtain.tsx`
- `src/data/heroHotspots.ts`
- `src/timeOfDay.ts`
- `src/weather.ts`

场景以 1440×900 原稿坐标组合，不是旧 README 所描述的地图。

时段：

- 05:00–08:00：dawn
- 08:00–17:00：day
- 17:00–20:00：dusk
- 其余：night

天气是独立的 clear/rain 维度。首页包含云、鸟、落叶、萤火虫、星空、流星、雨丝、灯光与对应环境音。

桌面通过 Hover 展示反馈。手机没有 Hover，会自动巡演“小羊 → Life 门 → About 灯 → Lab 黑板 → Contact 邮箱”；点普通热点会先播反馈，再延迟导航。

点玻璃门会并行预载 Life、开门、将镜头推近约 6.5 倍，再以 `{ from: "door" }` 进入 `/life`。

电视外壳必须先解码再显示雪花层，避免只看到雪花而没有电视框。Hero 的镜头 pivot、电视洞、底图 srcset 和开门图必须联动调整。

## 8. Life

核心文件：

- `src/pages/LifePage.tsx`
- `src/components/life/RoomStage.tsx`
- `src/components/life/Checklist.tsx`
- `src/components/life/PhotoPuzzle.tsx`
- `src/components/life/DrinkMixer.tsx`
- `src/components/life/CandleLight.tsx`
- `src/components/life/FrameAnim.tsx`
- `src/data/seg01Layers.ts`
- `src/data/seg02Layers.ts`
- `src/data/seg03Layers.ts`

房间长卷宽度为 `730vh`，滚动轨道约 `657vh`。前 92% 的纵向进度映射成横向位移，最后 8% 是到站缓冲。手机缩放约 0.62，并支持横向或纵向手势推进及惯性。

四项任务：

1. Tee：六件衣服挂上挂杆只设置 `tee=true`；还要把白 T 拖给小羊并播放换装，设置 `dressed=true` 后才真正完成。
2. Photo：10 块拼图归位，完成后化形成海报，再播放 42 帧作画动画。
3. Drink：选瓶、切柠檬、加冰、拖瓶倾倒；手机支持轻触冰桶或瓶子。
4. Candle：拖白蜡烛借火，接近时磁吸，回位并等火苗长大后完成。

清单有 guide、stamp、user、done 四种打开来源，锁滚与自动关闭规则不同。四项全完成控制清单中的“成为朋友”和 Lab CTA，但 Lab 门不是四项完成后才解锁：

- 点亮蜡烛会亮起 Lab 灯牌并打开门。
- 蜡烛未完成时点关门，也会临时亮牌、开门并进入 Lab。

当前代码没有“四项完成后整屋入夜”的实际效果，不要依据旧注释补做。

其他交互包括唱片机、柜门、冰箱 Hover、吊灯、浇花。调酒瓶有明确的前后遮挡层级，不能只按 DOM 顺序随意重排。

Life 的专注态会停止 Lenis、锁定 scrollY 并阻止 wheel。只改 overflow 会导致镜头漂移。

## 9. Lab

核心文件：

- `src/pages/LabPage.tsx`
- `src/pages/LabDetail.tsx`
- `src/components/lab/preload.ts`
- `src/data/labs.ts`

桌面是纯 2D 计算的假透视长廊，滚动长度为 `7000px + 100vh`。手机使用 MotionValue 在 7 个吸附节点间移动，不走桌面长页面滚动。

项目为 tee、sticker、drink、candle。点击展品流程：

1. 原画框 3D 翻面。
2. 石墙剪影在遮罩内放大铺满。
3. 切换到 fixed `DetailPage`。

详情打开时用 `history.pushState` 压入同一个 `/lab` URL；浏览器 Back、手机侧滑或 Escape 关闭详情。不要绕过该 history entry。

详情桌面使用容器 Lenis，手机使用原生 `pan-y`。主画框随滚动缩小并落入底部四框墙；切换项目时画框飞回顶部。底部画框换手、点击目标锁定和左右产品名淡入淡出是已修复的回归点，不要改成普通闪切。

尽头门通过暖光和镜头推进返回首页，并传 `{ from: "lab-door" }`。

Safari 稳定性依赖近景对象卸载、深度钳位、手机关闭 3D Hover/视差和预柔化光束；这些不是可随意清理的视觉代码。

## 10. About

核心文件：

- `src/pages/AboutPage.tsx`
- `src/components/about/NextPage.tsx`
- `src/components/about/MarkedText.tsx`
- `src/data/aboutShots.ts`

五张拍立得状态为 `idle → eject → develop → ready → drop → done`。首张在开屏完全离场后自动拍摄，后续由快门触发。

最后一张完成后，向下滚、PageDown、空格或上滑进入蓝色 What's Next 页。该页会压入 history；反向滚动、上滑或浏览器返回会退回相机页。

`MarkedText` 中 `*文字*` 表示手绘圈，`_文字_` 表示下划线。装饰依赖字体实测尺寸，标记词必须保持在同一行。

## 11. Contact

核心文件：

- `src/pages/ContactPage.tsx`
- `src/data/contact.ts`
- `src/audio/sfx.ts`

信封、信纸、小羊、社交链接和电话使用精确坐标动画。邮箱点击复制，在非 HTTPS 环境有旧 API 回退。

电话点击后播放音频，并按 `sfx.ts` 的 `PHONE` 时间常量同步气泡。替换电话音频时必须一起校准动画节拍。

从菜单进入依赖 `{ from: "menu" }` 跳过重复淡入。

## 12. 双语与字体

- UI 字典：`src/i18n/dict.ts`，使用 `t(key)`
- 数据字段：`{ zh, en }`，使用 `pick(value)`
- 默认中文，不读取浏览器语言
- 用户选择保存到 `localStorage["site-lang"]`
- 切换语言会同步 `<html lang>`

中英文大量使用独立字号、宽度、断行和坐标。改文案后必须分别检查两个语言。

字体定义集中在 `src/index.css`：

- `font-hand`、`font-look`、`font-nav`：自托管手写字体
- `font-sheet`：DM Sans
- 开场有内联极小字体子集，保证第 0 毫秒显示

`hand-zh.woff2` 是当前文案子集。新增汉字可能回退系统字体。原始中文 TTF 和完整的 unitsPerEm/cmap 后处理流程不在仓库内，这是唯一无法由 fresh clone 完整复现的资源步骤。

中文字体目前把 unitsPerEm 固化为约 130%，用于解决 Safari 字体发糊和视觉字号偏小；不要恢复为运行时 `size-adjust`。

## 13. 音频

`src/audio/sfx.ts` 混合使用 Web Audio、采样音效和 HTMLAudio 环境音。

关键规则：

- 首次 `play()` 必须直接发生在 pointer/touch/click/keydown 的同步调用栈中。
- 不能先 `await` 资源，再启动首次环境音；iOS Safari 可能拒绝播放。
- 解锁前只预取短音效字节，AudioContext running 后才解码。
- 环境音用 Blob 预取并常驻，切换时渐入/渐出，避免重复下载。
- Home 使用 day/calm/night/rain；Life 只有点唱片机后才播放房间音乐。
- 静音状态保存于 `localStorage["woolab-sfx-muted"]`。

## 14. 持久状态与调试入口

localStorage：

- `site-lang`：`zh` / `en`
- `woolab-room-state`：`tee`、`photo`、`drink`、`candle`、`dressed`
- `woolab-sfx-muted`：静音
- `woolab-news-seen`：新闻最后已读日期

sessionStorage：

- `intro-played-v2`：本标签页已播放全站开屏
- `heroIntroPlayed`：首页物件入场已播放
- `woolab-weather`：本次访问的晴雨选择
- `woolab-mobile-preview`：桌面手机预览

调试入口：

- `?mobile=1`：桌面开启 390px 手机预览
- `?mobile=0`：退出手机预览
- `?gate=1`：显示旧 Mobile Gate
- `?rain=1` / `?rain=0`：强制雨天 / 晴天
- `/intro`：重复预览首页开场
- `/life?reset`：清空 Life 进度
- `/life?done`：仅开发模式初始化全完成进度，并会写入 localStorage

## 15. 素材、预载与缓存

运行时资源全部从 `public/assets/` 以 `/assets/...` 绝对路径访问。仓库当前跟踪约 552 个运行资源、约 26 MiB；Life 是主要资源区。

预载层次：

1. `index.html`：电视框、中文/英文字体、首页底图
2. `HeroCurtain`：当前首屏图片、字体、环境音和短音效
3. TopNav / Menu：菜单和目标页首屏
4. `src/App.tsx`：约 3.5 秒后导入路由 chunk
5. Life：首屏、窗口帧、唱片交互、后续房间分批
6. Lab：公共入口、项目画框、详情按桌面/手机策略分批

换装和作画序列使用 `ImageBitmap + canvas`，并在卸载时释放位图。不要改回几十张 `<img>` 通过 opacity 切帧，Safari 会闪帧并增加显存压力。

`vercel.json` 的缓存策略：

- 哈希 JS/CSS：一年 immutable
- 图片、字体、音频：7 天，并允许 30 天 stale-while-revalidate

因此稳定文件名的素材不应直接同名替换。优先使用新文件名；如必须同名，更新版本 query，并同步 HTML preload、CSS、数据表与组件引用。

## 16. 天气与部署

`api/weather.ts` 从 Vercel 的访客经纬度请求 Open-Meteo，并按约 0.1° 经纬度在函数实例内缓存 10 分钟。雪天不按雨处理。

前端 `src/weather.ts` 的优先级：

1. `?rain=` 强制值
2. sessionStorage 中的用户选择
3. `/api/weather`
4. 请求失败后以 15% 概率随机雨天

本地 Vite 和普通纯静态托管没有 Vercel 请求头与 Edge Function，因此会走兜底。

`vercel.json` 还负责：

- `woolab-beryl.vercel.app` 永久跳转到 `woolab.art`
- BrowserRouter 深链重写到 `/index.html`
- 静态资源缓存头

部署到 Netlify 或其他平台时，必须另外提供 SPA fallback 和天气函数适配。

## 17. 已知问题与风险

以下是整理时确认的问题，不应在无关任务中顺手大改：

1. `src/pages/LabPage.tsx` 有 4 个不存在的预加载路径：`art-tee.webp`、`frame-sticker.webp`、`frame-drink.webp`、`frame-candle.webp`。正确资源分别是 `frame-sheep.webp`、`sticker-frame.webp`、`drink-frame.webp`、`candle-frame.webp`。页面随后可能由正确清单补载，因此构建不会发现。
2. Hero 的严格图片和字体加载会无限重试；资源永久失败时开场可能不退出。
3. `whenLifeFirstReady()` 当前忽略传入的 4 秒上限，慢网仍可能长时间等待。
4. Life 换装 61 帧在 RoomStage 挂载后提前解码，存在 Safari 内存压力和未触发动画时的缓存释放风险。
5. `/lab` Overlay 没有可分享的项目 URL；遗留 `/lab/:projectId` 又是另一套页面。
6. 未知路由没有 404 页面。
7. 若浏览器禁用或限制 storage，部分未保护的 local/sessionStorage 读取可能影响启动。
8. `src/data/labs.ts` 的部分 process/product/download 内容仍为占位；Candle 英文 `MOOD` / `DESIGN` 疑似复制错误，需产品确认。
9. `npm audit` 在本次整理时报告依赖告警。不要直接运行自动修复并提交；升级 Vite/Router 后必须做完整视觉与 Safari 回归。
10. `网站素材/` 约 115 MiB，只是原始设计档案，会增加克隆和索引时间；若未来迁出应使用独立素材库或 Git LFS，不要直接改写历史。

## 18. 回归检查

所有代码修改先执行：

```bash
npm run check
```

涉及交互时，至少手工检查：

- 中文与英文
- 1440×900 桌面
- 390px 手机或 `?mobile=1`
- 直接打开修改过的深链
- 浏览器 Back、Escape 和手机边缘返回
- 首页首次进入与本会话再次进入
- 首次点击音频、静音与恢复

涉及 Life/Lab/字体/音频/预载时，再检查：

- Safari 首访与回访
- 慢网和资源未命中缓存
- Home → Life → Lab → 四个详情 → Home
- Lab 画框 3D Hover、翻面遮罩、底部切换和产品名淡入淡出
- Life 冰箱 Hover、调酒瓶层级、Tee 两阶段完成
- 页面切换时是否闪帧、白屏或错误重置滚动
- 长流程后的内存、流畅度与标签页是否重载

构建成功不能证明视觉一致；无法运行 Safari 时必须在交付说明中明确。
