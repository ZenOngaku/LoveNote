'use client'

/**
 * ============================================================
 * 个人设置页 /settings
 * ============================================================
 * - 个人资料：头像（昵称首字）、昵称编辑、登录邮箱
 * - 情侣空间：对方信息 / 未绑定提示、解除配对（二次确认）
 * - 账号：退出登录
 * - 未登录由 AuthGuard 自动跳转登录页
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronRight, Heart, Loader2, LogOut, Pencil, UserRound } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/notes/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDateCN } from '@/lib/helpers'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  )
}

function SettingsContent() {
  const router = useRouter()
  const { user, profile, signOut, updateNickname } = useAuth()
  const { relation, partner, isBound, unbind } = useCouple()

  // 昵称编辑弹窗
  const [nickOpen, setNickOpen] = useState(false)
  const [nickname, setNickname] = useState('')
  const [savingNick, setSavingNick] = useState(false)

  // 解绑 / 退出确认
  const [unbindOpen, setUnbindOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  /** 打开昵称编辑弹窗 */
  function openNickname() {
    setNickname(profile?.nickname ?? '')
    setNickOpen(true)
  }

  /** 保存昵称 */
  async function handleSaveNickname(): Promise<boolean> {
    const name = nickname.trim()
    if (!name) {
      toast.error('昵称不能为空哦')
      return false
    }
    setSavingNick(true)
    const { error } = await updateNickname(name)
    setSavingNick(false)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('昵称已更新 💗')
    setNickOpen(false)
    return true
  }

  /** 解除配对 */
  async function handleUnbind(): Promise<boolean> {
    const { error } = await unbind()
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('已解除配对，共享空间已关闭')
    return true
  }

  /** 退出登录 */
  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    router.replace('/login')
  }

  const displayName = profile?.nickname ?? ''

  return (
    <AppShell title="设置">
      {/* ============ 个人资料卡片 ============ */}
      <section
        aria-label="个人资料"
        className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-4">
          {/* 头像（昵称首字） */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-200 to-rose-100 text-xl font-bold text-rose-500">
            {(displayName || '我').charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold text-stone-800">{displayName || '未设置昵称'}</p>
              <button
                type="button"
                onClick={openNickname}
                aria-label="编辑昵称"
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-rose-50 hover:text-rose-500"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-0.5 truncate text-sm text-stone-400">{user?.email}</p>
          </div>
        </div>
      </section>

      {/* ============ 情侣空间卡片 ============ */}
      <section
        aria-label="情侣空间"
        className="mt-4 rounded-3xl border border-rose-100 bg-white p-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-stone-500">情侣空间</h2>

        {isBound && relation ? (
          <>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-base font-bold text-rose-400">
                {(partner?.nickname || 'TA').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-800">
                  {partner?.nickname || 'TA'}
                </p>
                <p className="mt-0.5 text-xs text-stone-400">
                  {relation.bound_at ? `${formatDateCN(relation.bound_at)} 绑定` : '已绑定'}
                </p>
              </div>
              <Heart className="h-5 w-5 shrink-0 fill-rose-200 text-rose-300" aria-hidden />
            </div>

            <Button
              variant="outline"
              onClick={() => setUnbindOpen(true)}
              className="mt-4 h-11 w-full rounded-full border-red-100 text-sm text-red-400 hover:bg-red-50 hover:text-red-500"
            >
              解除情侣配对
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-3 flex w-full items-center justify-between rounded-2xl bg-rose-50/70 p-4 text-left"
          >
            <div>
              <p className="text-sm font-medium text-stone-700">还未绑定情侣</p>
              <p className="mt-0.5 text-xs text-stone-400">去首页生成或输入邀请码完成配对</p>
            </div>
            <ChevronRight className="h-4 w-4 text-stone-300" aria-hidden />
          </button>
        )}
      </section>

      {/* ============ 账号卡片 ============ */}
      <section
        aria-label="账号"
        className="mt-4 rounded-3xl border border-rose-100 bg-white p-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-stone-500">账号</h2>
        <Button
          variant="outline"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-3 h-11 w-full rounded-full border-red-100 text-sm text-red-400 hover:bg-red-50 hover:text-red-500"
        >
          {signingOut ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <LogOut className="mr-1 h-4 w-4" />}
          退出登录
        </Button>
      </section>

      {/* 页脚 */}
      <p className="mt-8 text-center text-xs text-stone-300">
        LoveNote v1.0 · 愿你们的每一天都被温柔记录 💗
      </p>

      {/* ============ 弹窗们 ============ */}
      {/* 昵称编辑 */}
      <Dialog open={nickOpen} onOpenChange={setNickOpen}>
        <DialogContent className="max-w-[88%] rounded-3xl border-rose-100 bg-white p-5 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-stone-800">修改昵称</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <Label htmlFor="nickname" className="text-stone-600">
              昵称
            </Label>
            <Input
              id="nickname"
              value={nickname}
              maxLength={20}
              placeholder="给自己起一个可爱的名字吧"
              onChange={(e) => setNickname(e.target.value)}
              className="h-12 rounded-xl border-rose-100 text-base"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setNickOpen(false)}
              disabled={savingNick}
              className="h-10 rounded-full px-5 text-stone-500 hover:bg-stone-50"
            >
              取消
            </Button>
            <Button
              onClick={handleSaveNickname}
              disabled={savingNick}
              className="h-10 rounded-full bg-rose-500 px-6 hover:bg-rose-600"
            >
              {savingNick && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 解绑二次确认 */}
      <ConfirmDialog
        open={unbindOpen}
        onOpenChange={setUnbindOpen}
        title="确定解除情侣配对吗？"
        description="解除后共享笔记空间将关闭：双方创建的共享笔记会各自保留在自己的账号下，对方将不再有权访问。"
        confirmText="确定解除"
        danger
        onConfirm={handleUnbind}
      />
    </AppShell>
  )
}
