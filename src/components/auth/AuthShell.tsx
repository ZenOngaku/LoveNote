'use client'

/**
 * ============================================================
 * AuthShell —— 认证相关页面的统一外壳
 * ============================================================
 * 提供手绘土豆花纹背景 + Logo + 标语的统一视觉框架，
 * 登录 / 注册 / 忘记密码 / 重置密码四个页面共用，保证观感一致。
 *
 * 背景：public/bg-light.webp 为裁好水印、清理过边缘图案的完整壁纸，
 * 以 bg-cover bg-center 整图铺满任意屏幕 —— 单图呈现，无平铺拼接、
 * 一屏内图案零重复；底色 #fdfbee 与壁纸底色一致，
 * 图片加载前或极端宽高比下页面依然保持同色调。
 */
import type { ReactNode } from 'react'
import { Heart } from 'lucide-react'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fdfbee] bg-[url('/bg-light.webp')] bg-cover bg-center px-6 py-10">
      {/* Logo 与标语 */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-rose-100">
        <Heart className="h-8 w-8 fill-rose-300 text-rose-400" />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-wide text-rose-900">LoveNote</h1>
      <p className="mt-1 text-sm text-rose-400">属于两个人的小小记事本</p>
      {children}
    </div>
  )
}
