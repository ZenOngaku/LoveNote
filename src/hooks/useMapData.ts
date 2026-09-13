'use client'

/**
 * ============================================================
 * useMapData —— 足迹地图数据 Hook
 * ============================================================
 * 1. 首屏并行加载 world / china / cities（约 89KB）
 * 2. 放大到省级视角时惰性加载省界层与中等精度国界层
 * 3. 深放大时按视野加载精细国界分块（vector-tile 思路）
 * 3. 加载失败给出中文错误提示 + 重试入口
 *
 * 实现说明：与项目其他 hook 一致 —— 所有 setState 都发生在 await 之后的回调里，
 * loading 由「是否已有数据 / 是否已报错」派生，不在 effect 中同步 setState。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/helpers'
import { loadDetailTile, loadMapBundle, loadProvinces, loadWorldCities, loadWorldDetail } from '@/lib/map/geodata'
import type { MapBundle } from '@/lib/map/types'

export function useMapData() {
  const [bundle, setBundle] = useState<MapBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 重试计数：+1 即触发 effect 重新加载
  const [attempt, setAttempt] = useState(0)
  // 省界层是否已发起过请求（避免放大过程中重复请求）
  const detailRequestedRef = useRef(false)
  // 已请求过的精细分块（避免重复请求）
  const tileRequestsRef = useRef(new Set<string>())
  // 世界城市列表是否已发起过请求
  const worldCitiesRequestedRef = useRef(false)

  // 派生加载态：还没有数据且没有报错 = 正在加载
  const loading = bundle === null && error === null

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await loadMapBundle()
        if (cancelled) return
        setBundle(data)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(getErrorMessage(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt])

  /** 重试加载首屏数据 */
  const retry = useCallback(() => {
    setError(null)
    setAttempt((n) => n + 1)
  }, [])

  /**
   * 确保「细节层」已加载：省界 + 其余世界城市（放大到 tier≥1 时由地图组件调用，可重复调用）。
   * 两者都是放大后才需要的数据，一起并行请求；任一失败只 toast，不阻塞另一个已成功的部分。
   */
  const ensureDetail = useCallback(() => {
    if (detailRequestedRef.current) return
    detailRequestedRef.current = true
    void (async () => {
      const [provinces, worldCities, worldDetail] = await Promise.all([
        loadProvinces().catch((err) => {
          toast.error(getErrorMessage(err))
          return null
        }),
        loadWorldCities().catch((err) => {
          toast.error(getErrorMessage(err))
          return null
        }),
        loadWorldDetail().catch((err) => {
          toast.error(getErrorMessage(err))
          return null
        }),
      ])
      if (provinces || worldCities || worldDetail) {
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                provinces: provinces ?? prev.provinces,
                worldCities: worldCities ?? prev.worldCities,
                worldDetail: worldDetail ?? prev.worldDetail,
              }
            : prev,
        )
      }
      if (!provinces || !worldCities || !worldDetail) detailRequestedRef.current = false // 允许下次放大时重试
    })()
  }, [])

  /**
   * 只加载世界城市列表（缩到世界视野时用）：国外城市点位要显示出来，
   * 但省界与精细国界此刻并不需要，单独加载可以少下几百 KB。
   */
  const ensureWorldCities = useCallback(() => {
    if (worldCitiesRequestedRef.current) return
    worldCitiesRequestedRef.current = true
    void (async () => {
      try {
        const worldCities = await loadWorldCities()
        setBundle((prev) => (prev ? { ...prev, worldCities } : prev))
      } catch (err) {
        worldCitiesRequestedRef.current = false
        toast.error(getErrorMessage(err))
      }
    })()
  }, [])

  /**
   * 确保指定的精细分块已加载（深放大时由地图组件按视野调用，可重复调用）。
   * 已请求过的块不会重复请求；失败的块会从记录中移除以便下次重试。
   */
  const ensureDetailTiles = useCallback((keys: string[]) => {
    const missing = keys.filter((key) => !tileRequestsRef.current.has(key))
    if (missing.length === 0) return
    for (const key of missing) tileRequestsRef.current.add(key)
    void (async () => {
      const results = await Promise.all(
        missing.map(async (key) => {
          const [row, col] = key.split('-').map(Number)
          try {
            const layer = await loadDetailTile(row, col)
            return [key, layer.paths] as const
          } catch (err) {
            tileRequestsRef.current.delete(key) // 允许下次重试
            toast.error(getErrorMessage(err))
            return null
          }
        }),
      )
      const loaded = results.filter((item): item is readonly [string, string[]] => item !== null)
      if (loaded.length > 0) {
        setBundle((prev) =>
          prev ? { ...prev, detailTiles: { ...prev.detailTiles, ...Object.fromEntries(loaded) } } : prev,
        )
      }
    })()
  }, [])

  return { bundle, loading, error, retry, ensureDetail, ensureDetailTiles, ensureWorldCities }
}
