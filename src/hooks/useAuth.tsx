'use client'

/**
 * ============================================================
 * useAuth —— 全局鉴权 Hook（基于 Supabase Auth）
 * ============================================================
 * 功能：
 * 1. 通过 AuthProvider 在根布局注入全局登录状态（Context）
 * 2. 会话持久化：刷新页面后自动从 localStorage 恢复登录态
 * 3. 监听 onAuthStateChange：登录/退出/Token 刷新时自动同步状态与资料
 * 4. 维护 users 扩展表中的用户资料（昵称等）
 *
 * 使用方式：const { user, profile, loading } = useAuth()
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/helpers'
import type { OpResult, Profile } from '@/lib/types'

interface AuthContextValue {
  /** 当前登录用户（Supabase auth.users），未登录为 null */
  user: User | null
  /** users 扩展表中的资料（昵称等） */
  profile: Profile | null
  /** 是否正在进行初始会话检查（用于路由守卫，避免误跳登录页） */
  loading: boolean
  /** 邮箱密码登录 */
  signIn: (email: string, password: string) => Promise<OpResult>
  /** 邮箱密码注册（若 Supabase 开启邮箱验证，返回 needsVerify = true） */
  signUp: (email: string, password: string) => Promise<OpResult & { needsVerify: boolean }>
  /** 退出登录 */
  signOut: () => Promise<void>
  /** 修改昵称（写入 users 扩展表） */
  updateNickname: (nickname: string) => Promise<OpResult>
  /** 发送密码重置邮件 */
  resetPassword: (email: string) => Promise<OpResult>
  /** 设置新密码（重置邮件链接落地后使用） */
  updatePassword: (newPassword: string) => Promise<OpResult>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // 初始化：恢复持久化会话 + 订阅 Supabase 认证事件（外部系统）
  // 所有 setState 都发生在事件回调 / await 之后，避免渲染级联
  useEffect(() => {
    const supabase = getSupabase()
    let mounted = true

    /** 拉取用户扩展资料（users 表）；若不存在则自动补建（兼容先注册后建表） */
    const syncProfile = async (uid: string | null) => {
      if (!uid) {
        setProfile(null)
        return
      }
      const { data } = await supabase.from('users').select('*').eq('id', uid).maybeSingle()
      if (!mounted) return
      if (data) {
        setProfile(data as Profile)
        return
      }
      // 兜底：正常由数据库触发器建档，这里防止触发器未生效导致资料缺失
      const { data: authData } = await supabase.auth.getUser()
      const fallbackNick = authData?.user?.email?.split('@')[0] ?? '我'
      const { data: inserted } = await supabase
        .from('users')
        .insert({ id: uid, nickname: fallbackNick })
        .select()
        .maybeSingle()
      if (!mounted) return
      setProfile((inserted as Profile | null) ?? null)
    }

    // 1) 启动时从本地恢复会话
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setLoading(false)
      void syncProfile(data.session?.user?.id ?? null)
    })

    // 2) 监听后续认证事件（登录成功 / 退出 / token 刷新等）
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      void syncProfile(session?.user?.id ?? null)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  /** 邮箱密码登录 */
  const signIn = useCallback(async (email: string, password: string): Promise<OpResult> => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    return { error: error ? getErrorMessage(error) : null }
  }, [])

  /** 邮箱密码注册 */
  const signUp = useCallback(
    async (email: string, password: string): Promise<OpResult & { needsVerify: boolean }> => {
      const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: {
          // 邮箱验证链接的回跳地址（Supabase 开启邮箱验证时会用到）
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      if (error) return { error: getErrorMessage(error), needsVerify: false }
      // data.session 为空说明 Supabase 开启了「邮箱验证」，需要用户先去邮箱确认
      return { error: null, needsVerify: !data.session && !!data.user }
    },
    [],
  )

  /** 退出登录 */
  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut()
  }, [])

  /**
   * 发送密码重置邮件（含一次性链接，默认 1 小时有效）。
   * 用户在邮箱中点击链接后会跳转到 /reset-password 设置新密码。
   */
  const resetPassword = useCallback(async (email: string): Promise<OpResult> => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      // 重置邮件里「设置新密码」按钮的回跳地址
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error ? getErrorMessage(error) : null }
  }, [])

  /**
   * 设置新密码（需已登录会话）。
   * 用于 /reset-password 页：用户点击邮件链接后 Supabase 会自动建立临时会话。
   */
  const updatePassword = useCallback(async (newPassword: string): Promise<OpResult> => {
    const { error } = await getSupabase().auth.updateUser({ password: newPassword })
    return { error: error ? getErrorMessage(error) : null }
  }, [])

  /** 修改昵称 */
  const updateNickname = useCallback(
    async (nickname: string): Promise<OpResult> => {
      if (!user) return { error: '请先登录' }
      const supabase = getSupabase()
      const { error } = await supabase.from('users').update({ nickname }).eq('id', user.id)
      if (error) return { error: getErrorMessage(error) }
      // 更新成功后重新拉取资料（await 之后才 setState）
      const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
      if (data) setProfile(data as Profile)
      return { error: null }
    },
    [user],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateNickname,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/** 获取全局鉴权状态的 Hook（必须在 <AuthProvider> 内使用） */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth 必须在 <AuthProvider> 内使用')
  }
  return ctx
}
