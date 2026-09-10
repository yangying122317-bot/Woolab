import HeroScene from "../components/HeroScene";

/** 首页：整屏场景，顶栏由 App 里的 TopNav 统一挂 */
export default function Home() {
  return (
    <div className="relative h-full min-h-screen text-neutral-800">
      <div className="h-screen">
        <HeroScene />
      </div>
    </div>
  );
}
