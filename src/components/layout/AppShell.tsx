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

interface AppShellProps {
  /** 顶部标题栏文字 */
  title?: string
  children: ReactNode
}

export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-[#FFF7F8] to-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        {/* 顶部标题栏 */}
        <header className="sticky top-0 z-20 border-b border-rose-100/80 bg-white/70 backdrop-blur-md">
          <div className="flex h-14 items-center px-5">
            <h1 className="text-base font-semibold text-stone-800">{title}</h1>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      </div>

      {/* 底部导航 */}
      <BottomNav />
    </div>
  )
}
