import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext";
import IntroLoader from "./components/IntroLoader";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import CharactersPage from "./pages/CharactersPage";
import AboutPage from "./pages/AboutPage";
import StoriesPage from "./pages/StoriesPage";
import StoryDetailPage from "./pages/StoryDetailPage";
import LabPage from "./pages/LabPage";
import DownloadsPage from "./pages/DownloadsPage";
import ContactPage from "./pages/ContactPage";

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <IntroLoader />
        <Routes>
          {/* 首页（地图导航）使用全屏布局 */}
          <Route path="/" element={<Home />} />

          {/* 内页共用 Layout（顶部导航 + 语言切换） */}
          <Route element={<Layout />}>
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="/stories/:seriesId" element={<StoryDetailPage />} />
            <Route path="/lab" element={<LabPage />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="/contact" element={<ContactPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
