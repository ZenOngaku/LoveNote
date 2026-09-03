'use client'

/**
 * ============================================================
 * 重置密码页 /reset-password
 * ============================================================
 * 用户点击重置邮件中的链接后落地到这里：
 * - 邮件链接会在 URL hash 中携带一次性凭证，Supabase 客户端
 *   初始化时自动校验并建立临时会话（本页无需手动解析凭证）
 * - 会话就绪 → 展示「设置新密码」表单
 * - 无会话（链接无效 / 已过期 / 已被使用）→ 展示失效提示
 * - 成功后：退出临时会话 → 跳转登录页用新密码重新登录
 *
 * 注意：本页不使用 PublicOnly 守卫 —— 刚通过邮件链接建立会话的
 * 用户需要停留在此页完成改密，而不是被重定向走。
 */
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound, Loader2, MailX } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { SplashScreen } from '@/components/auth/AuthGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'

export default function ResetPasswordPage() {
  const { user, loading, updatePassword, signOut } = useAuth()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /** 提交：设置新密码 */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('密码至少需要 6 位字符')
      return
    }
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }

    setSubmitting(true)
    const { error } = await updatePassword(password)
    setSubmitting(false)
    if (error) {
      toast.error(error)
      return
    }

    toast.success('密码已重置，请用新密码登录 💗')
    // 退出重置邮件建立的临时会话，回登录页重新登录
    await signOut()
    router.replace('/login')
  }

  // 1) 初始会话检查中（含邮件凭证的自动校验过程）
  if (loading) return <SplashScreen />

  // 2) 无有效会话：链接无效 / 已过期 / 已被使用
  if (!user) {
    return (
      <AuthShell>
        <div className="mt-6 w-full max-w-sm rounded-3xl border border-rose-100/80 bg-white/85 p-8 text-center shadow-sm backdrop-blur-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
            <MailX className="h-8 w-8 text-rose-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-rose-900">链接无效或已过期</h2>
          <p className="mt-2 text-sm leading-relaxed text-rose-900/60">
            重置链接只能使用一次，且有效期 1 小时。
            <br />
            请重新发送一封重置邮件试试。
          </p>
          <Button
            className="mt-6 h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
            onClick={() => router.replace('/forgot-password')}
          >
            重新发送重置邮件
          </Button>
          <Link
            href="/login"
            className="mt-3 block text-sm text-rose-400 hover:text-rose-500 hover:underline"
          >
            返回登录
          </Link>
        </div>
      </AuthShell>
    )
  }

  // 3) 会话就绪：设置新密码表单
  return (
    <AuthShell>
      <form
        onSubmit={handleSubmit}
        className="mt-5 w-full max-w-sm space-y-4 rounded-3xl border border-rose-100/80 bg-white/85 p-6 shadow-sm backdrop-blur-sm"
      >
        <h2 className="text-base font-semibold text-rose-900">设置新密码</h2>
        <p className="text-sm leading-relaxed text-rose-900/60">
          邮箱验证通过，请为账号 {user.email ?? ''} 设置新密码。
        </p>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-rose-900/70">
            新密码
          </Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="至少 6 位字符"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border-rose-200/70 bg-white/70 pl-10 text-base text-rose-900 placeholder:text-rose-400 focus-visible:border-rose-300 focus-visible:ring-rose-200/70"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-rose-900/70">
            确认新密码
          </Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="再输入一次新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 rounded-xl border-rose-200/70 bg-white/70 pl-10 text-base text-rose-900 placeholder:text-rose-400 focus-visible:border-rose-300 focus-visible:ring-rose-200/70"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
        >
          {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          确认重置
        </Button>
      </form>

      <p className="mt-6 text-sm text-rose-900/60">
        放弃重置？
        <Link href="/login" className="ml-1 font-medium text-rose-500 hover:underline">
          返回登录
        </Link>
      </p>
    </AuthShell>
  )
}
