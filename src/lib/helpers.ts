/**
 * ============================================================
 * 通用工具函数：时间格式化 / 错误翻译 / 剪贴板 / 邀请码校验
 * ============================================================
 */

/**
 * 将时间格式化为友好的相对时间显示：
 * 刚刚 / n 分钟前 / n 小时前 / 昨天 HH:mm / MM-DD HH:mm / YYYY-MM-DD
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 无效时间直接返回空串
  if (Number.isNaN(date.getTime())) return ''

  const pad = (n: number) => String(n).padStart(2, '0')
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`

  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`

  // 判断是否为昨天
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return `昨天 ${hm}`
  }

  // 今年内显示 MM-DD HH:mm，跨年显示完整日期
  if (date.getFullYear() === now.getFullYear()) {
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hm}`
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 将 Supabase / 网络层的英文报错统一翻译为面向用户的中文提示。
 * 覆盖登录、注册、RLS 权限、网络异常等常见场景。
 */
export function getErrorMessage(err: unknown): string {
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : err instanceof Error
        ? err.message
        : String(err ?? '')

  const rules: Array<[RegExp, string]> = [
    [/invalid login credentials/i, '邮箱或密码不正确，请重新输入'],
    [/email not confirmed/i, '邮箱尚未验证，请先前往邮箱点击确认链接'],
    [/user already registered/i, '该邮箱已被注册，请直接登录'],
    [/signups not allowed/i, '当前不允许注册新用户，请联系管理员开启'],
    [/at least 6 characters/i, '密码至少需要 6 位字符'],
    [/email address .+ is invalid/i, '邮箱地址无效或不存在，请使用可正常收件的常用邮箱'],
    [/valid email/i, '请输入正确的邮箱地址'],
    [/row-level security|permission denied/i, '没有权限执行该操作，请检查是否已登录或已绑定'],
    [/duplicate key/i, '数据重复：该记录已存在'],
    [/failed to fetch|networkerror|load failed|fetch failed/i, '网络异常，请检查网络连接与 Supabase 配置'],
    [/placeholder/i, '尚未配置 Supabase，请先完成 .env.local 配置'],
  ]
  for (const [pattern, text] of rules) {
    if (pattern.test(message)) return text
  }
  return message || '操作失败，请稍后再试'
}

/**
 * 复制文本到剪贴板。
 * 优先使用 Clipboard API，失败时降级为隐藏 textarea + execCommand，
 * 以兼容部分不支持 Clipboard API 的内置浏览器（如某些微信 webview）。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 忽略，走降级方案
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

/** 校验是否为合法的 6 位数字邀请码 */
export function isValidInviteCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

/** 格式化为「x年x月x日」用于展示绑定纪念日 */
export function formatDateCN(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
