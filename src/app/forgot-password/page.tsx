'use client'

/**
 * ============================================================
 * 忘记密码页 /forgot-password
 * ============================================================
 * 流程：
 * 1. 用户输入注册邮箱 → 点击「发送重置邮件」
 * 2. Supabase 向该邮箱发送含一次性链接的邮件（默认 1 小时有效）
 * 3. 用户在邮箱中点击链接 → 跳转 /reset-password 设置新密码
 *
 * 说明：
 * - 出于安全考虑，无论邮箱是否已注册，Supabase 都不会明确告知
 *   「该邮箱不存在」，避免被用来探测注册用户
 * - 页面公开可访问（不需要登录）
 */
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Mail, MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { ConfigNotice } from '@/components/layout/ConfigNotice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false) // 是否已发送成功（切换到提示视图）

  /** 提交：发送重置邮件 */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const mail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast.error('请输入正确的邮箱地址')
      return
    }

    setSending(true)
    const { error } = await resetPassword(mail)
    setSending(false)
    if (error) {
      toast.error(error)
      return
    }
    setSent(true) // 切换到「邮件已发送」提示视图
  }

  // 已发送成功：提示去邮箱查收
  if (sent) {
    return (
      <AuthShell>
        <div className="mt-6 w-full max-w-sm rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
            <MailCheck className="h-8 w-8 text-rose-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-stone-800">重置邮件已发送</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            请前往 <span className="font-medium text-rose-500">{email.trim()}</span>{' '}
            的收件箱（注意垃圾邮件箱），点击邮件中的链接设置新密码，链接 1 小时内有效。
          </p>
          <Button
            className="mt-6 h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
            onClick={() => router.replace('/login')}
          >
            返回登录
          </Button>
          {/* 没收到？切回表单允许重新发送 */}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-3 text-sm text-stone-400 hover:text-rose-500 hover:underline"
          >
            没有收到？重新发送
          </button>
        </div>
      </AuthShell>
    )
  }

  // 默认：输入邮箱表单
  return (
    <AuthShell>
      <ConfigNotice />

      <form
        onSubmit={handleSubmit}
        className="mt-5 w-full max-w-sm space-y-4 rounded-3xl border border-rose-100 bg-white p-6 shadow-sm"
      >
        <h2 className="text-base font-semibold text-stone-800">找回密码</h2>
        <p className="text-sm leading-relaxed text-stone-500">
          输入注册时使用的邮箱，我们会发送一封包含重置链接的邮件。
        </p>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-stone-600">
            邮箱
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              // 16px 字号避免 iOS 聚焦时页面自动缩放
              className="h-12 rounded-xl border-rose-100 pl-10 text-base"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={sending}
          className="h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
        >
          {sending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          发送重置邮件
        </Button>
      </form>

      <p className="mt-6 text-sm text-stone-500">
        想起来了？
        <Link href="/login" className="ml-1 font-medium text-rose-500 hover:underline">
          去登录
        </Link>
      </p>
    </AuthShell>
  )
}
