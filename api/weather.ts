/**
 * 访客所在地现在有没有在下雨（首页雨景用）。
 * Vercel 会按访客 IP 在请求头里带上经纬度，拿它去查 Open-Meteo（免费、免 key）的当前天气。
 * 返回 { rain: true | false | null, code, city }，rain 为 null = 拿不到位置或查询失败，前端自己兜底。
 * 不能走边缘缓存（URL 对所有人都一样，会把 A 城的雨缓存给 B 城），
 * 改在函数实例里按经纬度取一位小数记 10 分钟，同一片的访客共用一次查询。
 */
export const config = { runtime: "edge" };

/** WMO 天气码里算"在下雨"的：毛毛雨、雨、阵雨、雷雨（雪不算，雪天画雨丝不对） */
function isRainCode(code: number) {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; rain: boolean; code: number }>();

export default async function handler(request: Request): Promise<Response> {
  const lat = request.headers.get("x-vercel-ip-latitude");
  const lon = request.headers.get("x-vercel-ip-longitude");
  /* 城市只用来在前端控制台说明"按哪儿判的"（开着代理时会是代理节点所在地） */
  const city = [request.headers.get("x-vercel-ip-city"), request.headers.get("x-vercel-ip-country")]
    .filter(Boolean)
    .map((v) => decodeURIComponent(v as string))
    .join(", ");
  const json = (body: unknown, cache: string) =>
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json", "cache-control": cache },
    });

  if (!lat || !lon) return json({ rain: null }, "no-store");

  const key = `${Number(lat).toFixed(1)},${Number(lon).toFixed(1)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return json({ rain: hit.rain, code: hit.code, city }, "private, max-age=600");
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}&current=weather_code,precipitation`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as { current?: { weather_code?: number; precipitation?: number } };
    const code = data.current?.weather_code ?? -1;
    const mm = data.current?.precipitation ?? 0;
    const rain = isRainCode(code) || mm > 0;
    cache.set(key, { at: Date.now(), rain, code });
    return json({ rain, code, city }, "private, max-age=600");
  } catch {
    return json({ rain: null }, "no-store");
  }
}
