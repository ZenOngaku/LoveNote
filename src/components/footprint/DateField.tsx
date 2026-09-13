'use client'

/**
 * ============================================================
 * DateField —— 记录日期输入（足迹表单用）
 * ============================================================
 * 用原生 <input type="date">：移动端唤起系统日期选择器，微信 XWeb 也稳定支持，
 * 比自写日历控件更省心。
 *
 * ⚠️ 值全程是 YYYY-MM-DD 字符串（数据库列为 date）：
 *    不要用 toISOString().slice(0, 10) 生成默认值（UTC 在东八区凌晨会串成前一天），
 *    默认值请用 src/lib/footprints.ts 的 todayISO()。
 */
import { weekdayCN } from '@/lib/footprints'

interface DateFieldProps {
  id?: string
  /** YYYY-MM-DD */
  value: string
  /** 可选上限（一般传今天，避免记录未来日期） */
  max?: string
  onChange: (value: string) => void
}

export function DateField({ id = 'footprint-date', value, max, onChange }: DateFieldProps) {
  return (
    <div className="flex h-14 items-center gap-3 rounded-2xl border border-rose-100 bg-white px-4 dark:border-white/10 dark:bg-white/5">
      <input
        id={id}
        type="date"
        value={value}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-0 flex-1 bg-transparent text-sm text-stone-700 outline-none dark:text-rose-100 [color-scheme:light] dark:[color-scheme:dark]"
      />
      <span className="shrink-0 text-xs text-stone-400 dark:text-rose-200/50">{weekdayCN(value)}</span>
    </div>
  )
}
