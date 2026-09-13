/**
 * ============================================================
 * 足迹地图 · 精细国界分块（vector-tile 思路的运行时部分）
 * ============================================================
 * 世界被切成 DETAIL_TILE_COLS × DETAIL_TILE_ROWS 块（与构建脚本一致），
 * 深放大时只加载视野覆盖的那几块 —— 分块的意义就在于「细容差」与「小体积」可以兼得。
 */
import { DETAIL_TILE_COLS, DETAIL_TILE_MAX_LOAD, DETAIL_TILE_ROWS, MAP_UNIT } from '@/lib/map/constants'
import { toMap } from '@/lib/map/viewport'
import type { MapView, Viewport } from '@/lib/map/types'

/** 分块尺寸（地图单位） */
export const TILE_W = MAP_UNIT / DETAIL_TILE_COLS
export const TILE_H = MAP_UNIT / DETAIL_TILE_ROWS

/** 分块引用（row/col 从 0 开始） */
export interface TileRef {
  row: number
  col: number
}

/** 分块的缓存键，与产物文件名一致（detail-<row>-<col>.json） */
export function tileKey(row: number, col: number): string {
  return `${row}-${col}`
}

/**
 * 视野覆盖到的分块。
 * 视口太宽时（缩放不够深）返回空数组 —— 调用方继续用中等精度层，
 * 避免为了看一个省而把几十块精细数据全拉下来。
 */
export function tilesInView(view: MapView, viewport: Viewport, margin = 0.2): TileRef[] {
  const [x0, y0] = toMap(view, 0, 0)
  const [x1, y1] = toMap(view, viewport.w, viewport.h)
  const padX = (x1 - x0) * margin
  const padY = (y1 - y0) * margin
  const colFrom = Math.max(0, Math.floor((x0 - padX) / TILE_W))
  const colTo = Math.min(DETAIL_TILE_COLS - 1, Math.floor((x1 + padX) / TILE_W))
  const rowFrom = Math.max(0, Math.floor((y0 - padY) / TILE_H))
  const rowTo = Math.min(DETAIL_TILE_ROWS - 1, Math.floor((y1 + padY) / TILE_H))
  const out: TileRef[] = []
  for (let row = rowFrom; row <= rowTo; row += 1) {
    for (let col = colFrom; col <= colTo; col += 1) out.push({ row, col })
  }
  return out.length > DETAIL_TILE_MAX_LOAD ? [] : out
}
