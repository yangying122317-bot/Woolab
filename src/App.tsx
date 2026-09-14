import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext";
import IntroLoader, {
  INTRO_PREVIEW_PATH,
  IntroPreview,
} from "./components/IntroLoader";
import { SmoothScrollProvider } from "./components/SmoothScroll";
import Layout from "./components/Layout";
import TopNav from "./components/TopNav";
import { PageShiftFrame, PageShiftProvider } from "./components/PageShift";
import Home from "./pages/Home";

/*
 * 首页之外的页面都按页拆包：首屏那份 JS 只带首页 + 开场，电视机能早点出来。
 * 拆出去的包在首页站稳之后（几秒后）就悄悄拉回来，点目录跳页时不用再等。
 */
const PAGE_LOADERS = {
  life: () => import("./pages/LifePage"),
  about: () => import("./pages/AboutPage"),
  stories: () => import("./pages/StoriesPage"),
  storyDetail: () => import("./pages/StoryDetailPage"),
  lab: () => import("./pages/LabPage"),
  labProject: () => import("./pages/LabProjectPage"),
  news: () => import("./pages/NewsPage"),
  contact: () => import("./pages/ContactPage"),
};
const LifePage = lazy(PAGE_LOADERS.life);
const AboutPage = lazy(PAGE_LOADERS.about);
const StoriesPage = lazy(PAGE_LOADERS.stories);
const StoryDetailPage = lazy(PAGE_LOADERS.storyDetail);
const LabPage = lazy(PAGE_LOADERS.lab);
const LabProjectPage = lazy(PAGE_LOADERS.labProject);
const NewsPage = lazy(PAGE_LOADERS.news);
const ContactPage = lazy(PAGE_LOADERS.contact);

function WarmPages() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      Object.values(PAGE_LOADERS).forEach((load) => void load());
    }, 3500);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <SmoothScrollProvider>
          <IntroLoader />
          <PageShiftProvider>
            {/* 全站一份顶栏（logo / MENU / CN·EN / 喇叭）+ 吊牌目录 */}
            <TopNav />
            {/* 路由包在可位移的一层里：目录跳页时新页面从底下被拉上来 */}
            <PageShiftFrame>
              <WarmPages />
              <Suspense fallback={null}>
                <Routes>
                  {/* 首页（场景导航）与屋内长卷使用全屏布局 */}
                  <Route path="/" element={<Home />} />
                  {/* 加载动画单独入口：底下是首页，开屏不看会话标记、可反复播 */}
                  <Route
                    path={INTRO_PREVIEW_PATH}
                    element={
                      <>
                        <Home />
                        <IntroPreview />
                      </>
                    }
                  />
                  <Route path="/life" element={<LifePage />} />

                  {/* 内页共用 Layout（顶部导航 + 语言切换） */}
                  <Route element={<Layout />}>
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/stories" element={<StoriesPage />} />
                    <Route
                      path="/stories/:seriesId"
                      element={<StoryDetailPage />}
                    />
                    <Route path="/lab" element={<LabPage />} />
                    <Route
                      path="/lab/:projectId"
                      element={<LabProjectPage />}
                    />
                    <Route path="/news" element={<NewsPage />} />
                    {/* Downloads 已折叠进 Lab 详情的"带一份回家"段落 */}
                    <Route path="/contact" element={<ContactPage />} />
                  </Route>
                </Routes>
              </Suspense>
            </PageShiftFrame>
          </PageShiftProvider>
        </SmoothScrollProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}
