import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { isPhone } from "./device";

async function bootstrap() {
  /*
   * 在 import 桌面 App 之前分流。否则即使 App 最后只 return MobileGate，
   * 手机仍会下载并解析 Home / HeroScene 和整套桌面路由。
   */
  const Page = isPhone()
    ? (await import("./components/MobileGate")).default
    : (await import("./App")).default;

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Page />
    </StrictMode>,
  );
}

void bootstrap().catch((error) => {
  console.error("App bootstrap failed", error);
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML =
    '<main style="height:100%;display:grid;place-content:center;text-align:center;gap:16px;background:#F9F6EF;font-family:system-ui,sans-serif"><p>页面没有加载完整 / This page didn’t load.</p><button id="reload-app" style="margin:auto;padding:8px 20px;border:1px solid;border-radius:999px;background:transparent">重新加载 / Reload</button></main>';
  document.getElementById("reload-app")?.addEventListener("click", () => window.location.reload());
});
