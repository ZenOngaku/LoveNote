'use client'

/**
 * ============================================================
 * 首页（配对页）/
 * ============================================================
 * 登录后的第一个页面：
 * - 未绑定：展示 PairPanel（生成邀请码 / 输入邀请码）
 * - 已绑定：展示 CoupleCard（双方信息 + 去写笔记 + 解除配对）
 * - 未登录：由 AuthGuard 自动跳转登录页
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { ConfigNotice } from '@/components/layout/ConfigNotice'
import { PairPanel } from '@/components/pair/PairPanel'
import { CoupleCard } from '@/components/pair/CoupleCard'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  )
}

function HomeContent() {
  const { user, profile } = useAuth()
  const {
    relation,
    partner,
    loading,
    isBound,
    pendingInvite,
    generateInviteCode,
    redeemInviteCode,
    cancelInvite,
    unbind,
  } = useCouple()

  // 操作进行中标记（控制按钮 loading，避免重复提交）
  const [acting, setActing] = useState(false)

  /** 生成邀请码 */
  async function handleGenerate(): Promise<boolean> {
    if (acting) return false
    setActing(true)
    const { error } = await generateInviteCode()
    setActing(false)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('邀请码已生成，24 小时内有效')
    return true
  }

  /** 输入邀请码完成绑定 */
  async function handleRedeem(code: string): Promise<boolean> {
    if (acting) return false
    setActing(true)
    const { error } = await redeemInviteCode(code)
    setActing(false)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('绑定成功，祝你们幸福 💗')
    return true
  }

  /** 取消自己发出的邀请 */
  async function handleCancelInvite(relationId: string): Promise<boolean> {
    if (acting) return false
    setActing(true)
    const { error } = await cancelInvite(relationId)
    setActing(false)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('邀请已取消')
    return true
  }

  /** 解除情侣配对 */
  async function handleUnbind(): Promise<boolean> {
    const { error } = await unbind()
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('已解除配对，共享空间已关闭')
    return true
  }

  return (
    <AppShell title="CoupleNote">
      <ConfigNotice />

      {/* 问候语 */}
      <div className="mb-5">
        <p className="text-sm text-stone-400">Hi，{profile?.nickname || '亲爱的'} 👋</p>
        <h2 className="mt-0.5 text-xl font-bold text-stone-800">
          {isBound ? '欢迎回到你们的空间' : '先和另一半完成配对吧'}
        </h2>
      </div>

      {/* 加载中骨架屏 */}
      {loading ? (
        <div className="rounded-3xl border border-rose-100 bg-white p-8 shadow-sm">
          <Skeleton className="mx-auto h-16 w-16 rounded-full bg-rose-100" />
          <Skeleton className="mx-auto mt-4 h-5 w-32 bg-rose-100" />
          <Skeleton className="mx-auto mt-6 h-12 w-full rounded-full bg-rose-50" />
        </div>
      ) : isBound && relation ? (
        /* 已绑定：情侣卡片 */
        <CoupleCard
          myNickname={profile?.nickname || ''}
          partner={partner}
          relation={relation}
          onUnbind={handleUnbind}
        />
      ) : (
        /* 未绑定：配对面板 */
        <PairPanel
          pendingInvite={pendingInvite}
          acting={acting}
          onGenerate={handleGenerate}
          onRedeem={handleRedeem}
          onCancelInvite={handleCancelInvite}
        />
      )}
    </AppShell>
  )
}
