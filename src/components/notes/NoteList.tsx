'use client'

/**
 * ============================================================
 * NoteList —— 笔记列表
 * ============================================================
 * - 按最后修改时间倒序展示（排序由查询层完成）
 * - 每项显示：标题 / 内容预览（富文本提取纯文本，最多两行）/
 *   相对时间 / 待办进度（含待办清单时）/ 创建者（共享笔记）
 * - 加载中显示骨架屏；空列表显示空状态插画区
 * - 点击卡片进入全屏编辑页；长按卡片（桌面右键等价）弹出操作面板
 */
import { ListTodo } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useLongPress } from '@/hooks/useLongPress'
import { countTodos, formatRelativeTime, noteExcerpt } from '@/lib/helpers'
import type { Note } from '@/lib/types'

interface NoteListProps {
  notes: Note[]
  loading: boolean
  /** 当前登录用户 id（用于显示「我」/「TA」创建标识） */
  currentUserId: string | null
  /** 对方昵称（共享笔记显示创建者时使用） */
  partnerName?: string | null
  /** 空状态内容（不同 Tab 的空提示不同，由父组件传入） */
  emptyState: React.ReactNode
  /** 点击笔记卡片（进入全屏编辑页） */
  onEdit: (note: Note) => void
  /** 长按笔记卡片（弹出操作面板；桌面端右键等价） */
  onLongPress?: (note: Note) => void
}

export function NoteList({
  notes,
  loading,
  currentUserId,
  partnerName,
  emptyState,
  onEdit,
  onLongPress,
}: NoteListProps) {
  // 加载中：骨架屏
  if (loading) {
    return (
      <div className="space-y-3" aria-label="加载中">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-rose-100 bg-white p-4">
            <Skeleton className="h-5 w-2/5 bg-rose-100" />
            <Skeleton className="mt-3 h-4 w-full bg-rose-50" />
            <Skeleton className="mt-2 h-4 w-3/5 bg-rose-50" />
            <Skeleton className="mt-3 h-3 w-1/4 bg-rose-50" />
          </div>
        ))}
      </div>
    )
  }

  // 空列表：显示父组件定制的空状态
  if (notes.length === 0) {
    return <>{emptyState}</>
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          isMine={note.user_id === currentUserId}
          partnerName={partnerName}
          onEdit={onEdit}
          onLongPress={onLongPress}
        />
      ))}
    </ul>
  )
}

/* ---------------- 单张笔记卡片 ---------------- */

interface NoteCardProps {
  note: Note
  /** 是否为当前用户创建（共享笔记显示「我」/「TA」） */
  isMine: boolean
  partnerName?: string | null
  onEdit: (note: Note) => void
  onLongPress?: (note: Note) => void
}

function NoteCard({ note, isMine, partnerName, onEdit, onLongPress }: NoteCardProps) {
  const excerpt = noteExcerpt(note.content)
  const todos = countTodos(note.content)

  // 长按（移动端按住 500ms / 桌面右键）弹出操作面板；未提供 onLongPress 时仅点击生效
  const pressHandlers = useLongPress(
    () => onLongPress?.(note),
    () => onEdit(note),
  )

  return (
    <li>
      {/* 整卡可点击进入全屏编辑页；active 缩放提供触控反馈。
          select-none + touch-callout 防止长按时弹系统选字/拨号菜单 */}
      <button
        type="button"
        {...pressHandlers}
        className="w-full touch-pan-y select-none rounded-2xl border border-rose-100 bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.99] [-webkit-touch-callout:none]"
        aria-label={`编辑笔记：${note.title || '无标题'}（长按可删除或转换类型）`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-medium text-stone-800">
            {note.title || '无标题'}
          </h3>
          {/* 共享笔记显示创建者标识 */}
          {note.note_type === 'shared' && (
            <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-400">
              {isMine ? '我' : partnerName || 'TA'}
            </span>
          )}
        </div>

        <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-stone-500">
          {excerpt || '暂无内容'}
        </p>

        <p className="mt-2.5 flex items-center gap-2 text-xs text-stone-400">
          <span>{formatRelativeTime(note.updated_at)} 修改</span>
          {/* 含待办清单时显示勾选进度 */}
          {todos && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-600">
              <ListTodo className="h-3 w-3" aria-hidden />
              待办 {todos.done}/{todos.total}
            </span>
          )}
        </p>
      </button>
    </li>
  )
}
