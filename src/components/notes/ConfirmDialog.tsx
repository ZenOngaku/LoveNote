'use client'

/**
 * ============================================================
 * ConfirmDialog —— 通用二次确认弹窗（基于 shadcn AlertDialog）
 * ============================================================
 * 用于：删除笔记、解除情侣配对等不可逆操作
 */
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 弹窗标题 */
  title: string
  /** 说明文字 */
  description: string
  /** 确认按钮文字，默认「确认」 */
  confirmText?: string
  /** 取消按钮文字，默认「取消」 */
  cancelText?: string
  /** 是否为危险操作（红色按钮） */
  danger?: boolean
  /**
   * 点击确认后执行：
   * - 返回 false 表示操作失败，弹窗保持打开（错误提示由调用方负责）
   * - 返回 true / undefined 表示成功，弹窗自动关闭
   */
  onConfirm: () => boolean | void | Promise<boolean | void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    try {
      setSubmitting(true)
      const result = await onConfirm()
      // 返回 false 视为失败，保持弹窗打开
      if (result !== false) onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[88%] rounded-3xl sm:max-w-sm">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={submitting} className="rounded-full">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting}
            onClick={(e) => {
              // 阻止默认关闭行为，统一由 handleConfirm 完成后关闭
              e.preventDefault()
              handleConfirm()
            }}
            className={`rounded-full ${
              danger
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-rose-500 text-white hover:bg-rose-600'
            }`}
          >
            {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
