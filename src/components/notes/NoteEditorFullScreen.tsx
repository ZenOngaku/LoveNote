'use client'

/**
 * ============================================================
 * NoteEditorFullScreen —— 全屏笔记编辑页（覆盖整个应用视口）
 * ============================================================
 * 参考 Apple 备忘录的交互：
 * - 从底部滑入覆盖全部内容（z-50 盖过底部导航 / FAB）
 * - 无「保存」按钮：输入停顿 900ms 自动保存，返回时立即补存
 * - 顶部实时显示保存状态（保存中… / 已保存 HH:MM）
 * - 标题为无边框大字输入，正文为富文本编辑器
 * - 删除走父组件的二次确认弹窗
 *
 * 关闭时通过 onClose 携带最新标题/正文，由父组件决定是否
 * 清理「新建后什么都没写」的空笔记。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Heart, Loader2, Lock, Trash2 } from 'lucide-react'
import { RichNoteEditor } from './RichNoteEditor'
import { formatRelativeTime, toEditorHtml } from '@/lib/helpers'
import type { Note, NoteInput, NoteType } from '@/lib/types'

/** 自动保存防抖间隔（ms）：停顿超过该时长才落库 */
const AUTOSAVE_DELAY = 900

interface NoteEditorFullScreenProps {
  /** 正在编辑的笔记（打开时的快照；列表 Realtime 刷新不影响编辑中内容） */
  note: Note
  /** 当前 Tab 类型（顶部徽章展示） */
  noteType: NoteType
  /** 自动保存回调；失败时由父组件 toast */
  onSave: (id: string, input: NoteInput) => Promise<boolean>
  /** 删除按钮（父组件弹二次确认） */
  onDeleteRequest: () => void
  /** 关闭编辑页；携带最新内容供父组件清理空笔记 */
  onClose: (latest: NoteInput) => void
}

export function NoteEditorFullScreen({
  note,
  noteType,
  onSave,
  onDeleteRequest,
  onClose,
}: NoteEditorFullScreenProps) {
  // 标题双份：state 驱动 UI，ref 供防抖回调读取最新值
  const [title, setTitle] = useState(note.title)
  const titleRef = useRef(note.title)
  const contentRef = useRef(note.content)
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  /** 立即保存当前内容 */
  const doSave = useCallback(async () => {
    dirtyRef.current = false
    setSaveState('saving')
    const ok = await onSave(note.id, {
      title: titleRef.current.trim(),
      content: contentRef.current,
    })
    if (ok) {
      setSaveState('saved')
      setSavedAt(new Date())
    } else {
      // 失败时父组件已 toast；状态回 idle，下次输入会重试
      setSaveState('idle')
    }
  }, [note.id, onSave])

  /** 输入后调度防抖保存 */
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    setSaveState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void doSave(), AUTOSAVE_DELAY)
  }, [doSave])

  // 卸载兜底：清掉挂起的定时器（正常路径由 handleClose flush）
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const handleTitleChange = (value: string) => {
    titleRef.current = value
    setTitle(value)
    scheduleSave()
  }

  const handleContentChange = useCallback(
    (html: string) => {
      contentRef.current = html
      scheduleSave()
    },
    [scheduleSave],
  )

  /** 返回：补存未落库的修改，再通知父组件关闭 */
  const handleClose = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (dirtyRef.current) await doSave()
    onClose({ title: titleRef.current.trim(), content: contentRef.current })
  }, [doSave, onClose])

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      className="fixed inset-0 z-50 bg-white dark:bg-[#2b1a13]"
      role="dialog"
      aria-modal="true"
      aria-label="编辑笔记"
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col pt-[env(safe-area-inset-top)]">
        {/* 顶部操作栏：返回 | 类型徽章 · 保存状态 | 删除 */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-rose-100/80 bg-white/95 px-2 dark:border-white/10 dark:bg-[#2b1a13]/95">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => void handleClose()}
              aria-label="返回并保存"
              className="flex h-11 w-11 items-center justify-center rounded-full text-stone-600 transition-colors hover:bg-rose-50 active:bg-rose-100 dark:text-rose-200/70 dark:hover:bg-white/10 dark:active:bg-white/15"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <span
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                noteType === 'shared'
                  ? 'bg-rose-50 text-rose-400 dark:bg-white/10 dark:text-rose-300'
                  : 'bg-stone-100 text-stone-500 dark:bg-white/10 dark:text-rose-200/70'
              }`}
            >
              {noteType === 'shared' ? (
                <>
                  <Heart className="h-3 w-3" />
                  共享
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  私人
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <SaveStatus state={saveState} savedAt={savedAt} />
            <button
              type="button"
              onClick={onDeleteRequest}
              aria-label="删除笔记"
              className="flex h-10 w-10 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-50 active:bg-red-100 dark:hover:bg-white/10 dark:active:bg-white/15"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* 标题（无边框大字，Apple 备忘录风格） */}
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          maxLength={50}
          placeholder="标题"
          aria-label="笔记标题"
          className="shrink-0 bg-transparent px-6 pb-1 pt-5 text-[22px] font-bold text-stone-800 outline-none placeholder:text-stone-300 dark:text-rose-50 dark:placeholder:text-rose-200/30"
        />
        <p className="shrink-0 px-6 pb-1 text-xs text-stone-400 dark:text-rose-200/40">
          {formatRelativeTime(note.updated_at)}修改 · 内容自动保存
        </p>

        {/* 富文本编辑器（工具栏 + 编辑区，占满剩余高度） */}
        <RichNoteEditor
          initialHtml={toEditorHtml(note.content)}
          onChange={handleContentChange}
          placeholder="记录你们的故事…"
        />
      </div>
    </motion.div>
  )
}

/** 顶部保存状态指示 */
function SaveStatus({ state, savedAt }: { state: 'idle' | 'saving' | 'saved'; savedAt: Date | null }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1 px-1 text-xs text-stone-400 dark:text-rose-200/50" role="status">
        <Loader2 className="h-3 w-3 animate-spin" />
        保存中…
      </span>
    )
  }
  if (state === 'saved' && savedAt) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return (
      <span className="px-1 text-xs text-emerald-500" role="status">
        已保存 {pad(savedAt.getHours())}:{pad(savedAt.getMinutes())}
      </span>
    )
  }
  return null
}
