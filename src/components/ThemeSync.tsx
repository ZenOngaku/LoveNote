'use client'

/**
 * ThemeSync —— 把壁纸主题同步为全局 .dark 模式
 * ============================================================
 * 认证页的深浅切换（localStorage: lovenote-wallpaper-theme）通过本组件
 * 升级为整站主题：给 <html> 切换 .dark class（globals.css 的 .dark token
 * 与各组件 dark: 变体随之生效），并同步更新 <meta name="theme-color">。
 *
 * - 挂载在根布局 <body> 内（登录页与认证页都会生效）
 * - useWallpaperTheme 内部订阅了 storage 事件 → 多标签页自动同步
 * - 首帧防闪烁由 layout 中的内联脚本完成（HTML 解析前预设 class），
 *   本组件只负责挂载后与后续切换的一致性
 */
import { useEffect } from 'react'
import { useWallpaperTheme } from '@/components/auth/WallpaperTheme'

export function ThemeSync() {
  const { theme } = useWallpaperTheme()
  const dark = theme === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#2b1a13' : '#FFF7F8')
  }, [dark])

  return null
}
