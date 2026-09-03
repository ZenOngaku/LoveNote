'use client'

/**
 * ============================================================
 * BottomNav —— 底部导航栏（移动端 App 风格）
 * ============================================================
 * 三个入口：首页（配对）/ 笔记 / 我的（设置）
 * - 当前路由高亮显示
 * - 预留 iOS 安全区域（pb-[env(safe-area-inset-bottom)]），适配刘海屏/微信 webview
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Heart, NotebookPen, UserRound } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: '首页', icon: Heart },
  { href: '/notes', label: '笔记', icon: NotebookPen },
  { href: '/settings', label: '我的', icon: UserRound },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="底部导航"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rose-100 bg-white/90 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-20 flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                active ? 'text-rose-500' : 'text-stone-400 hover:text-rose-400'
              }`}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2.4 : 2}
                fill={active && href === '/' ? 'currentColor' : 'none'}
              />
              <span className={active ? 'font-medium' : ''}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
