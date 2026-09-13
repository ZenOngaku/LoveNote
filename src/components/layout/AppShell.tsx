'use client'

/**
 * ============================================================
 * AppShell —— 登录后页面的统一外壳
 * ============================================================
 * 结构：手机宽度居中容器 + 顶部标题栏 + 内容区 + 底部导航
 * - 移动端优先：max-w-md 居中，桌面端呈现手机竖屏比例，体验一致
 * - 顶部标题栏 sticky 吸顶 + 毛玻璃效果
 * - 内容区预留 pb-28，避免被底部导航遮挡
 */
import type { ReactNode } from 'react'
import { BottomNav } from '@/components/layout/BottomNav'
import { useWallpaperTheme } from '@/components/auth/WallpaperTheme'

interface AppShellProps {
  /** 顶部标题栏文字 */
  title?: string
  /**
   * 满屏布局：内容区去掉内边距，交给页面自己撑满（足迹地图页用）。
   * 底部仍预留 BottomNav 的高度 + iOS 安全区，避免内容被导航栏遮住。
   */
  bleed?: boolean
  children: ReactNode
}

export function AppShell({ title, bleed = false, children }: AppShellProps) {
  const { theme } = useWallpaperTheme()
  const dark = theme === 'dark'
  return (
    /* 主页面铺认证同款壁纸（深浅随全局主题切换）；
       壁纸底色兜底避免图片加载前闪色差 */
    <div
      className={`relative min-h-screen bg-cover bg-center ${dark ? 'bg-[#2b1a13]' : 'bg-[#fdfbee]'}`}
      style={{ backgroundImage: `url(${dark ? '/bg-dark.webp' : '/bg-light.webp'})` }}
    >
      {/* 主题色遮罩：文字直接落在壁纸上，加半透明底色 + 轻模糊保证可读 */}
      <div
        aria-hidden
        className={`absolute inset-0 backdrop-blur-[2px] ${dark ? 'bg-[#2b1a13]/65' : 'bg-[#FFF7F8]/70'}`}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col">
        {/* 顶部标题栏（标题水平居中） */}
        <header className="sticky top-0 z-20 border-b border-rose-100/80 bg-white/70 backdrop-blur-md dark:border-white/10 dark:bg-[#2b1a13]/70">
          <div className="flex h-14 items-center justify-center px-5">
            <h1 className="text-base font-semibold text-stone-800 dark:text-rose-50">{title}</h1>
          </div>
        </header>

        {/* 页面内容（bleed = 满屏模式：地图页用 flex 撑满，底部仍避开导航栏）
            注意：bleed 模式内不要用 h-full —— flex 项没有「确定高度」，
            百分比高度会退化成 SVG 的默认 150px 高，地图只剩一条。 */}
        <main
          className={
            bleed
              ? 'relative flex flex-1 flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))]'
              : 'flex-1 px-4 pb-28 pt-4'
          }
        >
          {children}
        </main>
      </div>

      {/* 底部导航 */}
      <BottomNav />
    </div>
  )
}
