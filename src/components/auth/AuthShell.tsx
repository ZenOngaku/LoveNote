'use client'

/**
 * ============================================================
 * AuthShell —— 认证相关页面的统一外壳
 * ============================================================
 * 提供手绘土豆花纹背景 + Logo + 标语的统一视觉框架，
 * 登录 / 注册 / 忘记密码 / 重置密码四个页面共用，保证观感一致。
 *
 * 背景：public/pattern.webp 为可平铺的手绘土豆图案（米黄底），
 * 通过 background-repeat 自动向四周扩展铺满任意屏幕尺寸，
 * 底色 #fdfdf1 与图案底色一致，保证边缘衔接自然。
 */
import type { ReactNode } from 'react'
import { Heart } from 'lucide-react'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fdfdf1] bg-[url('/pattern.webp')] bg-[length:780px_auto] bg-repeat px-6 py-10">
      {/* Logo 与标语 */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 shadow-sm">
        <Heart className="h-8 w-8 fill-rose-300 text-rose-400" />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-wide text-stone-800">CoupleNote</h1>
      <p className="mt-1 text-sm text-stone-400">属于两个人的小小记事本</p>
      {children}
    </div>
  )
}
