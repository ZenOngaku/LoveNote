'use client'

/**
 * ============================================================
 * AuthShell —— 认证相关页面的统一外壳
 * ============================================================
 * 提供手绘土豆 / 爆米花壁纸背景 + Logo + 标语的统一视觉框架，
 * 登录 / 注册 / 忘记密码 / 重置密码四个页面共用，保证观感一致。
 *
 * 壁纸支持浅色 / 深色两版手动切换（右上角按钮，选择持久化到
 * localStorage，详见 WallpaperTheme.tsx）：
 * - 浅色：public/bg-light.webp，米色底 + 棕色线条，底色 #fdfbee
 * - 深色：public/bg-dark.webp，深可可底 + 奶油色线条，底色 #2b1a13
 * 两版均为单图 bg-cover bg-center 呈现 —— 无平铺拼接、零接缝，
 * 底色与壁纸底色一致，图片加载前后页面始终同色调。
 */
import type { ReactNode } from 'react'
import { Heart } from 'lucide-react'
import { WallpaperToggle, useWallpaperTheme } from './WallpaperTheme'

export function AuthShell({ children }: { children: ReactNode }) {
  const { theme } = useWallpaperTheme()
  const dark = theme === 'dark'
  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center bg-cover bg-center px-6 py-10 transition-colors duration-300 ${
        dark ? 'bg-[#2b1a13] bg-[url("/bg-dark.webp")]' : 'bg-[#fdfbee] bg-[url("/bg-light.webp")]'
      }`}
    >
      {/* 深浅壁纸切换（持久化，四个认证页共用） */}
      <WallpaperToggle />

      {/* Logo 与标语 */}
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full shadow-sm ring-1 ${
          dark ? 'bg-white/10 ring-white/15' : 'bg-white/80 ring-rose-100'
        }`}
      >
        <Heart className="h-8 w-8 fill-rose-300 text-rose-400" />
      </div>
      <h1 className={`mt-4 text-2xl font-bold tracking-wide ${dark ? 'text-rose-50' : 'text-rose-900'}`}>
        LoveNote
      </h1>
      <p className={`mt-1 text-sm ${dark ? 'text-rose-200/80' : 'text-rose-400'}`}>
        属于两个人的小小记事本
      </p>
      {children}
    </div>
  )
}
