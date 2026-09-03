'use client'

/**
 * ============================================================
 * 注册页 /register
 * ============================================================
 * - 邮箱密码注册（Supabase Auth）
 * - 若 Supabase 开启了「邮箱验证」，注册后提示前往邮箱确认
 * - 已登录用户访问时由 PublicOnly 自动跳回首页
 */
import { AuthForm } from '@/components/auth/AuthForm'
import { PublicOnly } from '@/components/auth/AuthGuard'

export default function RegisterPage() {
  return (
    <PublicOnly>
      <AuthForm mode="register" />
    </PublicOnly>
  )
}
