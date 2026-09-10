import { Outlet } from "react-router-dom";

/**
 * 内页壳：只管底色。顶栏（logo / MENU / 语言 / 声音）由 App 里的 TopNav 统一挂，
 * 背景、滚动和进场过场都交给各页面自己控制，保持沉浸感。
 */
export default function Layout() {
  return (
    <div className="relative min-h-full bg-[#F4F4F4] text-neutral-800">
      <main className="min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
