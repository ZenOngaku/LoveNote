'use client'

/**
 * ============================================================
 * FootprintMap —— 矢量足迹地图（SVG，零第三方地图依赖）
 * ============================================================
 * 图层（自下而上）：世界底图（缩小时 110m 粗轮廓、放大后换 50m 高精度国界）→
 *                  中国轮廓（默认高亮）→ 省级边界（tier≥1 惰性加载）→ 城市点位与标签
 *
 * 渲染约定：
 * - 地图坐标是构建期预投影好的 8192 单位制，运行时只做 translate/scale；
 * - transform 由 useMapViewport 直接写 DOM（手势期间不触发 React 渲染），
 *   因此组件里不声明 transform 属性，避免 React 覆盖手势中的实时值；
 * - 点与标签用 counter-scale（scale(1/k)）保持屏幕尺寸恒定；
 * - 城市命中统一在容器层做（最近点 + 阈值），标记本身不挂点击，避免双重触发。
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Loader2, LocateFixed, Minus, Plus, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMapViewport } from '@/hooks/useMapViewport'
import { cullLabels } from '@/lib/footprints'
import { TIER0_MAX_CITIES, TIER0_MAX_RANK, WORLD_CITIES_TRIGGER_K } from '@/lib/map/constants'
import { chinaFitView, inBBox, nearestCity, visibleRect, wrapOffsets } from '@/lib/map/viewport'
import { tileKey, tilesInView } from '@/lib/map/tiles'
import { MAP_UNIT } from '@/lib/map/constants'
import type { MapBundle, MapView, Viewport } from '@/lib/map/types'
import type { CityPoint, VisitedCity } from '@/lib/types'

/** 标签锚点：middle = 画在点正上方；start / end = 画在点右侧 / 左侧（贴边城市用） */
type LabelAnchor = 'start' | 'middle' | 'end'

/** 标签宽度估算（用于判断是否会被画布裁断）：中文 ≈ 1em，拉丁 ≈ 0.6em */
function estimateLabelWidth(name: string, fontSize: number): number {
  let em = 0
  for (const ch of name) em += (ch.codePointAt(0) ?? 0) > 0x2e80 ? 1 : 0.6
  return em * fontSize + 8
}

/**
 * 标签锚点决策：靠近画布左右边缘的城市把标签画在点的内侧
 * （左侧城市向右画、右侧城市向左画），避免「富纳富」这种被裁掉一半的标签。
 */
function labelAnchorFor(
  city: CityPoint,
  view: MapView,
  viewport: Viewport,
  offset: number,
  lit: boolean,
): LabelAnchor {
  const screenX = (city.x + offset) * view.scale + view.tx
  const half = estimateLabelWidth(city.n, lit ? 12.5 : 11.5) / 2
  const margin = 6
  if (screenX + half > viewport.w - margin) return 'end'
  if (screenX - half < margin) return 'start'
  return 'middle'
}

/**
 * 全景档（tier 0）显示哪些点：首都/省会 + 已点亮 + 重要度 ≤ TIER0_MAX_RANK，
 * 再按密度上限截断（点亮优先、其余按重要度）。
 *
 * ⚠️ 渲染与命中必须调用同一个函数：早先命中用的是「只有首都/省会」的旧规则，
 * 结果屏幕上看得见的小点（如宁波）点不中，手指落在小点上却被旁边的大城市接住。
 */
function selectTier0(cities: CityPoint[], litCodes: Set<number>): CityPoint[] {
  return cities
    .filter((city) => city.cap === 1 || litCodes.has(city.a) || (city.r ?? 9) <= TIER0_MAX_RANK)
    .sort((a, b) => {
      const litA = litCodes.has(a.a) ? 0 : 1
      const litB = litCodes.has(b.a) ? 0 : 1
      if (litA !== litB) return litA - litB
      return (a.r ?? 9) - (b.r ?? 9)
    })
    .slice(0, TIER0_MAX_CITIES)
}

interface FootprintMapProps {
  /** 地图数据（null = 尚未加载完成） */
  bundle: MapBundle | null
  loading: boolean
  /** 加载失败的中文提示 */
  error: string | null
  onRetry: () => void
  /** 已点亮城市聚合（adcode → 聚合信息） */
  visited: Map<number, VisitedCity>
  /** 当前选中的城市 adcode（高亮用） */
  selectedAdcode: number | null
  onSelectCity: (city: CityPoint) => void
  /** 缩放到省级视角时通知外层惰性加载省界层 */
  onNeedDetail: () => void
  /** 深放大时通知外层按视野加载精细分块（key = "row-col"） */
  onNeedTiles: (keys: string[]) => void
  /** 缩到世界视野时通知外层加载国外城市列表（只需要点位，不需要省界/精细国界） */
  onNeedWorldCities: () => void
}

export function FootprintMap({
  bundle,
  loading,
  error,
  onRetry,
  visited,
  selectedAdcode,
  onSelectCity,
  onNeedDetail,
  onNeedTiles,
  onNeedWorldCities,
}: FootprintMapProps) {
  // 全部城市：中国地级市 + 世界首都（首屏）+ 其余世界城市（放大后惰性加载）
  const allCities = useMemo(
    () => (bundle ? [...bundle.cities.cities, ...bundle.worldCities] : []),
    [bundle],
  )
  const litCodes = useMemo(() => new Set(visited.keys()), [visited])

  /**
   * 轻点命中：只认「屏幕上真的画出来了」的城市 ——
   * 视野矩形不留外扩余量（屏幕外的点位不算），且要满足当前档位的显示规则
   * （全景档只显示首都/省会/已点亮）。否则会出现「点了空白处却冒出个看不见的城市」。
   *
   * 命中要用到视口尺寸与档位，但它们来自下面的 hook；这里通过 ref 传递最新值，
   * 既避免「声明前使用」，也符合「不在渲染期读写 ref」的约定（只在回调里读）。
   */
  const tapContextRef = useRef<{ size: Viewport | null; tier: 0 | 1 | 2 }>({ size: null, tier: 0 })
  const handleTap = useCallback(
    (x: number, y: number, tapView: MapView) => {
      const { size: tapSize, tier: tapTier } = tapContextRef.current
      if (!tapSize) return
      const rect = visibleRect(tapView, tapSize, 0)
      const inView = allCities.filter((city) => inBBox(rect, city.x, city.y))
      // 与渲染完全同一套规则：屏幕上看得见的点才可点
      const candidates = tapTier > 0 ? inView : selectTier0(inView, litCodes)
      const hit = nearestCity(candidates, tapView, x, y)
      if (hit) onSelectCity(hit)
    },
    [allCities, litCodes, onSelectCity],
  )

  const { containerRef, groupRef, view, size, tier, pinching, zoomBy, resetToChina } = useMapViewport({
    onTap: handleTap,
  })

  // 把最新的视口尺寸与档位同步给命中回调
  useEffect(() => {
    tapContextRef.current = { size, tier }
  }, [size, tier])

  // 放大到省级视角时惰性加载省界层（effect 内只调回调，不 setState）
  useEffect(() => {
    if (tier >= 1) onNeedDetail()
  }, [tier, onNeedDetail])

  // 缩到世界视野时加载国外城市列表：否则世界地图上只有各国首都，大片区域空着
  useEffect(() => {
    if (!view || !size || tier >= 1) return
    const k = view.scale / chinaFitView(size).scale
    if (k <= WORLD_CITIES_TRIGGER_K) onNeedWorldCities()
  }, [view, size, tier, onNeedWorldCities])

  const scale = view?.scale ?? 1

  // 横向世界循环：视口跨过 180° 接缝时要同时渲染两份世界（通常只有 1~2 份）
  const copies = useMemo(() => (view && size ? wrapOffsets(view, size) : [0]), [view, size])

  /**
   * 每份世界副本的点位：先按「屏幕外裁剪」（世界城市两千多个，只保留视野内 + 25% 外扩），
   * 全景档再筛成首都/省会/已点亮；标签碰撞剔除同样按副本各自算。
   */
  const copiesData = useMemo(() => {
    if (!view || !size) return copies.map((offset) => ({ offset, cities: [], labels: new Set<number>(), anchors: new Map<number, LabelAnchor>() }))
    const base = visibleRect(view, size)
    return copies.map((offset) => {
      // 该副本可见的地图矩形 = 基础矩形反向平移 offset
      const rect = { minX: base.minX - offset, maxX: base.maxX - offset, minY: base.minY, maxY: base.maxY }
      const inView = allCities.filter((city) => inBBox(rect, city.x, city.y))
      const shown = tier > 0 ? inView : selectTier0(inView, litCodes)
      const labels = cullLabels(shown, scale, litCodes)
      // 已点亮城市必须带名字：碰撞剔除可能会牺牲掉它们，这里强制补回
      for (const city of shown) if (litCodes.has(city.a)) labels.add(city.a)
      /**
       * 标签锚点：贴近左右边缘的城市把标签画在点的内侧，避免被画布裁断；
       * 点位本身已经跑到画布外的（只是标签露进来半截）直接不画 —— 主流地图同款处理。
       */
      const anchors = new Map<number, LabelAnchor>()
      for (const city of shown) {
        if (!labels.has(city.a)) continue
        const screenX = (city.x + offset) * scale + view.tx
        const screenY = city.y * scale + view.ty
        if (screenX < 0 || screenX > size.w || screenY < 0 || screenY > size.h) {
          labels.delete(city.a)
          continue
        }
        anchors.set(city.a, labelAnchorFor(city, view, size, offset, litCodes.has(city.a)))
      }
      return { offset, cities: shown, labels, anchors }
    })
  }, [allCities, copies, view, size, tier, litCodes, scale])

  const provinces = bundle?.provinces ?? null

  /**
   * 世界底图三级：
   *   缩小时        110m 粗轮廓（首屏）
   *   放大到省级    world-detail（10m 源、中等容差，整块覆盖）
   *   深放大(≥tier2) tiles（按视野加载的精细分块；未加载完时继续用上一级）
   */
  const neededTiles = useMemo(
    () => (view && size && tier >= 2 ? tilesInView(view, size) : []),
    [view, size, tier],
  )
  const tileKeyList = neededTiles.map((t) => tileKey(t.row, t.col)).join(',')
  const tilePaths = useMemo(() => {
    if (neededTiles.length === 0) return null
    const loaded = neededTiles.map((t) => bundle?.detailTiles[tileKey(t.row, t.col)])
    if (loaded.some((paths) => !paths)) return null // 还有分块没加载完
    return loaded.flat()
  }, [neededTiles, bundle])

  useEffect(() => {
    if (tileKeyList) onNeedTiles(tileKeyList.split(','))
  }, [tileKeyList, onNeedTiles])

  const worldLayer =
    tilePaths && tilePaths.length > 0
      ? { unit: MAP_UNIT, paths: tilePaths }
      : tier >= 1 && bundle?.worldDetail
        ? bundle.worldDetail
        : bundle?.world

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none overflow-hidden bg-[#fdf7f8] dark:bg-[#2b1a13]"
    >
      <svg
        className="fp-map"
        data-gesture={pinching ? 'pinch' : undefined}
        role="application"
        aria-label="足迹地图"
      >
        {/* transform 由 useMapViewport 直接写 DOM（见文件头注释） */}
        <g ref={groupRef}>
          {bundle &&
            copiesData.map(({ offset, cities, labels, anchors }) => (
              /* 每份副本整体平移 offset（地图单位）：±MAP_UNIT 处各接一份世界，实现横向循环 */
              <g key={offset} transform={offset === 0 ? undefined : `translate(${offset} 0)`}>
                <g className="fp-world">
                  {worldLayer?.paths.map((d, index) => (
                    <path key={index} d={d} />
                  ))}
                </g>

                <g className="fp-china">
                  {bundle.china.paths.map((d, index) => (
                    <path key={index} d={d} />
                  ))}
                </g>

                {tier >= 1 && provinces && (
                  <g className="fp-province">
                    {provinces.provinces.map((province) =>
                      province.d.map((d, index) => <path key={`${province.a}-${index}`} d={d} />),
                    )}
                  </g>
                )}

                <g className="fp-markers">
                  {cities.map((city) => (
                    <CityMarker
                      key={city.a}
                      city={city}
                      scale={scale}
                      lit={litCodes.has(city.a)}
                      selected={city.a === selectedAdcode}
                      hasLabel={labels.has(city.a)}
                      anchor={anchors.get(city.a) ?? 'middle'}
                    />
                  ))}
                </g>
              </g>
            ))}
        </g>
      </svg>

      {/* 图例 */}
      {bundle && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-2xl border border-rose-100 bg-white/85 px-3 py-2 text-[11px] leading-tight text-stone-500 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#3a241a]/85 dark:text-rose-200/70">
          <p id="fp-legend" className="font-medium text-rose-500 dark:text-rose-300">
            已点亮 {visited.size} 座城市
          </p>
          {/* 色块颜色与地图上实际画点的颜色保持一致（含深色模式），否则图例会和地图对不上 */}
          <p className="mt-0.5 flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500 dark:bg-[#fb7185]" aria-hidden />
            点亮
            <span className="ml-1 inline-block h-2 w-2 rounded-full bg-orange-300 dark:bg-[rgb(253_164_175_/_0.45)]" aria-hidden />
            未去
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-300/50 dark:bg-[rgb(253_164_175_/_0.22)]" aria-hidden />
            次要城市
          </p>
        </div>
      )}

      {/* 缩放控件（捏合失效时的兜底路径，也是移动地图标配） */}
      {bundle && (
        <div className="absolute bottom-4 right-3 flex flex-col gap-2">
          <MapControlButton label="放大" onClick={() => zoomBy(1.6)}>
            <Plus className="h-4 w-4" aria-hidden />
          </MapControlButton>
          <MapControlButton label="缩小" onClick={() => zoomBy(1 / 1.6)}>
            <Minus className="h-4 w-4" aria-hidden />
          </MapControlButton>
          <MapControlButton label="回到中国" onClick={resetToChina}>
            <LocateFixed className="h-4 w-4" aria-hidden />
          </MapControlButton>
        </div>
      )}

      {/* 加载中 / 加载失败 */}
      {bundle === null && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#fdf7f8]/85 px-6 dark:bg-[#2b1a13]/85">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-stone-400 dark:text-rose-200/60">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <p className="text-xs">正在加载地图…</p>
            </div>
          ) : (
            <div className="w-full max-w-xs rounded-3xl border border-rose-100 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-[#3a241a]">
              <p className="text-sm text-stone-600 dark:text-rose-100">{error || '地图加载失败'}</p>
              <Button
                onClick={onRetry}
                className="mt-3 h-10 w-full rounded-full bg-rose-500 text-sm hover:bg-rose-600"
              >
                <RotateCw className="mr-1 h-3.5 w-3.5" aria-hidden />
                重试
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 地图右下角圆形控件 */
function MapControlButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-100 bg-white/90 text-stone-500 shadow-sm backdrop-blur-sm transition-transform active:scale-95 dark:border-white/10 dark:bg-[#3a241a]/90 dark:text-rose-200/80"
    >
      {children}
    </button>
  )
}

/**
 * 城市标记（模块顶层定义：react-hooks/static-components 要求组件不能定义在渲染函数内）。
 * 点位尺寸按 1/scale 反算，保证屏幕上大小恒定；命中判定由容器统一处理，故不挂点击事件。
 */
function CityMarker({
  city,
  scale,
  lit,
  selected,
  hasLabel,
  anchor,
}: {
  city: CityPoint
  scale: number
  lit: boolean
  selected: boolean
  hasLabel: boolean
  anchor: LabelAnchor
}) {
  const k = 1 / scale
  // 没有名字的点（被标签碰撞剔除掉的）画得更小更淡：视觉上明确是次要点，
  // 不会与旁边带名字的点混淆（主流地图也是这么分级的）
  const minor = !lit && !selected && !hasLabel
  const radius = (selected ? 6.5 : lit ? 5 : hasLabel ? 3 : 2) * k
  // 贴边城市的标签画在点位内侧（start = 右侧、end = 左侧），其余画在正上方
  const labelPos =
    anchor === 'middle'
      ? { x: 0, y: -10 * k, textAnchor: 'middle' as const }
      : anchor === 'start'
        ? { x: 7 * k, y: 4 * k, textAnchor: 'start' as const }
        : { x: -7 * k, y: 4 * k, textAnchor: 'end' as const }
  return (
    <g
      transform={`translate(${city.x} ${city.y})`}
      data-city={city.a}
      data-lit={lit ? '1' : '0'}
      data-anchor={anchor}
    >
      {selected && (
        <circle
          r={11 * k}
          className="fp-ring"
          fill="none"
          strokeWidth={1.5 * k}
          pointerEvents="none"
        />
      )}
      <circle
        r={radius}
        className={`fp-dot${minor ? ' fp-dot--minor' : ''}${lit ? ' fp-dot--lit' : ''}${selected ? ' fp-dot--sel' : ''}`}
        strokeWidth={minor ? 0 : 1.5 * k}
        pointerEvents="none"
      />
      {hasLabel && (
        <text
          className={`fp-label${lit ? ' fp-label--lit' : ''}`}
          x={labelPos.x}
          y={labelPos.y}
          textAnchor={labelPos.textAnchor}
          fontSize={(lit ? 12.5 : 11.5) * k}
          strokeWidth={3 * k}
          pointerEvents="none"
        >
          {city.n}
        </text>
      )}
    </g>
  )
}
