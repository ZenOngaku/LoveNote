/**
 * ============================================================
 * 足迹地图 · 数据加载（自身域名静态资源，无第三方依赖）
 * ============================================================
 * 首屏：world / china / cities 三个文件并行加载（约 89KB，gzip 后约 33KB）。
 * 省界层（约 87KB）在放大到省级视角（tier≥1）时才惰性加载：模块级 promise
 * 缓存保证只请求一次，失败时清空缓存允许重试。
 */
import { getErrorMessage } from '@/lib/helpers'
import { MAP_DATA } from '@/lib/map/constants'
import type { CitiesLayer, MapBundle, PathsLayer, ProvincesLayer } from '@/lib/map/types'
import type { CityPoint } from '@/lib/types'

/** 抓取并解析 JSON；错误统一转成中文提示（项目惯例） */
async function fetchJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    throw new Error(getErrorMessage(err))
  }
  if (!res.ok) {
    throw new Error(`地图数据加载失败（HTTP ${res.status}），请稍后重试`)
  }
  return (await res.json()) as T
}

/** 首屏数据包：世界轮廓 + 中国轮廓 + 城市点位（三者并行） */
export async function loadMapBundle(): Promise<MapBundle> {
  const [world, china, cities] = await Promise.all([
    fetchJson<PathsLayer>(MAP_DATA.world),
    fetchJson<PathsLayer>(MAP_DATA.china),
    fetchJson<CitiesLayer>(MAP_DATA.cities),
  ])
  return { world, china, cities, provinces: null, worldCities: [], worldDetail: null, detailTiles: {} }
}

let provincesPromise: Promise<ProvincesLayer> | null = null

/** 省界层（惰性加载，模块级缓存；失败后允许重试） */
export function loadProvinces(): Promise<ProvincesLayer> {
  if (!provincesPromise) {
    provincesPromise = fetchJson<ProvincesLayer>(MAP_DATA.provinces).catch((err) => {
      provincesPromise = null
      throw err
    })
  }
  return provincesPromise
}

let worldDetailPromise: Promise<PathsLayer> | null = null

/** 高精度世界国界（放大后惰性加载，模块级缓存；失败后允许重试） */
export function loadWorldDetail(): Promise<PathsLayer> {
  if (!worldDetailPromise) {
    worldDetailPromise = fetchJson<PathsLayer>(MAP_DATA.worldDetail).catch((err) => {
      worldDetailPromise = null
      throw err
    })
  }
  return worldDetailPromise
}

const detailTileCache = new Map<string, Promise<PathsLayer>>()

/** 精细国界分块（按需加载；同一块只请求一次，失败后允许重试） */
export function loadDetailTile(row: number, col: number): Promise<PathsLayer> {
  const key = `${row}-${col}`
  let promise = detailTileCache.get(key)
  if (!promise) {
    promise = fetchJson<PathsLayer>(MAP_DATA.detailTile(row, col)).catch((err) => {
      detailTileCache.delete(key)
      throw err
    })
    detailTileCache.set(key, promise)
  }
  return promise
}

let worldCitiesPromise: Promise<CityPoint[]> | null = null

/**
 * 其余世界城市（放大后惰性加载，模块级缓存）。
 * 产物里省掉了 p / cap / w 三个字段以控制体积，这里补齐：
 * 世界城市没有省级 adcode（p = 0），是否首都一律为否（首都已在首屏数据里），w = 1。
 */
export function loadWorldCities(): Promise<CityPoint[]> {
  if (!worldCitiesPromise) {
    worldCitiesPromise = fetchJson<CitiesLayer>(MAP_DATA.worldCities)
      .then((layer) => layer.cities.map((city) => ({ ...city, p: 0, cap: 0 as const, w: 1 as const })))
      .catch((err) => {
        worldCitiesPromise = null
        throw err
      })
  }
  return worldCitiesPromise
}
