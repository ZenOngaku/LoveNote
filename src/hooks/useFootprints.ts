'use client'

/**
 * ============================================================
 * useFootprints —— 足迹数据 Hook（情侣共享，含 Supabase Realtime）
 * ============================================================
 * 功能：
 * 1. 加载当前情侣空间的全部足迹记录（按到访日期正序）
 * 2. 新增 / 编辑 / 删除记录（城市信息由地图选中项带入，写库前归一化标签）
 * 3. 本地派生「已点亮城市」聚合与「按城市分组」索引，供地图与城市面板直接使用
 * 4. Realtime 监听 footprints 表：任一方记录/编辑/删除后，双方页面自动刷新
 *
 * 实现说明（与 useNotes 保持一致的范式）：
 * - loadFootprints 为「纯查询」函数（不直接改状态，返回数据）；
 * - 所有 setState 都发生在 await 之后的回调里，符合 React 官方数据获取范式；
 * - loading 由「已完成加载的数据身份 key」派生，不在 effect 中同步 setState。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getSupabase } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/helpers'
import { buildVisitedCities, groupByCity, normalizeTags, sortFootprints } from '@/lib/footprints'
import { useAuth } from '@/hooks/useAuth'
import type {
  Footprint,
  FootprintInput,
  FootprintResult,
  OpResult,
  VisitedCity,
} from '@/lib/types'

/** 单次加载上限：情侣足迹场景足够，避免极端数据量拖慢地图 */
const MAX_FOOTPRINTS = 500

export function useFootprints(coupleId: string | null) {
  const { user } = useAuth()
  const [footprints, setFootprints] = useState<Footprint[]>([])
  // 已完成加载的数据身份 key：用于派生 loading，避免在 effect 中同步 setState
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  // 足迹恒为情侣共享：必须已登录且已绑定情侣
  const ready = Boolean(user) && Boolean(coupleId)
  // 数据身份：登录用户 + 共享空间，任一变化即视为需要重新加载
  const currentKey = `${user?.id ?? 'anon'}-${coupleId ?? 'none'}`
  // 派生 loading：可加载状态下，当前数据身份还没完成过一次加载 → 展示骨架屏
  const loading = ready && loadedKey !== currentKey
  // 对外展示的记录：不可加载时恒为空（由页面展示引导状态）
  const visibleFootprints = ready ? footprints : []

  /**
   * 纯查询：拉取当前情侣空间的全部足迹（按到访日期正序，同日按创建时间正序）。
   * 不直接修改状态：成功返回数组；失败时 toast 并返回 null。
   */
  const loadFootprints = useCallback(async (): Promise<Footprint[] | null> => {
    if (!user || !coupleId) return []
    const { data, error } = await getSupabase()
      .from('footprints')
      .select('*')
      .eq('couple_id', coupleId)
      .order('visited_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(MAX_FOOTPRINTS)
    if (error) {
      toast.error(getErrorMessage(error))
      return null
    }
    // 客户端再排一次序：城市面板的「按时间展示」不依赖服务端返回顺序
    return sortFootprints((data as Footprint[]) ?? [])
  }, [user, coupleId])

  // 数据身份变化（首次进入 / 绑定状态变化）时加载
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      const result = await loadFootprints()
      if (cancelled) return
      if (result) setFootprints(result)
      setLoadedKey(currentKey)
    })()
    return () => {
      cancelled = true
    }
  }, [ready, loadFootprints, currentKey])

  // Realtime：footprints 表任何变更后自动刷新（遵循 RLS，只会收到自己有权看到的数据）
  useEffect(() => {
    if (!user || !ready) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`footprints-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'footprints' },
        () => {
          // 外部系统事件回调中刷新状态（React 推荐的订阅模式）
          void (async () => {
            const result = await loadFootprints()
            if (result) setFootprints(result)
          })()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, ready, loadFootprints])

  /** 新增足迹记录（城市信息由地图选中项带入；标签写库前归一化） */
  const createFootprint = useCallback(
    async (input: FootprintInput): Promise<FootprintResult> => {
      if (!user) return { error: '请先登录', footprint: null }
      if (!coupleId) return { error: '尚未绑定情侣，无法记录足迹', footprint: null }
      const { data, error } = await getSupabase()
        .from('footprints')
        .insert({
          user_id: user.id,
          couple_id: coupleId,
          city_adcode: input.city_adcode,
          city_name: input.city_name,
          province_adcode: input.province_adcode,
          title: input.title,
          tags: normalizeTags(input.tags),
          visited_at: input.visited_at,
          content: input.content,
        })
        .select()
        .single()
      if (error) return { error: getErrorMessage(error), footprint: null }
      const row = data as Footprint
      // 本地插入 + 重排（避免一次额外查询；顺序与时间线一致）
      setFootprints((prev) => sortFootprints([...prev, row]))
      return { error: null, footprint: row }
    },
    [user, coupleId],
  )

  /** 编辑记录（updated_at 由数据库触发器自动更新，回写本地行保持最新） */
  const updateFootprint = useCallback(
    async (id: string, input: FootprintInput): Promise<OpResult> => {
      const { data, error } = await getSupabase()
        .from('footprints')
        .update({
          title: input.title,
          tags: normalizeTags(input.tags),
          visited_at: input.visited_at,
          content: input.content,
        })
        .eq('id', id)
        .select()
        .single()
      if (error) return { error: getErrorMessage(error) }
      const row = data as Footprint
      setFootprints((prev) => sortFootprints(prev.map((f) => (f.id === id ? row : f))))
      return { error: null }
    },
    [],
  )

  /** 删除记录（RLS 保证：仅当前情侣空间或创建者本人可删） */
  const removeFootprint = useCallback(async (id: string): Promise<OpResult> => {
    const { error } = await getSupabase().from('footprints').delete().eq('id', id)
    if (error) return { error: getErrorMessage(error) }
    // 本地立即移除，Realtime 会通知另一方刷新
    setFootprints((prev) => prev.filter((f) => f.id !== id))
    return { error: null }
  }, [])

  // 派生：已点亮城市聚合（地图用）与按城市分组（城市面板时间线用）
  const visitedCities = useMemo<Map<number, VisitedCity>>(
    () => buildVisitedCities(visibleFootprints),
    [visibleFootprints],
  )
  const byCity = useMemo(() => groupByCity(visibleFootprints), [visibleFootprints])

  return {
    footprints: visibleFootprints,
    byCity,
    visitedCities,
    loading,
    ready,
    createFootprint,
    updateFootprint,
    removeFootprint,
  }
}
