/**
 * ============================================================
 * 足迹（footprints）纯函数工具
 * ============================================================
 * 内容：预设标签 / 标签归一化 / 日期处理 / 排序 / 城市聚合 / 标签碰撞剔除。
 * 全部为无副作用纯函数（无 DOM、无 React、无网络），便于用 node 内联断言验证。
 *
 * ⚠️ 日期时区约定：visited_at 是数据库 date 类型，前端全程使用 YYYY-MM-DD 字符串。
 *    禁止使用 toISOString().slice(0, 10)（它是 UTC，在东八区凌晨 0-8 点会把日期
 *    串成前一天），统一走本文件的 toISODate / todayISO（本地时区）。
 */
import { formatDateCN } from '@/lib/helpers'
import type { CityPoint, Footprint, VisitedCity } from '@/lib/types'

/** 预设标签（可多选，也允许用户自定义） */
export const FOOTPRINT_PRESET_TAGS = [
  '美食',
  '风景',
  '住宿',
  '交通',
  '购物',
  '第一次',
  '纪念日',
  '夜游',
  '拍照',
  '避雷',
  '推荐',
  '惊喜',
] as const

/** 标签最大字数（与前端归一化一致） */
export const TAG_MAX_LEN = 12
/** 单条记录最大标签数（与数据库 footprints_tags_count 约束一致） */
export const TAG_MAX_COUNT = 8
/** 标题最大字数（与数据库 footprints_title_len 约束一致） */
export const TITLE_MAX_LEN = 60
/** 正文字数上限（与数据库 footprints_content_len 约束一致） */
export const CONTENT_MAX_LEN = 2000

/**
 * 标签归一化：trim → 丢弃空串 → 截断到 TAG_MAX_LEN 字 → 去重 → 最多保留 TAG_MAX_COUNT 个。
 * 写库前必须调用，避免脏数据撞上数据库 check 约束。
 */
export function normalizeTags(tags: string[]): string[] {
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim().slice(0, TAG_MAX_LEN)
    if (!tag || out.includes(tag)) continue
    out.push(tag)
    if (out.length >= TAG_MAX_COUNT) break
  }
  return out
}

/**
 * Date → YYYY-MM-DD（本地时区）。
 * ⚠️ 不要用 toISOString().slice(0, 10)：UTC 在东八区凌晨会把日期串成前一天。
 */
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 本地「今天」的 YYYY-MM-DD（表单默认值） */
export function todayISO(): string {
  return toISODate(new Date())
}

/** 日期的星期中文（时间线副标题用）；非法输入返回空串 */
export function weekdayCN(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
}

/** 时间线展示日期：2024年5月1日 · 周三；非法输入返回空串 */
export function formatVisitCN(iso: string): string {
  const date = formatDateCN(iso)
  if (!date) return ''
  const week = weekdayCN(iso)
  return week ? `${date} · ${week}` : date
}

/** 时间线排序：visited_at 升序 → created_at 升序（同一城市内按时间正序展示） */
export function sortFootprints(list: Footprint[]): Footprint[] {
  return [...list].sort((a, b) => {
    if (a.visited_at !== b.visited_at) return a.visited_at < b.visited_at ? -1 : 1
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
    return 0
  })
}

/** 按城市分组（城市面板时间线用）：adcode → 该城市所有记录（时间正序） */
export function groupByCity(list: Footprint[]): Map<number, Footprint[]> {
  const map = new Map<number, Footprint[]>()
  for (const f of sortFootprints(list)) {
    const arr = map.get(f.city_adcode)
    if (arr) arr.push(f)
    else map.set(f.city_adcode, [f])
  }
  return map
}

/** 由记录列表派生「已点亮城市」聚合表（城市点亮 = 至少一条记录） */
export function buildVisitedCities(list: Footprint[]): Map<number, VisitedCity> {
  const map = new Map<number, VisitedCity>()
  for (const f of list) {
    const current = map.get(f.city_adcode)
    if (!current) {
      map.set(f.city_adcode, {
        adcode: f.city_adcode,
        cityName: f.city_name,
        count: 1,
        firstVisit: f.visited_at,
        lastVisit: f.visited_at,
        tags: [...f.tags],
      })
      continue
    }
    current.count += 1
    if (f.visited_at < current.firstVisit) current.firstVisit = f.visited_at
    if (f.visited_at > current.lastVisit) current.lastVisit = f.visited_at
    for (const tag of f.tags) {
      if (!current.tags.includes(tag)) current.tags.push(tag)
    }
  }
  return map
}

/** 标签碰撞剔除用的字号（px，屏幕空间；与 globals.css 的 .fp-label 保持一致） */
const LABEL_FONT_PX = 12
/** 标签剔除后最多保留的标签数（兼顾可读性与移动端渲染开销） */
const LABEL_MAX_COUNT = 260

/**
 * 标签碰撞剔除：按「已点亮城市 → 省会 → adcode」贪心保留互不重叠的标签。
 * 只依赖 scale（不依赖平移量），因此拖动地图不会触发重算。
 * 注意：坐标与盒模型都在「地图单位」空间，标签尺寸需除以 scale（counter-scale 后屏幕字号恒定）。
 */
export function cullLabels(cities: CityPoint[], scale: number, lit: Set<number>): Set<number> {
  const out = new Set<number>()
  if (!Number.isFinite(scale) || scale <= 0) return out

  const fontMap = LABEL_FONT_PX / scale
  const ordered = [...cities].sort((a, b) => {
    const litA = lit.has(a.a) ? 0 : 1
    const litB = lit.has(b.a) ? 0 : 1
    if (litA !== litB) return litA - litB
    // 首都/省会优先（cap 缺省视为 0）
    if ((a.cap ?? 0) !== (b.cap ?? 0)) return (b.cap ?? 0) - (a.cap ?? 0)
    return a.a - b.a
  })

  const kept: Array<[number, number, number, number]> = []
  for (const city of ordered) {
    if (out.size >= LABEL_MAX_COUNT) break
    // 宽度估算必须区分中英文字宽：中文 ≈ 1em/字，拉丁 ≈ 0.6em/字
    // （统一按 0.62em 估算会让中文标签的实际宽度被低估约 1.6 倍 → 标签互相压字）
    let emWidth = 0
    for (const ch of city.n) emWidth += ch.codePointAt(0)! > 0x2e80 ? 1 : 0.6
    const w = (emWidth + 0.4) * fontMap
    const h = fontMap * 1.25
    // 标签绘制在点位正上方（与 CityMarker 的 y = -11 * k 对应）
    const cy = city.y - fontMap * 0.92
    const box: [number, number, number, number] = [
      city.x - w / 2,
      cy - h / 2,
      city.x + w / 2,
      cy + h / 2,
    ]
    const collided = kept.some(
      (b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1],
    )
    if (collided) continue
    kept.push(box)
    out.add(city.a)
  }
  return out
}
