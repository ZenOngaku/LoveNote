'use client'

/**
 * ============================================================
 * useNotes —— 笔记数据 Hook（含 Supabase Realtime 实时同步）
 * ============================================================
 * 功能：
 * 1. 按类型加载笔记列表（shared 共享 / private 私人），按最后修改时间倒序
 * 2. 新建 / 编辑 / 删除笔记（文档级同步：保存后写库，由 Realtime 通知对方刷新）
 * 3. Realtime 监听 notes 表：任意一方修改笔记，双方页面自动刷新到最新内容
 *
 * 同步策略（第一版文档级同步，无多人光标）：
 * 用户点击保存 → 更新数据库 → Supabase Realtime 推送变更 → 双方页面重新拉取列表。
 * Realtime 推送遵循 RLS：私人笔记只推送给本人，共享笔记只推送给绑定双方。
 *
 * 实现说明：loadNotes 为「纯查询」函数（不直接改状态，返回数据）；
 * 所有 setState 都发生在 await 之后的回调里，符合 React 官方数据获取范式。
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getSupabase } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/helpers'
import { useAuth } from '@/hooks/useAuth'
import type { Note, NoteInput, NoteResult, NoteType, OpResult } from '@/lib/types'

export function useNotes(noteType: NoteType, coupleId: string | null) {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  // 已完成加载的数据身份 key：用于派生 loading，避免在 effect 中同步 setState
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  // 该类型当前是否可加载：私人笔记只需登录；共享笔记需要已绑定（有 coupleId）
  const ready = Boolean(user) && (noteType === 'private' || Boolean(coupleId))
  // 数据身份：登录用户 + 笔记类型 + 共享空间，任一变化即视为需要重新加载
  const currentKey = `${user?.id ?? 'anon'}-${noteType}-${coupleId ?? 'none'}`
  // 派生 loading：可加载状态下，当前数据身份还没完成过一次加载 → 展示骨架屏
  const loading = ready && loadedKey !== currentKey
  // 对外展示的列表：不可加载时恒为空（由页面展示引导空状态）
  const visibleNotes = ready ? notes : []

  /**
   * 纯查询：按当前类型拉取笔记列表（按最后修改时间倒序）。
   * 不直接修改状态：成功返回数据数组；失败时 toast 并返回 null。
   */
  const loadNotes = useCallback(async (): Promise<Note[] | null> => {
    if (!user) return []
    const supabase = getSupabase()
    let query = supabase
      .from('notes')
      .select('*')
      .eq('note_type', noteType)
      .order('updated_at', { ascending: false })

    if (noteType === 'private') {
      // 私人笔记：RLS 已保证只返回本人数据，这里显式过滤更直观
      query = query.eq('user_id', user.id)
    } else if (coupleId) {
      // 共享笔记：只展示当前共享空间（couple_id）的笔记
      query = query.eq('couple_id', coupleId)
    }

    const { data, error } = await query
    if (error) {
      toast.error(getErrorMessage(error))
      return null
    }
    return (data as Note[]) ?? []
  }, [user, noteType, coupleId])

  // 数据身份变化（首次进入 / 切换 Tab / 绑定状态变化）时加载列表
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      const result = await loadNotes()
      if (cancelled) return
      if (result) setNotes(result)
      setLoadedKey(currentKey)
    })()
    return () => {
      cancelled = true
    }
  }, [ready, loadNotes, currentKey])

  // Realtime：notes 表任何变更后自动刷新列表（遵循 RLS，只会收到自己有权看到的数据）
  useEffect(() => {
    if (!user || !ready) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`notes-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => {
          // 外部系统事件回调中刷新状态（React 推荐的订阅模式）
          void (async () => {
            const result = await loadNotes()
            if (result) setNotes(result)
          })()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, ready, loadNotes])

  /**
   * 新建笔记（共享笔记必须已绑定情侣，couple_id 由 RLS 校验）。
   * 返回创建后的完整笔记行——「新建即进入全屏编辑」需要立刻拿到 id。
   */
  const createNote = useCallback(
    async (input: NoteInput): Promise<NoteResult> => {
      if (!user) return { error: '请先登录', note: null }
      if (noteType === 'shared' && !coupleId) {
        return { error: '尚未绑定情侣，无法使用共享笔记', note: null }
      }
      const { data, error } = await getSupabase()
        .from('notes')
        .insert({
          title: input.title,
          content: input.content,
          note_type: noteType,
          user_id: user.id,
          couple_id: noteType === 'shared' ? coupleId : null,
        })
        .select()
        .single()
      if (error) return { error: getErrorMessage(error), note: null }
      const note = data as Note
      // 列表头插新建笔记（避免一次额外的查询；顺序与 updated_at 倒序一致）
      setNotes((prev) => [note, ...prev])
      return { error: null, note }
    },
    [user, noteType, coupleId],
  )

  /** 编辑笔记（updated_at 由数据库触发器自动更新） */
  const updateNote = useCallback(
    async (id: string, input: NoteInput): Promise<OpResult> => {
      const { error } = await getSupabase()
        .from('notes')
        .update({ title: input.title, content: input.content })
        .eq('id', id)
      if (error) return { error: getErrorMessage(error) }
      const result = await loadNotes()
      if (result) setNotes(result)
      return { error: null }
    },
    [loadNotes],
  )

  /** 删除笔记（RLS 保证：私人仅本人可删，共享仅情侣双方可删） */
  const removeNote = useCallback(async (id: string): Promise<OpResult> => {
    const { error } = await getSupabase().from('notes').delete().eq('id', id)
    if (error) return { error: getErrorMessage(error) }
    // 本地立即移除，Realtime 会通知另一方刷新
    setNotes((prev) => prev.filter((n) => n.id !== id))
    return { error: null }
  }, [])

  return { notes: visibleNotes, loading, ready, createNote, updateNote, removeNote }
}
