'use client'

/**
 * ============================================================
 * PairPanel —— 情侣配对面板（首页，未绑定状态）
 * ============================================================
 * 两个模式（Tab 切换）：
 * 1. 生成邀请码：生成 6 位数字邀请码（24 小时有效），展示倒计时/复制/重新生成
 * 2. 输入邀请码：使用 InputOTP 六格输入框，输入对方的邀请码完成绑定
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, HeartHandshake, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { copyText, isValidInviteCode } from '@/lib/helpers'
import type { CoupleRelation } from '@/lib/types'

interface PairPanelProps {
  /** 自己发出的待处理邀请（可能为 null） */
  pendingInvite: CoupleRelation | null
  /** 操作进行中（生成/绑定/取消按钮的 loading 状态由父组件统一控制） */
  acting: boolean
  /** 生成邀请码 */
  onGenerate: () => Promise<boolean>
  /** 输入邀请码绑定 */
  onRedeem: (code: string) => Promise<boolean>
  /** 取消自己发出的邀请 */
  onCancelInvite: (relationId: string) => Promise<boolean>
}

export function PairPanel({
  pendingInvite,
  acting,
  onGenerate,
  onRedeem,
  onCancelInvite,
}: PairPanelProps) {
  const [mode, setMode] = useState<string>('generate')
  const [code, setCode] = useState('')

  /** 复制邀请码到剪贴板 */
  async function handleCopy() {
    if (!pendingInvite) return
    const ok = await copyText(pendingInvite.invite_code)
    if (ok) {
      toast.success('邀请码已复制，快发给你的另一半吧 💗')
    } else {
      toast.error('复制失败，请手动记录邀请码')
    }
  }

  /** 提交绑定 */
  async function handleRedeem() {
    if (!isValidInviteCode(code)) {
      toast.error('请输入完整的 6 位数字邀请码')
      return
    }
    await onRedeem(code)
  }

  return (
    <Tabs value={mode} onValueChange={setMode}>
      {/* 模式切换 */}
      <TabsList className="mb-4 grid h-11 w-full grid-cols-2 rounded-full bg-rose-100/70 p-1 dark:bg-white/10">
        <TabsTrigger
          value="generate"
          className="rounded-full text-sm data-[state=active]:bg-white data-[state=active]:text-rose-500 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/15 dark:data-[state=active]:text-rose-300"
        >
          生成邀请码
        </TabsTrigger>
        <TabsTrigger
          value="enter"
          className="rounded-full text-sm data-[state=active]:bg-white data-[state=active]:text-rose-500 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/15 dark:data-[state=active]:text-rose-300"
        >
          输入邀请码
        </TabsTrigger>
      </TabsList>

      {/* ============ 模式一：生成邀请码 ============ */}
      <TabsContent value="generate">
        {pendingInvite ? (
          <InviteCodeDisplay
            relation={pendingInvite}
            acting={acting}
            onCopy={handleCopy}
            onRegenerate={onGenerate}
            onCancel={() => onCancelInvite(pendingInvite.id)}
          />
        ) : (
          <div className="rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#3a241a]/85">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 dark:bg-white/10">
              <Sparkles className="h-7 w-7 text-rose-400" />
            </div>
            <h3 className="mt-4 font-semibold text-stone-800 dark:text-rose-50">生成专属邀请码</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-400 dark:text-rose-200/50">
              生成一串 6 位数字邀请码，
              <br />
              有效期 24 小时，只能绑定一位情侣哦
            </p>
            <Button
              disabled={acting}
              onClick={() => onGenerate()}
              className="mt-6 h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
            >
              {acting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <HeartHandshake className="mr-1 h-4 w-4" />}
              生成邀请码
            </Button>
          </div>
        )}
      </TabsContent>

      {/* ============ 模式二：输入邀请码 ============ */}
      <TabsContent value="enter">
        <div className="rounded-3xl border border-rose-100 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#3a241a]/85">
          <div className="text-center">
            <h3 className="font-semibold text-stone-800 dark:text-rose-50">输入 TA 给你的邀请码</h3>
            <p className="mt-2 text-sm text-stone-400 dark:text-rose-200/50">6 位数字，输入后即可完成情侣绑定</p>
          </div>

          {/* 六格数字输入框（自动弹出数字键盘） */}
          <div className="mt-6 flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={acting}
              aria-label="请输入 6 位数字邀请码"
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-14 w-11 rounded-xl border-rose-200 bg-rose-50/50 text-xl font-bold text-rose-500 first:rounded-xl last:rounded-xl data-[active=true]:border-rose-400 dark:border-white/15 dark:bg-white/5 dark:text-rose-300 dark:data-[active=true]:border-rose-300"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            disabled={acting || code.length !== 6}
            onClick={handleRedeem}
            className="mt-6 h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
          >
            {acting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <HeartHandshake className="mr-1 h-4 w-4" />}
            完成绑定
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  )
}

/**
 * 邀请码展示卡片：大号邀请码 + 有效期倒计时 + 复制/重新生成/取消
 */
function InviteCodeDisplay({
  relation,
  acting,
  onCopy,
  onRegenerate,
  onCancel,
}: {
  relation: CoupleRelation
  acting: boolean
  onCopy: () => void
  onRegenerate: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#3a241a]/85">
      <p className="text-sm text-stone-400 dark:text-rose-200/50">你的专属邀请码</p>

      {/* 大号邀请码展示 */}
      <p
        className="mt-4 select-all text-4xl font-bold tracking-[0.3em] text-rose-500 dark:text-rose-300"
        aria-label={`邀请码 ${relation.invite_code}`}
      >
        {relation.invite_code}
      </p>

      {/* 有效期倒计时（每秒刷新） */}
      <p className="mt-3 text-xs text-stone-400 dark:text-rose-200/50">
        24 小时内有效 · 剩余 <InviteCountdown expiresAt={relation.expires_at} />
      </p>
      <p className="mt-2 text-xs leading-relaxed text-stone-400 dark:text-rose-200/50">
        把邀请码告诉你的另一半，
        <br />
        TA 登录后在「输入邀请码」中填入即可完成绑定
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          disabled={acting}
          onClick={onCopy}
          className="h-11 rounded-full border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:border-white/15 dark:text-rose-300 dark:hover:bg-white/10 dark:hover:text-rose-200"
        >
          <Copy className="mr-1 h-4 w-4" />
          复制邀请码
        </Button>
        <Button
          variant="outline"
          disabled={acting}
          onClick={onRegenerate}
          className="h-11 rounded-full border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:border-white/15 dark:text-rose-300 dark:hover:bg-white/10 dark:hover:text-rose-200"
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          重新生成
        </Button>
      </div>

      <Button
        variant="ghost"
        disabled={acting}
        onClick={onCancel}
        className="mt-2 h-10 w-full rounded-full text-sm text-stone-400 hover:bg-stone-50 hover:text-stone-500 dark:text-rose-200/50 dark:hover:bg-white/10 dark:hover:text-rose-200"
      >
        取消邀请
      </Button>
    </div>
  )
}

/** 邀请码剩余有效时间倒计时（每秒刷新一次；过期显示红色提示） */
function InviteCountdown({ expiresAt }: { expiresAt: string }) {
  // forceTick 每秒自增强制重渲染，剩余时间在渲染时实时计算
  const [, forceTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const remain = new Date(expiresAt).getTime() - Date.now()

  if (remain <= 0) {
    return <span className="font-medium text-red-400">已过期，请重新生成</span>
  }
  const totalSeconds = Math.floor(remain / 1000)
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return (
    <span className="font-mono font-medium text-rose-400">
      {h}:{m}:{s}
    </span>
  )
}
