'use client'

/**
 * ============================================================
 * 登录页 /login
 * ============================================================
 * - 邮箱密码登录（Supabase Auth）
 * - 已登录用户访问时由 PublicOnly 自动跳回首页
 */
import { AuthForm } from '@/components/auth/AuthForm'
import { PublicOnly } from '@/components/auth/AuthGuard'

export default function LoginPage() {
  return (
    <PublicOnly>
      <AuthForm mode="login" />
    </PublicOnly>
  )
}
