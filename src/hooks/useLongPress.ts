'use client'

/**
 * ============================================================
 * useLongPress —— 长按手势 Hook（移动端长按 / 桌面右键等价触发）
 * ============================================================
 * 交互设计（对齐 iOS 原生 App 习惯）：
 * - 按住 500ms 触发长按回调，同时轻微震动反馈（支持的设备）
 * - 手指移动超过 10px 视为滚动/拖拽意图，自动取消长按
 * - 长按触发后抑制随后的 click，避免关掉菜单又误进编辑页
 * - 桌面端右键（contextmenu）等价于长按，方便电脑上使用
 *
 * 返回一组事件处理器，直接展开到可点击元素上即可：
 *   const handlers = useLongPress(() => openMenu(), () => openDetail())
 *   <button {...handlers}>…</button>
 */
import { useCallback, useRef } from 'react'

/** 长按默认时长（ms），与 iOS 系统长按手感接近 */
const DEFAULT_DURATION = 500

/** 移动超过该距离（px）视为滚动意图，取消长按 */
const MOVE_THRESHOLD = 10

export function useLongPress(
  onLongPress: () => void,
  onTap: () => void,
  duration: number = DEFAULT_DURATION,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })

  /** 清除挂起的定时器 */
  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 鼠标只响应左键（右键走 contextmenu）
      if (e.pointerType === 'mouse' && e.button !== 0) return
      firedRef.current = false
      startPosRef.current = { x: e.clientX, y: e.clientY }
      clear()
      timerRef.current = setTimeout(() => {
        firedRef.current = true
        // 触觉反馈：支持的设备轻微震动一下
        navigator.vibrate?.(10)
        onLongPress()
      }, duration)
    },
    [clear, duration, onLongPress],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!timerRef.current) return
      const dx = Math.abs(e.clientX - startPosRef.current.x)
      const dy = Math.abs(e.clientY - startPosRef.current.y)
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) clear()
    },
    [clear],
  )

  /** 长按已触发时吞掉 click（防止菜单弹出后误触进入编辑页） */
  const onClick = useCallback(() => {
    if (!firedRef.current) onTap()
  }, [onTap])

  /** 桌面端右键 = 长按的等价操作 */
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      clear()
      firedRef.current = true
      onLongPress()
    },
    [clear, onLongPress],
  )

  return {
    onPointerDown,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onPointerMove,
    onClick,
    onContextMenu,
  }
}
