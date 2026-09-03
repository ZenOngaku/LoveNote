'use client'

/**
 * ============================================================
 * useCouple —— 情侣配对关系 Hook
 * ============================================================
 * 功能：
 * 1. 查询当前用户所处的情侣关系（进行中的邀请 / 已绑定的关系）
 * 2. 生成 6 位邀请码（24 小时有效）—— 调用数据库 RPC，原子操作
 * 3. 输入对方邀请码完成绑定 —— 调用数据库 RPC，原子操作
 * 4. 取消自己发出的邀请 / 解除情侣配对
 * 5. Realtime 监听 couple_relation 表：对方完成绑定或解绑时，本方页面自动刷新
 *
 * 安全说明：绑定/解绑等敏感操作全部走 Supabase 数据库函数（security definer），
 *          在数据库内部做严格校验，配合 RLS 杜绝越权，详见 supabase/schema.sql。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/helpers'
import { useAuth } from '@/hooks/useAuth'
import type { CoupleRelation, OpResult, Profile } from '@/lib/types'

export function useCouple() {
  const { user } = useAuth()
  const [relation, setRelation] = useState<CoupleRelation | null>(null)
  const [partner, setPartner] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * 查询与当前用户相关、且「尚未结束」的关系（pending 或 active）。
   * RLS 保证只能查到自己是 user_a / user_b 的行，外人无法窥探邀请码。
   */
  const refresh = useCallback(async () => {
    if (!user) {
      setRelation(null)
      setPartner(null)
      setLoading(false)
      return
    }
    const supabase = getSupabase()
    const { data } = await supabase
      .from('couple_relation')
      .select('*')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const rel = (data as CoupleRelation | null) ?? null
    setRelation(rel)

    // 已绑定时，加载对方资料（RLS 策略允许情侣双方互相查看资料）
    if (rel?.status === 'active') {
      const partnerId = rel.user_a_id === user.id ? rel.user_b_id : rel.user_a_id
      if (partnerId) {
        const { data: p } = await supabase
          .from('users')
          .select('*')
          .eq('id', partnerId)
          .maybeSingle()
        setPartner((p as Profile | null) ?? null)
      }
    } else {
      setPartner(null)
    }
    setLoading(false)
  }, [user])

  // 首次加载 + 登录状态变化时查询
  useEffect(() => {
    refresh()
  }, [refresh])

  // Realtime：couple_relation 表变更（对方绑定成功 / 解绑）时自动刷新本方页面
  useEffect(() => {
    if (!user) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`couple-relation-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couple_relation' },
        () => {
          refresh()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refresh])

  /** 生成 6 位数字邀请码（24 小时有效）；已有未过期邀请码时直接返回它 */
  const generateInviteCode = useCallback(async (): Promise<OpResult> => {
    const { data, error } = await getSupabase().rpc('generate_invite_code')
    if (error) return { error: getErrorMessage(error) }
    setRelation(data as CoupleRelation)
    return { error: null }
  }, [])

  /** 输入对方邀请码完成绑定 */
  const redeemInviteCode = useCallback(
    async (code: string): Promise<OpResult> => {
      const { data, error } = await getSupabase().rpc('redeem_invite_code', { p_code: code })
      if (error) return { error: getErrorMessage(error) }
      setRelation(data as CoupleRelation)
      // 重新拉取一次，顺便加载对方资料
      await refresh()
      return { error: null }
    },
    [refresh],
  )

  /** 取消自己发出的待处理邀请（RLS 仅允许删除自己的 pending 行） */
  const cancelInvite = useCallback(
    async (relationId: string): Promise<OpResult> => {
      const { error } = await getSupabase()
        .from('couple_relation')
        .delete()
        .eq('id', relationId)
        .eq('status', 'pending')
      if (error) return { error: getErrorMessage(error) }
      setRelation(null)
      return { error: null }
    },
    [],
  )

  /** 解除情侣配对（RPC 原子操作，双方页面通过 Realtime 自动同步） */
  const unbind = useCallback(async (): Promise<OpResult> => {
    const { error } = await getSupabase().rpc('unbind_couple')
    if (error) return { error: getErrorMessage(error) }
    setRelation(null)
    setPartner(null)
    return { error: null }
  }, [])

  // 派生状态
  const isBound = relation?.status === 'active'
  const pendingInvite = relation?.status === 'pending' ? relation : null
  /** 自己发出的邀请码是否已过期（过期后前端展示「重新生成」入口） */
  const inviteExpired = useMemo(() => {
    if (pendingInvite && pendingInvite.expires_at) {
      return new Date(pendingInvite.expires_at).getTime() <= Date.now()
    }
    return false
  }, [pendingInvite])

  return {
    relation,
    partner,
    loading,
    isBound,
    pendingInvite,
    inviteExpired,
    generateInviteCode,
    redeemInviteCode,
    cancelInvite,
    unbind,
    refresh,
  }
}
