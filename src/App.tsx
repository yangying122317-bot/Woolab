import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext";
import IntroLoader from "./components/IntroLoader";
import Layout from "./components/Layout";
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
        <IntroLoader />
        <Routes>
          {/* 首页（场景导航）与屋内长卷使用全屏布局 */}
          <Route path="/" element={<Home />} />
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
      </BrowserRouter>
    </LanguageProvider>
  );
}
