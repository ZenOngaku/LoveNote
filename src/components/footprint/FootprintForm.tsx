'use client'

/**
 * ============================================================
 * FootprintForm —— 足迹记录表单（新增 / 编辑共用）
 * ============================================================
 * 字段：标题、日期、标签（预设 + 自定义）、正文。
 * 校验：标题与正文至少填一项（项目笔记的既有约定：空内容不落库）。
 * 提交结果由父组件（CitySheet）负责 toast 与关闭。
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/footprint/DateField'
import { TagPicker } from '@/components/footprint/TagPicker'
import { CONTENT_MAX_LEN, TITLE_MAX_LEN, todayISO } from '@/lib/footprints'
import type { Footprint } from '@/lib/types'

export interface FootprintFormValue {
  title: string
  tags: string[]
  visited_at: string
  content: string
}

interface FootprintFormProps {
  /** 编辑时传入原记录；新增传 null */
  initial?: Footprint | null
  /** 提交（返回 true 表示成功，父组件会关闭表单） */
  onSubmit: (value: FootprintFormValue) => Promise<boolean>
  onCancel: () => void
  /** 提交中（禁用按钮） */
  submitting: boolean
  /** 校验失败时的提示（由父组件弹 toast） */
  onInvalid: () => void
}

export function FootprintForm({
  initial = null,
  onSubmit,
  onCancel,
  submitting,
  onInvalid,
}: FootprintFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [visitedAt, setVisitedAt] = useState(initial?.visited_at ?? todayISO())
  const [content, setContent] = useState(initial?.content ?? '')

  async function handleSubmit() {
    if (!title.trim() && !content.trim()) {
      onInvalid()
      return
    }
    await onSubmit({
      title: title.trim().slice(0, TITLE_MAX_LEN),
      tags,
      visited_at: visitedAt || todayISO(),
      content: content.trim().slice(0, CONTENT_MAX_LEN),
    })
  }

  return (
    <div className="space-y-3">
      {/* 标题 */}
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={TITLE_MAX_LEN}
        placeholder="这次去了哪、做了什么？"
        className="h-13 w-full rounded-2xl border border-rose-100 bg-white px-4 text-sm text-stone-700 outline-none placeholder:text-stone-300 dark:border-white/10 dark:bg-white/5 dark:text-rose-100 dark:placeholder:text-rose-200/30"
      />

      {/* 日期 */}
      <DateField value={visitedAt} max={todayISO()} onChange={setVisitedAt} />

      {/* 标签 */}
      <TagPicker value={tags} onChange={setTags} />

      {/* 正文 */}
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={CONTENT_MAX_LEN}
        rows={4}
        placeholder="写下当时的心情、吃到的美食、想对 TA 说的话…"
        className="w-full resize-none rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm leading-relaxed text-stone-700 outline-none placeholder:text-stone-300 dark:border-white/10 dark:bg-white/5 dark:text-rose-100 dark:placeholder:text-rose-200/30"
      />

      {/* 操作 */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
          className="h-11 flex-1 rounded-full text-stone-500 hover:bg-stone-50 dark:text-rose-200/70 dark:hover:bg-white/10"
        >
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="h-11 flex-[2] rounded-full bg-rose-500 hover:bg-rose-600"
        >
          {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {initial ? '保存修改' : '记录这一刻'}
        </Button>
      </div>
    </div>
  )
}
