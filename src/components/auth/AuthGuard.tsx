'use client'

/**
 * ============================================================
 * 路由守卫组件
 * ============================================================
 * AuthGuard  ：未登录禁止访问，自动跳转到登录页（用于首页/笔记页/设置页）
 * PublicOnly ：已登录用户访问登录/注册页时，自动跳回首页
 * SplashScreen：会话检查期间的粉色加载过渡页
 */
import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/** 粉色加载过渡页（会话检查中 / 跳转中） */
export function SplashScreen() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#FFF7F8]"
      aria-label="加载中"
    >
      <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-rose-100">
        <Heart className="h-8 w-8 fill-rose-300 text-rose-400" />
      </div>
      <p className="mt-4 text-sm font-medium tracking-widest text-rose-400">CoupleNote</p>
    </div>
  )
}

/** 鉴权守卫：未登录自动跳转 /login，登录前不渲染任何受保护内容 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // 初始会话检查完成后仍未登录 → 跳转登录页
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  if (loading || !user) {
    return <SplashScreen />
  }
  return <>{children}</>
}

/** 公开页守卫：已登录用户访问登录/注册页时自动跳回首页 */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/')
    }
  }, [loading, user, router])

  if (loading || user) {
    return <SplashScreen />
  }
  return <>{children}</>
}
