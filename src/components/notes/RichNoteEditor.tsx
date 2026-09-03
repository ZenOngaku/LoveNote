'use client'

/**
 * ============================================================
 * RichNoteEditor —— Tiptap 富文本编辑器（Apple 备忘录风格）
 * ============================================================
 * 功能（对标 Apple 备忘录常规排版能力）：
 * - 行内样式：加粗 / 斜体 / 下划线 / 删除线 / 高亮
 * - 标题：H1 / H2 / H3
 * - 列表：无序列表 / 有序列表 / 待办清单（checkbox 可直接点选）
 * - 块级：引用块 / 分隔线
 * - 历史：撤销 / 重做
 *
 * 结构：工具栏（横向可滚动）在上，编辑区在下占满剩余空间。
 * 输出 HTML，由父组件负责存储（content 字段）与防抖自动保存。
 *
 * 安全：库内旧内容喂给编辑器前用 DOMPurify 消毒；编辑器自身的
 * 输出是 Tiptap schema 生成的受控 HTML，不含可执行脚本。
 *
 * SSR：Tiptap useEditor 在服务端渲染阶段返回 null，编辑区仅在
 * 客户端 hydration 后出现（工具栏按钮 disabled 兜底）。
 */
import { type ReactNode } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import DOMPurify from 'dompurify'
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Redo2,
  Strikethrough,
  TextQuote,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'

/** 消毒库内 HTML（SSR 环境跳过，编辑器只在客户端创建） */
function sanitize(html: string): string {
  if (typeof window === 'undefined') return html
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

interface RichNoteEditorProps {
  /** 初始 HTML（库里 content，自动消毒 + 兼容旧纯文本由父组件转换） */
  initialHtml: string
  /** 内容变化（每次按键/格式化都会触发；防抖由父组件处理） */
  onChange: (html: string) => void
  /** 内容为空时的占位文字 */
  placeholder?: string
}

export function RichNoteEditor({ initialHtml, onChange, placeholder = '开始记录…' }: RichNoteEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        // heading 默认只有 h1/h2，放宽到 h1~h3；history（撤销重做）自带
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
        Highlight,
        TaskList,
        TaskItem.configure({ nested: true }),
        Placeholder.configure({ placeholder }),
      ],
      content: sanitize(initialHtml),
      editorProps: {
        attributes: {
          // 排版样式在 globals.css 的 .note-editor 下定义
          class: 'min-h-full px-6 py-4 pb-10',
        },
      },
      onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    },
    // 仅随 key 重建（切换笔记），内容初始化只发生在创建时
    [],
  )

  return (
    <div className="note-editor flex min-h-0 flex-1 flex-col">
      <Toolbar editor={editor} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  )
}

/* ---------------- 工具栏 ---------------- */

interface ToolbarButtonProps {
  editor: Editor | null
  label: string
  active?: boolean
  disabled?: boolean
  /** 点击时执行的格式化命令（编辑器可用时才回调） */
  onApply: (editor: Editor) => void
  children: ReactNode
}

/** 工具栏按钮：mousedown 阻止焦点转移，保证连续操作格式化不闪断 */
function ToolbarButton({ editor, label, active = false, disabled = false, onApply, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || !editor}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => editor && onApply(editor)}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-rose-100 text-rose-600' : 'text-stone-600 hover:bg-rose-50 active:bg-rose-100'
      } disabled:opacity-40`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const canUndo = !!editor?.can().undo()
  const canRedo = !!editor?.can().redo()

  return (
    <div
      role="toolbar"
      aria-label="文字格式"
      className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-rose-100/80 bg-white/95 px-3 py-2 backdrop-blur-sm"
    >
      {/* 标题 */}
      <ToolbarButton
        editor={editor}
        label="一级标题"
        active={!!editor?.isActive('heading', { level: 1 })}
        onApply={(e) => e.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        label="二级标题"
        active={!!editor?.isActive('heading', { level: 2 })}
        onApply={(e) => e.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        label="三级标题"
        active={!!editor?.isActive('heading', { level: 3 })}
        onApply={(e) => e.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-[18px] w-[18px]" />
      </ToolbarButton>

      <Divider />

      {/* 行内样式 */}
      <ToolbarButton
        editor={editor}
        label="加粗"
        active={!!editor?.isActive('bold')}
        onApply={(e) => e.chain().focus().toggleBold().run()}
      >
        <Bold className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        label="斜体"
        active={!!editor?.isActive('italic')}
        onApply={(e) => e.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        label="下划线"
        active={!!editor?.isActive('underline')}
        onApply={(e) => e.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        label="删除线"
        active={!!editor?.isActive('strike')}
        onApply={(e) => e.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        label="高亮"
        active={!!editor?.isActive('highlight')}
        onApply={(e) => e.chain().focus().toggleHighlight().run()}
      >
        <Highlighter className="h-[18px] w-[18px]" />
      </ToolbarButton>

      <Divider />

      {/* 列表与待办 */}
      <ToolbarButton
        editor={editor}
        label="无序列表"
        active={!!editor?.isActive('bulletList')}
        onApply={(e) => e.chain().focus().toggleBulletList().run()}
      >
        <List className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        label="有序列表"
        active={!!editor?.isActive('orderedList')}
        onApply={(e) => e.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton
        editor={editor}
        label="待办清单"
        active={!!editor?.isActive('taskList')}
        onApply={(e) => e.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className="h-[18px] w-[18px]" />
      </ToolbarButton>

      <Divider />

      {/* 块级 */}
      <ToolbarButton
        editor={editor}
        label="引用"
        active={!!editor?.isActive('blockquote')}
        onApply={(e) => e.chain().focus().toggleBlockquote().run()}
      >
        <TextQuote className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton editor={editor} label="分隔线" onApply={(e) => e.chain().focus().setHorizontalRule().run()}>
        <Minus className="h-[18px] w-[18px]" />
      </ToolbarButton>

      <Divider />

      {/* 历史 */}
      <ToolbarButton editor={editor} label="撤销" disabled={!canUndo} onApply={(e) => e.chain().focus().undo().run()}>
        <Undo2 className="h-[18px] w-[18px]" />
      </ToolbarButton>
      <ToolbarButton editor={editor} label="重做" disabled={!canRedo} onApply={(e) => e.chain().focus().redo().run()}>
        <Redo2 className="h-[18px] w-[18px]" />
      </ToolbarButton>
    </div>
  )
}

/** 工具栏分组分隔线 */
function Divider() {
  return <span className="mx-1.5 h-5 w-px shrink-0 bg-rose-100" aria-hidden />
}
