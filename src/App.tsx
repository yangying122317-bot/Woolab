import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext";
import IntroLoader, { INTRO_PREVIEW_PATH, IntroPreview } from "./components/IntroLoader";
import { SmoothScrollProvider } from "./components/SmoothScroll";
import Layout from "./components/Layout";
import TopNav from "./components/TopNav";
import { PageShiftFrame, PageShiftProvider } from "./components/PageShift";
import Home from "./pages/Home";
import LifePage from "./pages/LifePage";
import AboutPage from "./pages/AboutPage";
import StoriesPage from "./pages/StoriesPage";
import StoryDetailPage from "./pages/StoryDetailPage";
import LabPage from "./pages/LabPage";
import LabProjectPage from "./pages/LabProjectPage";
import NewsPage from "./pages/NewsPage";
import ContactPage from "./pages/ContactPage";

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
                  <Route path="/stories/:seriesId" element={<StoryDetailPage />} />
                  <Route path="/lab" element={<LabPage />} />
                  <Route path="/lab/:projectId" element={<LabProjectPage />} />
                  <Route path="/news" element={<NewsPage />} />
                  {/* Downloads 已折叠进 Lab 详情的"带一份回家"段落 */}
                  <Route path="/contact" element={<ContactPage />} />
                </Route>
              </Routes>
            </PageShiftFrame>
          </PageShiftProvider>
        </SmoothScrollProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}
