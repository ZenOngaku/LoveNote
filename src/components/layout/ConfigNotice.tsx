'use client'

/**
 * ============================================================
 * ConfigNotice —— Supabase 未配置的友好提示条
 * ============================================================
 * 检测 .env.local 是否配置了 Supabase 环境变量，
 * 未配置时展示引导提示（应用不会崩溃，接口调用会给出中文错误提示）。
 */
import { isSupabaseConfigured } from '@/lib/supabase/client'

export function ConfigNotice() {
  // 已正确配置则不渲染任何内容
  if (isSupabaseConfigured) return null

  return (
    <div
      role="alert"
      className="mb-4 w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-700"
    >
      <p className="font-medium">⚠️ 尚未配置 Supabase</p>
      <p className="mt-1">
        请复制项目根目录的 <code className="rounded bg-amber-100 px-1">.env.local.example</code> 为{' '}
        <code className="rounded bg-amber-100 px-1">.env.local</code>，填入你的 Supabase 项目地址与
        Anon Key，然后重启开发服务器。详细步骤见 README.md。
      </p>
    </div>
  )
}
