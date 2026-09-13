'use client'

/**
 * ============================================================
 * FootprintTimeline —— 城市日志时间线（按到访日期正序）
 * ============================================================
 * 每条记录展示：日期 + 作者（我 / 对方昵称）+ 标题 + 标签 + 正文摘要，
 * 并提供编辑 / 删除入口（删除由父组件走二次确认）。
 * 记录列表已由 useFootprints 排好序，这里不再排序。
 */
import { Pencil, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatVisitCN } from '@/lib/footprints'
import type { Footprint } from '@/lib/types'

interface FootprintTimelineProps {
  records: Footprint[]
  /** 当前登录用户 id（用于区分「我」与对方） */
  currentUserId: string | null
  /** 对方昵称（缺失时显示「TA」） */
  partnerName: string | null
  onEdit: (record: Footprint) => void
  onDelete: (record: Footprint) => void
  loading?: boolean
  /** 空状态文案 */
  emptyHint?: string
}

export function FootprintTimeline({
  records,
  currentUserId,
  partnerName,
  onEdit,
  onDelete,
  loading = false,
  emptyHint = '还没有记录，写下你们在这座城市的故事吧',
}: FootprintTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-2.5">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-rose-100 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <Skeleton className="h-4 w-24 bg-rose-100 dark:bg-white/10" />
            <Skeleton className="mt-2 h-4 w-2/3 bg-rose-50 dark:bg-white/5" />
          </div>
        ))}
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 px-4 py-6 text-center text-xs text-stone-400 dark:border-white/10 dark:bg-white/5 dark:text-rose-200/50">
        {emptyHint}
      </p>
    )
  }

  return (
    <ol className="space-y-2.5">
      {records.map((record) => {
        const mine = record.user_id === currentUserId
        return (
          <li
            key={record.id}
            className="fp-timeline-item rounded-2xl border border-rose-100 bg-white p-4 dark:border-white/10 dark:bg-white/5"
          >
            {/* 日期 + 作者 */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-rose-500 dark:text-rose-300">
                {formatVisitCN(record.visited_at)}
              </span>
              <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-400 dark:bg-white/10 dark:text-rose-200/70">
                {mine ? '我' : partnerName || 'TA'}
              </span>
            </div>

            {/* 标题 */}
            {record.title && (
              <p className="mt-1.5 text-sm font-semibold text-stone-800 dark:text-rose-50">{record.title}</p>
            )}

            {/* 标签 */}
            {record.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {record.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-400 dark:bg-white/10 dark:text-rose-200/70"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 正文 */}
            {record.content && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-rose-100/80">
                {record.content}
              </p>
            )}

            {/* 操作 */}
            <div className="mt-2.5 flex justify-end gap-1">
              <button
                type="button"
                onClick={() => onEdit(record)}
                aria-label="编辑这条记录"
                className="flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-stone-400 transition-colors active:bg-rose-50 dark:text-rose-200/50 dark:active:bg-white/10"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                编辑
              </button>
              <button
                type="button"
                onClick={() => onDelete(record)}
                aria-label="删除这条记录"
                className="flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-red-400 transition-colors active:bg-red-50 dark:text-red-300/70 dark:active:bg-red-400/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                删除
              </button>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
