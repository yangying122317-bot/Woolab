import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { config } from "../config";
import { mapLocations } from "../data/mapLocations";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * 首页地图导航。
 * - 桌面端：横版地图 + 百分比坐标定位的地点标记
 * - 移动端：根据 config.mobileMapMode 决定使用竖版地图或列表式导航
 * 地图底图替换：public/assets/map-bg.svg（横版）、map-portrait.svg（竖版）
 */
export default function MapNav() {
  const showMapOnMobile = config.mobileMapMode === "map";

  return (
    <>
      {/* 地图模式：桌面端始终显示；移动端仅当 mobileMapMode === "map" */}
      <div className={showMapOnMobile ? "block" : "hidden md:block"}>
        <MapCanvas portraitOnMobile={showMapOnMobile} />
      </div>

      {/* 列表模式：仅移动端、且 mobileMapMode === "list" 时显示 */}
      {!showMapOnMobile && (
        <div className="md:hidden">
          <LocationList />
        </div>
      )}
    </>
  );
}

function MapCanvas({ portraitOnMobile }: { portraitOnMobile: boolean }) {
  const { t } = useLanguage();

  return (
    <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
      {/* 横版地图；如启用移动端地图模式，小屏时切换为竖版素材 */}
      <img
        src="/assets/map-bg.svg"
        alt=""
        className={`w-full ${portraitOnMobile ? "hidden md:block" : "block"}`}
        draggable={false}
      />
      {portraitOnMobile && (
        <img
          src="/assets/map-portrait.svg"
          alt=""
          className="w-full md:hidden"
          draggable={false}
        />
      )}

      {mapLocations.map((loc, i) => (
        <motion.div
          key={loc.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.3,
          }}
        >
          <Link
            to={loc.path}
            className="group flex flex-col items-center gap-1"
          >
            <span className="block h-5 w-5 rounded-full border-2 border-white bg-neutral-800 shadow-md transition group-hover:scale-125" />
            <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-neutral-700 shadow-sm transition group-hover:bg-neutral-800 group-hover:text-white">
              {t(loc.labelKey)}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function LocationList() {
  const { t } = useLanguage();

  return (
    <ul className="flex flex-col gap-3">
      {mapLocations.map((loc) => (
        <li key={loc.id}>
          <Link
            to={loc.path}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm transition active:scale-[0.98]"
          >
            <span className="font-medium">{t(loc.labelKey)}</span>
            <span aria-hidden className="text-neutral-400">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
