/**
 * ============================================================
 * Supabase 浏览器端客户端初始化
 * ============================================================
 * 说明：
 * - 本项目为「纯客户端 + Supabase BaaS」架构，所有业务逻辑在前端完成，
 *   数据安全完全依赖 Supabase 的 RLS（行级安全策略），详见 supabase/schema.sql
 * - 环境变量从项目根目录的 .env.local 读取（参考 .env.local.example）
 * - 使用单例模式，整个应用共用同一个客户端实例（会话自动持久化到 localStorage）
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// 从环境变量读取 Supabase 项目配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/**
 * 是否已正确配置 Supabase 环境变量。
 * 未配置时页面会展示友好提示（见 ConfigNotice 组件），应用本身不会崩溃。
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// 客户端单例
let instance: SupabaseClient | null = null

/**
 * 获取 Supabase 浏览器端客户端（单例）
 *
 * 未配置环境变量时使用占位地址创建客户端，保证应用可以正常渲染，
 * 此时所有请求会失败并触发统一的中文错误提示。
 */
export function getSupabase(): SupabaseClient {
  if (!instance) {
    instance = createClient(
      // 未配置时使用占位 URL，避免 createClient 抛错导致白屏
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-anon-key',
      {
        auth: {
          // 会话持久化：登录状态保存在 localStorage，刷新/重开浏览器后依然保持登录
          persistSession: true,
          // 自动刷新 access token，长期使用不掉线
          autoRefreshToken: true,
        },
      },
    )
  }
  return instance
}
