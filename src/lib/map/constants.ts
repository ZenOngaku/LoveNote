/**
 * ============================================================
 * 足迹地图 · 编译期常量
 * ============================================================
 * 坐标常量来自 scripts/build-geodata.mjs 的输出（脚本末尾会打印 bbox），
 * 数据源更新后重跑脚本并按输出校准即可。
 */
import type { BBox } from '@/lib/map/types'

/** 地图单位总量：世界经度 360° 对应 0..8192（与构建脚本一致） */
export const MAP_UNIT = 8192

/**
 * 中国主体 bbox（含港澳台，不含南海诸岛/九段线）：
 * 初始取景用 —— 用它做 fit 能得到饱满的中国视图，南海诸岛仍在图层里，向下拖动可见
 */
export const CHINA_BBOX: BBox = { minX: 5768.6, maxX: 7170.2, minY: 2647.1, maxY: 4008.4 }

/** 中国全量 bbox（含南海诸岛），限定最小缩放时参考 */
export const CHINA_FULL_BBOX: BBox = { minX: 5769, maxX: 7170, minY: 2647, maxY: 4019 }

/** 初始取景留白比例（四周各留 4%） */
export const FIT_PADDING = 0.04

/** 最大缩放（约等于把中国放大到单个城市街区级别） */
export const MAX_SCALE = 64

/**
 * 全景档（tier 0）显示哪些点：首都/省会 + 已点亮城市 + 重要度 ≤ 该值的城市。
 * 只显示首都会让大国（如俄罗斯）只剩一两个点、显得空旷；全部显示又会淹没重点，
 * 因此按重要度取一个中间档，并用 TIER0_MAX_CITIES 兜住 DOM 数量。
 */
export const TIER0_MAX_RANK = 4
export const TIER0_MAX_CITIES = 260
/** 缩到世界视野（相对中国取景的缩放比）时也要显示国外城市 —— 此时单独加载城市列表 */
export const WORLD_CITIES_TRIGGER_K = 0.6

/** 城市点选命中半径（屏幕像素） */
export const CITY_HIT_RADIUS = 22

/**
 * 缩放档位：以「中国初始取景缩放」为 1 个基准单位（k = scale / chinaFitScale），
 * 与屏幕尺寸无关，便于在不同机型上保持一致的分级体验。
 *   k < 2      tier 0：世界/中国全景，只显示省会 + 已点亮城市
 *   2 ≤ k < 6  tier 1：显示省级边界 + 全部城市点位
 *   k ≥ 6      tier 2：显示全部标签（做碰撞剔除）
 */
export const TIER1_K = 2
export const TIER2_K = 6

/**
 * 缩放下限系数：最小缩放 = 整个世界刚好装进视口 × 该系数。
 * 取值略小于 1，让「缩到底」时整个世界连同一点余量都在画面里（能一眼看到全球）。
 */
export const MIN_ZOOM_FACTOR = 0.98

/**
 * 精细国界分块网格（必须与 scripts/build-geodata.mjs 保持一致）：
 * 深放大时只加载视野覆盖的那 1~2 块，容差可以做到 0.4 单位（≈2 公里），
 * 从而解决「单文件方案在深放大下折线明显」的问题。
 */
export const DETAIL_TILE_COLS = 16
export const DETAIL_TILE_ROWS = 16
/** 单次最多加载的分块数：超过说明视口太宽（缩放不够深），直接用中等精度层 */
export const DETAIL_TILE_MAX_LOAD = 9

/** 数据文件路径（自身域名静态资源，无第三方依赖） */
export const MAP_DATA = {
  world: '/data/world.json',
  /** 高精度世界国界（放大后替代粗轮廓） */
  worldDetail: '/data/world-detail.json',
  china: '/data/china.json',
  /** 中国地级市 + 世界首都（首屏） */
  cities: '/data/cities.json',
  /** 其余世界城市（放大后惰性加载） */
  worldCities: '/data/cities-world.json',
  provinces: '/data/provinces.json',
  /** 精细国界分块（深放大按需加载） */
  detailTile: (row: number, col: number) => `/data/tiles/detail-${row}-${col}.json`,
} as const
