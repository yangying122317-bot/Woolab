import { StrictMode, useEffect, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { isForcedGate, isPhone } from "./device";

function PhoneShell({ Gate }: { Gate: ComponentType }) {
  const [landscape, setLandscape] = useState(
    () => window.innerWidth > window.innerHeight,
  );
  const [enteredLandscape, setEnteredLandscape] = useState(
    () => window.innerWidth > window.innerHeight,
  );
  const [DesktopApp, setDesktopApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    const update = () => {
      const isLand = window.innerWidth > window.innerHeight;
      setLandscape(isLand);
      if (isLand) setEnteredLandscape(true);
    };
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (DesktopApp) return;
    if (landscape) {
      void import("./App").then((m) => setDesktopApp(() => m.default));
      return;
    }
    const id = window.setTimeout(() => {
      void import("./App").then((m) => setDesktopApp(() => m.default));
    }, 1200);
    return () => window.clearTimeout(id);
  }, [landscape, DesktopApp]);

  const showGate = !landscape || !DesktopApp;

  return (
    <>
      {DesktopApp && enteredLandscape && <DesktopApp />}
      {showGate && (
        <div className="fixed inset-0 z-[200]">
          <Gate />
        </div>
      )}
    </>
  );
}

async function bootstrap() {
  /*
   * 桌面端（!isPhone()）完全走原有路径，直接加载 App。
   * 手机端：竖屏显示信封引导页（MobileGate），横过来（landscape）自动进入完整主站 App。
   */
  if (!isPhone()) {
    const App = (await import("./App")).default;
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    return;
  }

  const Gate = (await import("./components/MobileGate")).default;
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {isForcedGate() ? <Gate /> : <PhoneShell Gate={Gate} />}
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
