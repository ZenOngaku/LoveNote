/**
 * ============================================================
 * 足迹地图 · 投影（Web Mercator）
 * ============================================================
 * 与 scripts/build-geodata.mjs 使用同一套公式与同一单位总量（MAP_UNIT）：
 * 构建脚本负责把 GeoJSON 预投影成 path，运行时只在需要「经纬度 → 地图坐标」
 * 时才用到这里（例如把用户记录里的城市坐标定位到地图上）。
 * 两处公式必须保持一致 —— 纯函数断言会拿天安门坐标与构建产物做互校。
 */
import { MAP_UNIT } from '@/lib/map/constants'

/** 墨卡托纬度上限（±85.051129°，超过后 y 发散） */
export const MAX_LATITUDE = 85.051129

/** 经纬度 → 地图坐标（地图单位，世界经度 360° = 0..MAP_UNIT） */
export function lngLatToMap(lng: number, lat: number): [number, number] {
  const clampedLat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat))
  const rad = (clampedLat * Math.PI) / 180
  const x = ((lng + 180) / 360) * MAP_UNIT
  const y = ((1 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / Math.PI) / 2) * MAP_UNIT
  return [x, y]
}

/** 地图坐标 → 经纬度（反向换算，调试与导出用） */
export function mapToLngLat(x: number, y: number): [number, number] {
  const lng = (x / MAP_UNIT) * 360 - 180
  const n = Math.PI * (1 - (2 * y) / MAP_UNIT)
  const lat = (Math.atan(Math.sinh(n)) * 180) / Math.PI
  return [lng, lat]
}
