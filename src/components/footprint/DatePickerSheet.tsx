'use client'

/**
 * ============================================================
 * DatePickerSheet —— 自绘日期选择（底部面板：月历 + 年份网格）
 * ============================================================
 * 为什么不用原生 <input type="date">：移动端会唤起系统日期滚轮，而滚轮的触感反馈
 * （震动）是系统 UI 的行为，网页侧无法关闭；自绘面板完全不触发系统触感，
 * 样式也能与 App 统一（原生控件各平台样式并不一致）。
 *
 * 两级视图：点标题「2026年9月」切到年份网格（一页 12 年，可整页翻），
 * 选中年份后回到月历 —— 记录多年前的旅行时不用一个月一个月地翻。
 *
 * 约定：面板每次打开都回到当前选中值所在月份/年份页 —— 用 key 让内部状态重挂载，
 * 避免在 effect 里同步 setState（项目 lint 规则禁止）。
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatDateCN } from '@/lib/helpers'
import {
  formatMonthCN,
  monthGrid,
  shiftMonth,
  todayISO,
  weekdayCN,
  yearGrid,
  yearPageStart,
} from '@/lib/footprints'

interface DatePickerSheetProps {
  open: boolean
  /** 当前值 YYYY-MM-DD */
  value: string
  /** 可选上限（一般传今天，避免记录未来日期） */
  max?: string
  onSelect: (value: string) => void
  onClose: () => void
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
/** 年份网格一页多少年（4×3） */
const YEAR_PAGE_SIZE = 12

export function DatePickerSheet({ open, value, max, onSelect, onClose }: DatePickerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="bottom"
        data-picker="date"
        className="mx-auto max-w-md rounded-t-3xl border-rose-100 bg-white px-4 pb-9 pt-2 [&>button]:hidden dark:border-white/10 dark:bg-[#2b1a13]"
      >
        <div className="mx-auto mt-1 h-1.5 w-10 shrink-0 rounded-full bg-stone-200 dark:bg-white/20" aria-hidden />
        <SheetHeader className="shrink-0 items-center pb-1 pt-3 text-center">
          <SheetTitle className="text-base font-semibold text-stone-800 dark:text-rose-50">选择日期</SheetTitle>
        </SheetHeader>
        {/* key 让面板每次打开都回到当前选中值所在月份 */}
        <DatePickerBody key={open ? `open-${value}` : 'closed'} initial={value} max={max} onSelect={onSelect} />
      </SheetContent>
    </Sheet>
  )
}

/** 面板主体：月历 / 年份网格两级切换（模块顶层组件，满足 react-hooks/static-components） */
function DatePickerBody({
  initial,
  max,
  onSelect,
}: {
  initial: string
  max?: string
  onSelect: (value: string) => void
}) {
  const today = todayISO()
  const startMonth = (initial || today).slice(0, 7)
  const [mode, setMode] = useState<'day' | 'year'>('day')
  const [cursor, setCursor] = useState(startMonth)
  const [yearPage, setYearPage] = useState(() => yearPageStart(Number(startMonth.slice(0, 4)), YEAR_PAGE_SIZE))
  const { leading, days } = useMemo(() => monthGrid(cursor), [cursor])

  const maxYear = max ? Number(max.slice(0, 4)) : undefined
  const cursorYear = Number(cursor.slice(0, 4))
  const cursorMonth = cursor.slice(5, 7)

  return (
    <div className="pt-2">
      {/* 顶部一行：翻页（月历=翻月，年份网格=翻 12 年） */}
      <div className="flex items-center justify-between px-1">
        <NavButton
          label={mode === 'day' ? '上一个月' : '往前 12 年'}
          onClick={() => (mode === 'day' ? setCursor((prev) => shiftMonth(prev, -1)) : setYearPage((prev) => prev - YEAR_PAGE_SIZE))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </NavButton>

        {/* 标题可点：在月历与年份网格之间切换 */}
        <button
          type="button"
          onClick={() => setMode((prev) => (prev === 'day' ? 'year' : 'day'))}
          aria-label={mode === 'day' ? '选择年份' : '返回月历'}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors active:bg-rose-50 dark:text-rose-100 dark:active:bg-white/10"
        >
          {mode === 'day' ? formatMonthCN(cursor) : `${yearPage} - ${yearPage + YEAR_PAGE_SIZE - 1}`}
          <ChevronRight
            className={`h-3.5 w-3.5 text-stone-400 transition-transform dark:text-rose-200/40 ${mode === 'year' ? 'rotate-90' : ''}`}
            aria-hidden
          />
        </button>

        <NavButton
          label={mode === 'day' ? '下一个月' : '往后 12 年'}
          onClick={() => (mode === 'day' ? setCursor((prev) => shiftMonth(prev, 1)) : setYearPage((prev) => prev + YEAR_PAGE_SIZE))}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </NavButton>
      </div>

      {mode === 'year' ? (
        /* 年份网格：一页 12 年 */
        <div className="mt-2 grid grid-cols-4 gap-y-1">
          {yearGrid(yearPage, YEAR_PAGE_SIZE).map((year) => {
            const selected = year === cursorYear
            const disabled = maxYear !== undefined && year > maxYear
            return (
              <button
                key={year}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                data-year={year}
                onClick={() => {
                  setCursor(`${year}-${cursorMonth}`)
                  setMode('day')
                }}
                className={`mx-auto flex h-11 w-16 items-center justify-center rounded-2xl text-sm transition-colors disabled:opacity-30 ${
                  selected
                    ? 'bg-rose-500 font-medium text-white'
                    : 'text-stone-600 active:bg-rose-50 dark:text-rose-100/80 dark:active:bg-white/10'
                }`}
              >
                {year}
              </button>
            )
          })}
        </div>
      ) : (
        <>
          {/* 星期表头 */}
          <div className="mt-2 grid grid-cols-7 text-center text-[11px] text-stone-400 dark:text-rose-200/40">
            {WEEK_LABELS.map((label) => (
              <span key={label} className="py-1">
                {label}
              </span>
            ))}
          </div>

          {/* 日期格 */}
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: leading }, (_, i) => (
              <span key={`blank-${i}`} aria-hidden />
            ))}
            {days.map((iso) => {
              const selected = iso === initial
              const isToday = iso === today
              const disabled = Boolean(max && iso > max)
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={`${formatDateCN(iso)} ${weekdayCN(iso)}`}
                  onClick={() => onSelect(iso)}
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors disabled:opacity-30 ${
                    selected
                      ? 'bg-rose-500 font-medium text-white'
                      : isToday
                        ? 'bg-rose-50 font-medium text-rose-500 dark:bg-white/10 dark:text-rose-200'
                        : 'text-stone-600 active:bg-rose-50 dark:text-rose-100/80 dark:active:bg-white/10'
                  }`}
                >
                  {Number(iso.slice(8, 10))}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* 快捷入口 */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setMode('day')}
          className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
            mode === 'year'
              ? 'bg-rose-50 text-rose-500 active:bg-rose-100 dark:bg-white/10 dark:text-rose-200 dark:active:bg-white/20'
              : 'invisible'
          }`}
        >
          返回月历
        </button>
        <button
          type="button"
          onClick={() => onSelect(today)}
          className="rounded-full bg-rose-50 px-4 py-2 text-xs font-medium text-rose-500 transition-colors active:bg-rose-100 dark:bg-white/10 dark:text-rose-200 dark:active:bg-white/20"
        >
          今天（{formatDateCN(today)}）
        </button>
      </div>
    </div>
  )
}

/** 月份/年份翻页按钮（模块顶层，避免重复样式） */
function NavButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition-colors active:bg-rose-50 dark:text-rose-200/60 dark:active:bg-white/10"
    >
      {children}
    </button>
  )
}
