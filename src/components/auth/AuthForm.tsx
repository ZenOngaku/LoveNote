'use client'

/**
 * ============================================================
 * AuthForm —— 登录 / 注册共用表单（完整页面内容）
 * ============================================================
 * mode = 'login'    登录页：邮箱 + 密码
 * mode = 'register' 注册页：邮箱 + 密码 + 确认密码
 *
 * 说明：
 * - 注册使用 Supabase Auth；若 Supabase 控制台开启了「邮箱验证」，
 *   注册成功后会展示「请查收验证邮件」提示页
 * - 登录态持久化由 Supabase Auth 自动完成（localStorage）
 */
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Lock, Mail } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { ConfigNotice } from '@/components/layout/ConfigNotice'

interface AuthFormProps {
  mode: 'login' | 'register'
}

export function AuthForm({ mode }: AuthFormProps) {
  const isLogin = mode === 'login'
  const { signIn, signUp } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [needsVerify, setNeedsVerify] = useState(false) // 注册后等待邮箱验证

  /** 简单前端校验 + 提交 */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const mail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      toast.error('请输入正确的邮箱地址')
      return
    }
    if (password.length < 6) {
      toast.error('密码至少需要 6 位字符')
      return
    }
    if (!isLogin && password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }

    setSubmitting(true)
    try {
      if (isLogin) {
        const { error } = await signIn(mail, password)
        if (error) {
          toast.error(error)
          return
        }
        toast.success('欢迎回来 💗')
        router.replace('/')
      } else {
        const { error, needsVerify: verify } = await signUp(mail, password)
        if (error) {
          toast.error(error)
          return
        }
        if (verify) {
          // Supabase 开启了邮箱验证：提示用户去邮箱确认
          setNeedsVerify(true)
        } else {
          toast.success('注册成功，开始记录你们的故事吧 💗')
          router.replace('/')
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 注册后等待邮箱验证的提示页
  if (needsVerify) {
    return (
      <AuthShell>
        <div className="mt-6 w-full max-w-sm rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
            <Mail className="h-8 w-8 text-rose-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-stone-800">验证邮件已发送</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            请前往 <span className="font-medium text-rose-500">{email}</span> 的收件箱，
            点击确认链接完成验证后再登录。
          </p>
          <Button
            className="mt-6 h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
            onClick={() => router.replace('/login')}
          >
            去登录
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <ConfigNotice />

      {/* 表单卡片 */}
      <form
        onSubmit={handleSubmit}
        className="mt-5 w-full max-w-sm space-y-4 rounded-3xl border border-rose-100 bg-white p-6 shadow-sm"
      >
        <h2 className="text-base font-semibold text-stone-800">
          {isLogin ? '登录' : '创建账号'}
        </h2>

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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-stone-600">
              密码
            </Label>
            {/* 登录模式提供忘记密码入口 */}
            {isLogin && (
              <Link
                href="/forgot-password"
                className="text-xs text-rose-400 hover:text-rose-500 hover:underline"
              >
                忘记密码？
              </Link>
            )}
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
            <Input
              id="password"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="至少 6 位字符"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border-rose-100 pl-10 text-base"
              required
            />
          </div>
        </div>

        {/* 注册时额外确认一次密码 */}
        {!isLogin && (
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-stone-600">
              确认密码
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="再输入一次密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 rounded-xl border-rose-100 pl-10 text-base"
                required
              />
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
        >
          {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {isLogin ? '登录' : '注册'}
        </Button>
      </form>

      {/* 切换登录 / 注册 */}
      <p className="mt-6 text-sm text-stone-500">
        {isLogin ? (
          <>
            还没有账号？
            <Link href="/register" className="ml-1 font-medium text-rose-500 hover:underline">
              去注册
            </Link>
          </>
        ) : (
          <>
            已有账号？
            <Link href="/login" className="ml-1 font-medium text-rose-500 hover:underline">
              去登录
            </Link>
          </>
        )}
      </p>
    </AuthShell>
  )
}
