'use client'

/**
 * ============================================================
 * CoupleCard —— 已绑定状态卡片（首页）
 * ============================================================
 * 展示：双方头像（昵称首字）+ 心形连接 + 对方昵称 + 在一起天数
 * 操作：去写笔记 / 解除配对（二次确认）
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, NotebookPen, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/notes/ConfirmDialog'
import { formatDateCN } from '@/lib/helpers'
import type { CoupleRelation, Profile } from '@/lib/types'

interface CoupleCardProps {
  /** 当前登录用户的昵称 */
  myNickname: string
  /** 对方资料（可能为 null，展示兜底文案） */
  partner: Profile | null
  /** 当前情侣关系 */
  relation: CoupleRelation
  /** 解除配对（由父组件调用 RPC） */
  onUnbind: () => Promise<boolean>
}

export function CoupleCard({ myNickname, partner, relation, onUnbind }: CoupleCardProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)

  /** 计算已在一起天数（含绑定当天） */
  const days = relation.bound_at
    ? Math.max(
        1,
        Math.floor((Date.now() - new Date(relation.bound_at).getTime()) / 86_400_000) + 1,
      )
    : 0

  return (
    <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-100 via-white to-rose-50 p-8 text-center shadow-sm dark:border-white/10 dark:from-[#45291b] dark:via-[#3a241a] dark:to-[#33200f]">
      {/* 双头像 + 爱心连接 */}
      <div className="flex items-center justify-center gap-5">
        <AvatarCircle name={myNickname} />
        <Heart className="h-8 w-8 fill-rose-300 text-rose-400" aria-hidden />
        <AvatarCircle name={partner?.nickname ?? null} fallbackLabel="TA" />
      </div>

      <p className="mt-5 text-lg font-semibold text-stone-800 dark:text-rose-50">
        {myNickname || '我'} & {partner?.nickname || 'TA'}
      </p>
      <p className="mt-1 text-sm text-stone-400 dark:text-rose-200/50">
        {relation.bound_at ? `${formatDateCN(relation.bound_at)} 绑定` : '已绑定'}
      </p>
      <p className="mt-1 text-sm text-rose-400">💞 已经一起记录了 {days} 天</p>

      {/* 去写笔记 */}
      <Button
        onClick={() => router.push('/notes')}
        className="mt-6 h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
      >
        <NotebookPen className="mr-1 h-4 w-4" />
        去写笔记
      </Button>

      {/* 解除配对入口 */}
      <Button
        variant="ghost"
        onClick={() => setConfirmOpen(true)}
        className="mt-2 h-10 w-full rounded-full text-sm text-stone-400 hover:bg-white/60 hover:text-red-400 dark:text-rose-200/50 dark:hover:bg-white/10"
      >
        <Unlink className="mr-1 h-4 w-4" />
        解除情侣配对
      </Button>

      {/* 解绑二次确认：确认后调用 RPC，失败时由内部 toast 提示并保持弹窗 */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确定解除情侣配对吗？"
        description="解除后共享笔记空间将关闭：双方创建的共享笔记会各自保留在自己的账号下，对方将不再有权访问。"
        confirmText="确定解除"
        danger
        onConfirm={async () => await onUnbind()}
      />
    </div>
  )
}

/** 昵称首字头像圆 */
function AvatarCircle({ name, fallbackLabel = '我' }: { name: string | null; fallbackLabel?: string }) {
  const first = (name ?? '').trim().charAt(0).toUpperCase() || fallbackLabel
  return (
    <div
      aria-hidden
      className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-rose-400 shadow-sm ring-1 ring-rose-100 dark:bg-[#3a241a] dark:ring-white/15"
    >
      {first}
    </div>
  )
}
