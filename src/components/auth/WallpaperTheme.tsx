'use client'

/**
 * ============================================================
 * WallpaperTheme —— 认证页壁纸深浅色主题（手动切换 + 持久化）
 * ============================================================
 * 在登录 / 注册 / 忘记密码 / 重置密码四个认证页右上角提供
 * 「浅色壁纸 / 深色壁纸」手动切换按钮：
 * - 选择保存在 localStorage（key: lovenote-wallpaper-theme），
 *   刷新 / 重开浏览器后保持，多标签页间也会同步
 * - 通过 useSyncExternalStore 订阅 localStorage：SSR 与水合期间
 *   返回浅色（与服务端 HTML 一致），挂载后自动纠正为已存值，
 *   无水合错配、也不违反 react-hooks/set-state-in-effect 规则
 * - 同时导出一组「认证页配色构建器」，卡片 / 输入框 / 文字的
 *   深浅色样式集中在这里维护，各页面按 dark 布尔值取用
 */
import { useCallback, useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

export type WallpaperTheme = 'light' | 'dark'

const STORAGE_KEY = 'lovenote-wallpaper-theme'

/** localStorage 订阅管理（同页组件 + 跨标签页 storage 事件） */
const listeners = new Set<() => void>()
function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener('storage', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', callback)
  }
}

/** 客户端快照：读本地存储 */
function getClientSnapshot(): WallpaperTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** 服务端 / 水合快照：固定浅色，保证与服务端 HTML 一致 */
function getServerSnapshot(): WallpaperTheme {
  return 'light'
}

/** 读取本地存储中的壁纸主题（供非 Hook 场景使用，如调试） */
export function getStoredWallpaperTheme(): WallpaperTheme {
  return getClientSnapshot()
}

/**
 * 认证页壁纸主题 Hook。
 *任意组件直接调用即可获得当前主题并响应切换（无需 Provider）。
 */
export function useWallpaperTheme() {
  const theme = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
  const setTheme = useCallback((next: WallpaperTheme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 隐私模式等场景下写入失败不影响本次切换
    }
    listeners.forEach((notify) => notify())
  }, [])
  const toggle = useCallback(() => {
    setTheme(getClientSnapshot() === 'light' ? 'dark' : 'light')
  }, [setTheme])
  return { theme, toggle, setTheme }
}

/** 右上角深浅壁纸切换按钮（绝对定位于 AuthShell 根容器） */
export function WallpaperToggle() {
  const { theme, toggle } = useWallpaperTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? '切换到浅色壁纸' : '切换到深色壁纸'}
      aria-pressed={dark}
      title={dark ? '切换到浅色壁纸' : '切换到深色壁纸'}
      className={`absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-1 backdrop-blur-sm transition-colors ${
        dark
          ? 'bg-white/10 text-rose-200 ring-white/15 hover:bg-white/20'
          : 'bg-white/70 text-rose-500 ring-rose-200/70 hover:bg-white'
      }`}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

/* ============================================================
 * 认证页配色构建器 —— 深浅两版的卡片 / 输入框 / 文字颜色
 * ============================================================ */

/** 表单/提示卡片 */
export function authCardClass(dark: boolean) {
  return dark ? 'border-white/10 bg-[#3a241a]/85' : 'border-rose-100/80 bg-white/85'
}

/** 卡片内标题 */
export function authHeadingClass(dark: boolean) {
  return dark ? 'text-rose-50' : 'text-rose-900'
}

/** Label 文字 */
export function authLabelClass(dark: boolean) {
  return dark ? 'text-rose-100/80' : 'text-rose-900/70'
}

/** 次要说明文字 */
export function authMutedClass(dark: boolean) {
  return dark ? 'text-rose-100/60' : 'text-rose-900/60'
}

/** 强调链接（去注册 / 去登录等） */
export function authLinkStrongClass(dark: boolean) {
  return dark ? 'text-rose-300 hover:text-rose-200' : 'text-rose-500 hover:text-rose-600'
}

/** 弱化链接（忘记密码 / 重新发送等） */
export function authLinkSoftClass(dark: boolean) {
  return dark ? 'text-rose-300/70 hover:text-rose-200' : 'text-rose-400 hover:text-rose-500'
}

/** 输入框（含占位符与聚焦态） */
export function authInputClass(dark: boolean) {
  return dark
    ? 'border-white/15 bg-white/10 text-rose-50 placeholder:text-rose-200/50 focus-visible:border-rose-200/40 focus-visible:ring-white/10'
    : 'border-rose-200/70 bg-white/70 text-rose-900 placeholder:text-rose-400 focus-visible:border-rose-300 focus-visible:ring-rose-200/70'
}

/** 输入框内左侧图标 */
export function authInputIconClass(dark: boolean) {
  return dark ? 'text-rose-300/70' : 'text-rose-300'
}

/** 圆形图标底（提示视图的大图标） */
export function authIconBadgeClass(dark: boolean) {
  return dark ? 'bg-white/10' : 'bg-rose-100'
}
