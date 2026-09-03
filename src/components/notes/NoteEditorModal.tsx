'use client'

/**
 * ============================================================
 * NoteEditorModal —— 新建 / 编辑笔记弹窗
 * ============================================================
 * - note 为 null 时是「新建」模式，否则是「编辑」模式（可删除）
 * - 弹窗每次打开 / 切换笔记时，通过 key 重建内部表单组件完成状态初始化
 * - 保存成功后由父组件关闭弹窗并刷新列表（Realtime 会同步到对方）
 * - 输入框 16px 字号，适配手机软键盘；标题最多 50 字
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Heart, Loader2, Lock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Note, NoteInput, NoteType } from '@/lib/types'

interface NoteEditorModalProps {
  open: boolean
  /** null 表示新建笔记 */
  note: Note | null
  /** 当前所在 Tab（新建笔记的类型） */
  noteType: NoteType
  saving: boolean
  onClose: () => void
  /** 保存（新建或更新）；返回 false 表示失败，弹窗保持打开 */
  onSave: (input: NoteInput) => Promise<boolean>
  /** 删除（仅编辑模式出现），由父组件弹出二次确认 */
  onDelete: () => void
}

export function NoteEditorModal({
  open,
  note,
  noteType,
  saving,
  onClose,
  onSave,
  onDelete,
}: NoteEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* key 绑定笔记 id：弹窗打开/切换笔记时重建表单，自动完成状态初始化 */}
      {open && (
        <EditorForm
          key={note?.id ?? 'new-note'}
          note={note}
          noteType={noteType}
          saving={saving}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </Dialog>
  )
}

/** 弹窗内容（表单） */
function EditorForm({
  note,
  noteType,
  saving,
  onClose,
  onSave,
  onDelete,
}: Omit<NoteEditorModalProps, 'open'>) {
  const isEditing = !!note
  // 用当前笔记内容作为初始值（组件随 key 重建，无需 useEffect 重置）
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')

  /** 保存前校验：标题和内容不能都为空 */
  async function handleSave() {
    if (!title.trim() && !content.trim()) {
      toast.warning('标题和内容不能都为空哦~')
      return
    }
    const ok = await onSave({ title: title.trim(), content })
    // 保存成功后由父组件关闭弹窗
    if (ok) onClose()
  }

  return (
    <DialogContent className="max-h-[88dvh] max-w-[92%] overflow-y-auto rounded-3xl border-rose-100 bg-white p-5 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base font-semibold text-stone-800">
          {isEditing ? '编辑笔记' : '新建笔记'}
          {/* 当前笔记类型标识 */}
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-normal text-rose-400">
            {noteType === 'shared' ? (
              <>
                <Heart className="mr-0.5 inline h-3 w-3" />
                共享
              </>
            ) : (
              <>
                <Lock className="mr-0.5 inline h-3 w-3" />
                私人
              </>
            )}
          </span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 pt-1">
        {/* 标题输入 */}
        <div className="space-y-2">
          <Label htmlFor="note-title" className="text-stone-600">
            标题
          </Label>
          <Input
            id="note-title"
            value={title}
            maxLength={50}
            placeholder="给这份心情起个名字~"
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 rounded-xl border-rose-100 text-base"
          />
        </div>

        {/* 正文输入 */}
        <div className="space-y-2">
          <Label htmlFor="note-content" className="text-stone-600">
            内容
          </Label>
          <Textarea
            id="note-content"
            value={content}
            placeholder="今天想记录点什么...（支持多行）"
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[180px] resize-none rounded-xl border-rose-100 text-base leading-relaxed"
          />
        </div>

        {/* 底部操作：编辑模式可删除 */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {isEditing ? (
            <Button
              variant="ghost"
              onClick={onDelete}
              className="h-11 rounded-full px-4 text-red-400 hover:bg-red-50 hover:text-red-500"
              aria-label="删除笔记"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              删除
            </Button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={saving}
              className="h-11 rounded-full px-5 text-stone-500 hover:bg-stone-50"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-11 rounded-full bg-rose-500 px-6 hover:bg-rose-600"
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  )
}
