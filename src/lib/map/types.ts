/**
 * ============================================================
 * 足迹地图 · 类型定义（与 public/data/*.json 的产物结构对应）
 * ============================================================
 */
import type { CityPoint } from '@/lib/types'

export type { CityPoint }

/** 地图视口变换：屏幕坐标 = 地图坐标 * scale + 平移量 */
export interface MapView {
  tx: number
  ty: number
  scale: number
}

/** 视口尺寸（CSS 像素，由容器实测） */
export interface Viewport {
  w: number
  h: number
}

/** 地图坐标包围盒（地图单位） */
export interface BBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** world.json / china.json：预投影好的轮廓路径 */
export interface PathsLayer {
  unit: number
  paths: string[]
}

/** provinces.json：省级边界（附带 adcode 与短名，便于后续做省份统计） */
export interface ProvinceLayer {
  a: number
  n: string
  d: string[]
}

export interface ProvincesLayer {
  unit: number
  provinces: ProvinceLayer[]
}

/** cities.json：全国地级市点位 */
export interface CitiesLayer {
  unit: number
  cities: CityPoint[]
}

/** 首屏加载的完整地图数据包 */
export interface MapBundle {
  /** 世界国界（110m 粗轮廓，缩小时用） */
  world: PathsLayer
  /** 高精度世界国界（50m，放大后替代粗轮廓，含国界线） */
  worldDetail: PathsLayer | null
  china: PathsLayer
  /** 中国地级市 + 世界首都 */
  cities: CitiesLayer
  /** 省级边界（tier≥1 惰性加载，未加载时为 null） */
  provinces: ProvincesLayer | null
  /** 其余世界城市（tier≥1 惰性加载，未加载时为 []） */
  worldCities: CityPoint[]
  /** 已加载的精细分块（key = "row-col"，深放大时按视野加载） */
  detailTiles: Record<string, string[]>
}
