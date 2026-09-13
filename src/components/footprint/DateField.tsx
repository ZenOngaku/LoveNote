'use client'

/**
 * ============================================================
 * DateField —— 记录日期（点击后弹出自绘日期面板）
 * ============================================================
 * 值全程是 YYYY-MM-DD 字符串（数据库列为 date）：
 * 不要用 toISOString().slice(0, 10) 生成默认值（UTC 在东八区凌晨会串成前一天），
 * 默认值请用 src/lib/footprints.ts 的 todayISO()。
 *
 * 用自绘面板而不是原生 <input type="date">：后者在移动端会唤起系统日期滚轮，
 * 而滚轮的触感反馈（震动）网页侧关不掉（详见 DatePickerSheet 的说明）。
 */
import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { DatePickerSheet } from '@/components/footprint/DatePickerSheet'
import { formatVisitCN, todayISO } from '@/lib/footprints'

interface DateFieldProps {
  /** YYYY-MM-DD */
  value: string
  /** 可选上限（一般传今天，避免记录未来日期） */
  max?: string
  onChange: (value: string) => void
}

export function DateField({ value, max = todayISO(), onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="选择日期"
        className="flex h-14 w-full items-center gap-3 rounded-2xl border border-rose-100 bg-white px-4 text-left transition-colors active:bg-rose-50 dark:border-white/10 dark:bg-white/5 dark:active:bg-white/10"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-rose-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-stone-700 dark:text-rose-100">
          {formatVisitCN(value)}
        </span>
      </button>

      <DatePickerSheet
        open={open}
        value={value}
        max={max}
        onSelect={(next) => {
          onChange(next)
          setOpen(false)
        }}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
