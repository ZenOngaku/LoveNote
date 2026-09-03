'use client'

/**
 * ============================================================
 * 笔记主页 /notes
 * ============================================================
 * 顶部双 Tab：【情侣共享笔记】｜【我的私人笔记】
 * - 共享笔记：绑定后双方可看/增/改/删，Realtime 自动同步双方页面
 * - 私人笔记：仅本人可见，增删改查独立
 * - 右下角悬浮按钮新建笔记；点击卡片编辑；删除需二次确认
 * - 未登录由 AuthGuard 自动跳转登录页
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { NoteTabs } from '@/components/notes/NoteTabs'
import { NoteList } from '@/components/notes/NoteList'
import { NoteEditorModal } from '@/components/notes/NoteEditorModal'
import { ConfirmDialog } from '@/components/notes/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useNotes } from '@/hooks/useNotes'
import type { Note, NoteInput, NoteType } from '@/lib/types'

export default function NotesPage() {
  return (
    <AuthGuard>
      <NotesContent />
    </AuthGuard>
  )
}

function NotesContent() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { relation, partner, isBound } = useCouple()

  // 当前 Tab 类型（默认共享笔记）
  const [noteType, setNoteType] = useState<NoteType>('shared')
  // 当前共享空间 id（未绑定时为 null）
  const coupleId = isBound && relation ? relation.id : null

  // 笔记数据与操作（Realtime 在 hook 内部订阅）
  const { notes, loading, createNote, updateNote, removeNote } = useNotes(noteType, coupleId)

  // 弹窗状态
  const [editorOpen, setEditorOpen] = useState(false) // 新建/编辑弹窗
  const [editingNote, setEditingNote] = useState<Note | null>(null) // null = 新建
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null) // 删除确认弹窗对象
  const [saving, setSaving] = useState(false)

  /** 打开新建弹窗 */
  function openCreate() {
    setEditingNote(null)
    setEditorOpen(true)
  }

  /** 打开编辑弹窗 */
  function openEdit(note: Note) {
    setEditingNote(note)
    setEditorOpen(true)
  }

  /** 保存（新建或编辑） */
  async function handleSave(input: NoteInput): Promise<boolean> {
    if (saving) return false
    setSaving(true)
    const result = editingNote
      ? await updateNote(editingNote.id, input)
      : await createNote(input)
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return false
    }
    toast.success(editingNote ? '已保存，对方页面已同步更新 💗' : '笔记已记录 💗')
    return true
  }

  /** 确认删除（二次确认弹窗的回调） */
  async function handleDelete(): Promise<boolean> {
    if (!deleteTarget) return false
    const { error } = await removeNote(deleteTarget.id)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('笔记已删除')
    // 关闭编辑弹窗与确认弹窗
    setEditorOpen(false)
    setDeleteTarget(null)
    return true
  }

  const partnerName = partner?.nickname ?? null

  return (
    <AppShell title={noteType === 'shared' ? '情侣共享笔记' : '我的私人笔记'}>
      {/* 双 Tab 切换 */}
      <NoteTabs value={noteType} onChange={setNoteType} />

      <div className="mt-4">
        <NoteList
          notes={notes}
          loading={loading}
          currentUserId={user?.id ?? null}
          partnerName={partnerName}
          onEdit={openEdit}
          emptyState={
            noteType === 'shared' && !coupleId ? (
              /* 共享 Tab 但尚未绑定情侣 */
              <div className="rounded-3xl border border-dashed border-rose-200 bg-white/60 p-10 text-center">
                <div className="text-5xl" aria-hidden>
                  💞
                </div>
                <p className="mt-3 font-medium text-stone-600">还没有绑定情侣</p>
                <p className="mt-1 text-sm text-stone-400">
                  绑定后，你们的共享笔记会实时出现在这里
                </p>
                <Button
                  onClick={() => router.push('/')}
                  className="mt-5 h-11 rounded-full bg-rose-500 px-8 hover:bg-rose-600"
                >
                  去配对
                </Button>
              </div>
            ) : (
              /* 已绑定但还没有笔记 / 私人笔记为空 */
              <div className="rounded-3xl border border-dashed border-rose-200 bg-white/60 p-10 text-center">
                <div className="text-5xl" aria-hidden>
                  {noteType === 'shared' ? '📔' : '📝'}
                </div>
                <p className="mt-3 font-medium text-stone-600">
                  {noteType === 'shared' ? '还没有共享笔记' : '还没有私人笔记'}
                </p>
                <p className="mt-1 text-sm text-stone-400">
                  {noteType === 'shared'
                    ? '点击右下角 + 记录你们的第一个瞬间吧'
                    : '只属于自己的悄悄话，点击右下角 + 开始记录'}
                </p>
              </div>
            )
          }
        />
      </div>

      {/* 新建笔记悬浮按钮（FAB） */}
      <button
        type="button"
        onClick={openCreate}
        aria-label="新建笔记"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-300/60 transition-transform active:scale-95 min-[448px]:right-[calc(50%-13rem)]"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {/* 新建 / 编辑笔记弹窗 */}
      <NoteEditorModal
        open={editorOpen}
        note={editingNote}
        noteType={noteType}
        saving={saving}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        onDelete={() => setDeleteTarget(editingNote)}
      />

      {/* 删除笔记二次确认弹窗 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="确定删除这篇笔记吗？"
        description={
          deleteTarget
            ? `「${deleteTarget.title || '无标题'}」删除后无法恢复。${
                noteType === 'shared' ? '对方设备上的这篇笔记也会同步消失。' : ''
              }`
            : ''
        }
        confirmText="删除"
        danger
        onConfirm={handleDelete}
      />
    </AppShell>
  )
}
