'use client'

/**
 * ============================================================
 * NoteActionSheet —— 笔记长按操作面板（底部弹出，Apple 风格）
 * ============================================================
 * 长按任意笔记卡片后弹出，提供两类操作：
 * - 转换类型：共享 ⇄ 私人（转共享需已绑定情侣，未绑定时按钮禁用并提示）
 * - 删除笔记：交给父组件的 ConfirmDialog 二次确认后再执行
 *
 * 面板只负责「选择动作」，所有业务回调都由父组件处理。
 */
import { Heart, Lock, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Note } from '@/lib/types'

interface NoteActionSheetProps {
  /** 目标笔记（null = 关闭状态） */
  note: Note | null
  /** 是否已绑定情侣（决定「转为共享」是否可用） */
  isBound: boolean
  /** 点击「转换类型」 */
  onConvertType: (note: Note) => void
  /** 点击「删除」（父组件负责二次确认弹窗） */
  onDelete: (note: Note) => void
  /** 关闭面板 */
  onClose: () => void
}

export function NoteActionSheet({
  note,
  isBound,
  onConvertType,
  onDelete,
  onClose,
}: NoteActionSheetProps) {
  // 私人笔记 → 提供转共享；共享笔记 → 提供转私人
  const toShared = note?.note_type === 'private'
  const convertDisabled = toShared && !isBound

  return (
    <Sheet open={!!note} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-3xl border-rose-100 bg-white px-4 pb-9 pt-2 [&>button]:hidden"
      >
        {/* 顶部小把手（视觉提示：可下滑关闭） */}
        <div className="mx-auto mt-1 h-1.5 w-10 shrink-0 rounded-full bg-stone-200" aria-hidden />

        <SheetHeader className="shrink-0 items-center pb-1 pt-3 text-center">
          <SheetTitle className="max-w-full truncate text-center text-base font-semibold text-stone-800">
            {note?.title || '无标题'}
          </SheetTitle>
          <SheetDescription className="text-center text-xs">
            {toShared ? '这篇笔记目前仅自己可见' : '这篇笔记与另一半共享'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex shrink-0 flex-col gap-2.5 pt-1">
          {/* 转换类型 */}
          <button
            type="button"
            onClick={() => note && onConvertType(note)}
            disabled={convertDisabled}
            className="flex h-15 w-full items-center gap-3.5 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-left transition-colors active:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
              {toShared ? (
                <Heart className="h-4.5 w-4.5 text-rose-400" />
              ) : (
                <Lock className="h-4.5 w-4.5 text-rose-400" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-stone-700">
                {toShared ? '转为共享笔记' : '转为私人笔记'}
              </span>
              <span className="mt-0.5 block text-xs text-stone-400">
                {toShared
                  ? isBound
                    ? '与另一半共享这篇笔记'
                    : '需先绑定情侣才能共享'
                  : '仅自己可见，对方将无法查看'}
              </span>
            </span>
          </button>

          {/* 删除（父组件二次确认） */}
          <button
            type="button"
            onClick={() => note && onDelete(note)}
            className="flex h-15 w-full items-center gap-3.5 rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3 text-left transition-colors active:bg-red-100"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
              <Trash2 className="h-4.5 w-4.5 text-red-400" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-red-500">删除笔记</span>
              <span className="mt-0.5 block text-xs text-stone-400">删除后无法恢复</span>
            </span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
