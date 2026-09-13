'use client'

/**
 * ============================================================
 * TagPicker —— 标签选择（预设分类 + 自定义，可多选）
 * ============================================================
 * - 预设标签来自 src/lib/footprints.ts（旅行/美食/纪念日… 共 12 个）
 * - 已选中的自定义标签可单独移除；写入时会再走一遍 normalizeTags 归一化
 * - 到达数量上限（8 个）后禁用新增入口，避免与数据库 check 约束冲突
 */
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { FOOTPRINT_PRESET_TAGS, TAG_MAX_COUNT, TAG_MAX_LEN } from '@/lib/footprints'

interface TagPickerProps {
  value: string[]
  onChange: (tags: string[]) => void
}

export function TagPicker({ value, onChange }: TagPickerProps) {
  const [draft, setDraft] = useState('')
  const presets = FOOTPRINT_PRESET_TAGS as readonly string[]
  const customTags = value.filter((tag) => !presets.includes(tag))
  const full = value.length >= TAG_MAX_COUNT

  /** 点选 / 取消预设或自定义标签 */
  function toggle(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((item) => item !== tag))
      return
    }
    if (full) return
    onChange([...value, tag])
  }

  /** 添加自定义标签 */
  function addCustom() {
    const tag = draft.trim().slice(0, TAG_MAX_LEN)
    if (!tag) return
    if (!value.includes(tag) && !full) onChange([...value, tag])
    setDraft('')
  }

  return (
    <div className="space-y-2.5">
      {/* 预设标签 */}
      <div className="flex flex-wrap gap-2">
        {presets.map((tag) => {
          const active = value.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              disabled={!active && full}
              aria-pressed={active}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                active
                  ? 'bg-rose-500 font-medium text-white'
                  : 'border border-rose-100 bg-white text-stone-500 active:bg-rose-50 dark:border-white/10 dark:bg-white/5 dark:text-rose-100/80 dark:active:bg-white/15'
              }`}
            >
              {tag}
            </button>
          )
        })}
      </div>

      {/* 已选自定义标签 */}
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-600 dark:bg-rose-500/25 dark:text-rose-100"
            >
              {tag}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
        </div>
      )}

      {/* 自定义输入 */}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addCustom()
            }
          }}
          maxLength={TAG_MAX_LEN}
          disabled={full}
          placeholder={full ? `最多 ${TAG_MAX_COUNT} 个标签` : '自定义标签（如：第一次看海）'}
          className="h-11 min-w-0 flex-1 rounded-2xl border border-rose-100 bg-white px-4 text-sm text-stone-700 outline-none placeholder:text-stone-300 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-rose-100 dark:placeholder:text-rose-200/30"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={full || !draft.trim()}
          aria-label="添加自定义标签"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 transition-colors active:bg-rose-100 disabled:opacity-40 dark:bg-white/10 dark:text-rose-200 dark:active:bg-white/20"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
