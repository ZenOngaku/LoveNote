/**
 * ============================================================
 * 足迹地图 · 视口数学（纯函数：无 DOM、无 React、无副作用）
 * ============================================================
 * 屏幕坐标 = 地图坐标 * scale + 平移量（tx, ty）。
 * 所有会改变视口的操作最终都过一遍 clampView，保证：
 *   1. scale 落在 [最小缩放, MAX_SCALE]；
 *   2. 地图始终覆盖视口，不会拖出可视区外（世界坐标是有限的 8192×8192）；
 *   3. 缩放到最小时自动居中。
 */
import {
  CHINA_BBOX,
  CITY_HIT_RADIUS,
  MAX_SCALE,
  MAP_UNIT,
  MIN_ZOOM_FACTOR,
  TIER1_K,
  TIER2_K,
} from '@/lib/map/constants'
import type { BBox, MapView, Viewport } from '@/lib/map/types'
import type { CityPoint } from '@/lib/types'

/**
 * 某视口下的最小缩放：让 8192×8192 的整个世界都装进视口（留一点余量）。
 * 注意不能用 max(w,h)（cover 语义）——那样竖屏手机永远看不到完整世界。
 */
export function minScaleFor(viewport: Viewport): number {
  return (Math.min(viewport.w, viewport.h) / MAP_UNIT) * MIN_ZOOM_FACTOR
}

/** 地图坐标 → 屏幕坐标 */
export function toScreen(view: MapView, x: number, y: number): [number, number] {
  return [x * view.scale + view.tx, y * view.scale + view.ty]
}

/** 屏幕坐标 → 地图坐标 */
export function toMap(view: MapView, sx: number, sy: number): [number, number] {
  return [(sx - view.tx) / view.scale, (sy - view.ty) / view.scale]
}

/** 把 bbox 装进视口（居中 + 四周留白），用于「聚焦中国」与「回到中国」 */
export function fitBBox(bbox: BBox, viewport: Viewport, padding = 0): MapView {
  if (viewport.w <= 0 || viewport.h <= 0) {
    return { tx: 0, ty: 0, scale: 1 }
  }
  const boxW = bbox.maxX - bbox.minX
  const boxH = bbox.maxY - bbox.minY
  const scale = Math.min((viewport.w * (1 - padding * 2)) / boxW, (viewport.h * (1 - padding * 2)) / boxH)
  const centerX = (bbox.minX + bbox.maxX) / 2
  const centerY = (bbox.minY + bbox.maxY) / 2
  return {
    scale,
    tx: viewport.w / 2 - centerX * scale,
    ty: viewport.h / 2 - centerY * scale,
  }
}

/** 默认取景：中国主体 + 留白 */
export function chinaFitView(viewport: Viewport, padding = 0.04): MapView {
  return fitBBox(CHINA_BBOX, viewport, padding)
}

/**
 * 夹紧视口：限制缩放范围；**横向做世界环绕**（Google/Apple 地图同款），纵向夹紧。
 *
 * 为什么横向可以环绕：东西经 180° 是同一条线，世界地图横向首尾相接，
 * 因此 tx 不夹紧，只把数值归一化到 [-worldPx, 0)（视觉上等价，且数值不会飘大），
 * 渲染时在 ±MAP_UNIT 处再补一份世界即可无缝衔接（见 wrapOffsets）。
 * 纵向不能环绕（两极不接），超出范围一律夹回并在世界小于视口时居中。
 */
export function clampView(view: MapView, viewport: Viewport): MapView {
  const minScale = minScaleFor(viewport)
  const scale = Number.isFinite(view.scale) ? Math.min(MAX_SCALE, Math.max(minScale, view.scale)) : minScale
  const worldPx = MAP_UNIT * scale
  // 横向：环绕归一化（tx ∈ (-worldPx, 0]，与世界宽度的整数倍平移等价，数值不会飘大）
  const remainder = view.tx % worldPx
  const tx = remainder > 0 ? remainder - worldPx : remainder
  // 纵向：世界比视口矮（缩到底）时居中，否则夹在世界范围内
  const centeredY = (viewport.h - worldPx) / 2
  const atMinScale = scale <= minScale * (1 + 1e-9)
  const ty = atMinScale || worldPx <= viewport.h ? centeredY : Math.min(0, Math.max(viewport.h - worldPx, view.ty))
  return { scale, tx, ty }
}

/** 可见的地图坐标 x 范围（按 margin 比例外扩），用于判断需要几份世界副本 */
export function visibleXRange(view: MapView, viewport: Viewport, margin = 0.25): [number, number] {
  const [x0] = toMap(view, 0, 0)
  const [x1] = toMap(view, viewport.w, 0)
  const pad = (x1 - x0) * margin
  return [x0 - pad, x1 + pad]
}

/**
 * 需要渲染的世界副本偏移（0 = 原始世界，±MAP_UNIT = 前后各接一份）。
 * 通常返回 1~2 个值：视口跨过接缝时才会同时出现两份。
 */
export function wrapOffsets(view: MapView, viewport: Viewport, margin = 0.25): number[] {
  const [x0, x1] = visibleXRange(view, viewport, margin)
  const kMin = Math.floor(x0 / MAP_UNIT)
  const kMax = Math.floor(x1 / MAP_UNIT)
  const offsets: number[] = []
  for (let k = kMin; k <= kMax; k += 1) offsets.push(k * MAP_UNIT)
  return offsets.length > 0 ? offsets : [0]
}

/** 以屏幕点 (ax, ay) 为锚点缩放到 nextScale（锚点下方的地图坐标保持不动） */
export function zoomAtScale(view: MapView, nextScale: number, ax: number, ay: number, viewport: Viewport): MapView {
  const scale = Math.min(MAX_SCALE, Math.max(minScaleFor(viewport), nextScale))
  const [mx, my] = toMap(view, ax, ay)
  return clampView({ scale, tx: ax - mx * scale, ty: ay - my * scale }, viewport)
}

/** 平移（屏幕像素增量） */
export function panBy(view: MapView, dx: number, dy: number, viewport: Viewport): MapView {
  return clampView({ ...view, tx: view.tx + dx, ty: view.ty + dy }, viewport)
}

/** 缩放档位（相对中国初始取景缩放，与屏幕尺寸无关） */
export function tierOf(view: MapView, viewport: Viewport): 0 | 1 | 2 {
  const fit = chinaFitView(viewport).scale
  const k = fit > 0 ? view.scale / fit : 1
  if (k >= TIER2_K) return 2
  if (k >= TIER1_K) return 1
  return 0
}

/**
 * 当前视口可见的地图坐标矩形（按 margin 比例外扩）。
 * 世界城市有两千多个，渲染前先按这个矩形裁掉屏幕外的点位，避免无谓的 DOM 开销。
 */
export function visibleRect(view: MapView, viewport: Viewport, margin = 0.25): BBox {
  const [x0, y0] = toMap(view, 0, 0)
  const [x1, y1] = toMap(view, viewport.w, viewport.h)
  const padX = (x1 - x0) * margin
  const padY = (y1 - y0) * margin
  return { minX: x0 - padX, maxX: x1 + padX, minY: y0 - padY, maxY: y1 + padY }
}

/** 点位是否落在矩形内 */
export function inBBox(bbox: BBox, x: number, y: number): boolean {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
}

/**
 * 城市命中：返回屏幕坐标下离点击处最近、且在触达半径内的城市。
 *
 * 注意这里**不给已点亮城市加分**：早先的做法是「圆心距离 − 点亮加分」，
 * 结果在密集区域会出现「点了乌鲁木齐旁边的小点，却弹出了乌鲁木齐」——
 * 手指明明落在小点上，选中的却是旁边的大点，属于不可预测的误触。
 * 现在的规则是最朴素的「哪个点离手指最近就选哪个」，配合 22px 的触达半径，
 * 既好点中自己的城市，也不会误选别的点。
 */
export function nearestCity(
  cities: CityPoint[],
  view: MapView,
  sx: number,
  sy: number,
  radius = CITY_HIT_RADIUS,
): CityPoint | null {
  let best: CityPoint | null = null
  let bestScore = Number.POSITIVE_INFINITY
  const worldPx = MAP_UNIT * view.scale
  for (const city of cities) {
    const [cx, cy] = toScreen(view, city.x, city.y)
    // 横向环绕：把水平距离折算到最近的一份世界（否则接缝另一侧的城市点不中）
    let dx = cx - sx
    dx -= Math.round(dx / worldPx) * worldPx
    const dist = Math.hypot(dx, cy - sy)
    if (dist > radius) continue
    if (dist < bestScore) {
      bestScore = dist
      best = city
    }
  }
  return best
}
