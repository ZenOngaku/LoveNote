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
 * 事件兼容：优先 PointerEvent（现代内核），同时保留 touch 事件回退
 * —— 微信内置浏览器（部分 XWeb 内核）对 PointerEvent 支持不一致，
 * 没有回退时长按手势会失效，落到系统/微信自带的长按菜单上。
 * 同一次手势只走一路事件（pointer 与 touch 互斥），不会重复触发。
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
  const startedRef = useRef<'pointer' | 'touch' | null>(null)
  const startPosRef = useRef({ x: 0, y: 0 })

  /** 清除挂起的定时器 */
  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  /** 结束一次手势（抬起/取消/离开时调用） */
  const endPress = useCallback(() => {
    clear()
    startedRef.current = null
  }, [clear])

  /** 启动一次按压计时 */
  const startPress = useCallback(
    (kind: 'pointer' | 'touch', x: number, y: number) => {
      firedRef.current = false
      startedRef.current = kind
      startPosRef.current = { x, y }
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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 鼠标只响应左键（右键走 contextmenu）
      if (e.pointerType === 'mouse' && e.button !== 0) return
      // 该手势已由 touch 路径接管时不重复启动
      if (startedRef.current) return
      startPress('pointer', e.clientX, e.clientY)
    },
    [startPress],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!timerRef.current || startedRef.current !== 'pointer') return
      const dx = Math.abs(e.clientX - startPosRef.current.x)
      const dy = Math.abs(e.clientY - startPosRef.current.y)
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) clear()
    },
    [clear],
  )

  /** touch 回退路径（微信等 PointerEvent 支持不全的内核） */
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // 该手势已由 pointer 路径接管时不重复启动
      if (startedRef.current) return
      const t = e.touches[0]
      if (t) startPress('touch', t.clientX, t.clientY)
    },
    [startPress],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!timerRef.current || startedRef.current !== 'touch') return
      const t = e.touches[0]
      if (!t) return
      const dx = Math.abs(t.clientX - startPosRef.current.x)
      const dy = Math.abs(t.clientY - startPosRef.current.y)
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
      startedRef.current = null
      onLongPress()
    },
    [clear, onLongPress],
  )

  return {
    onPointerDown,
    onPointerUp: endPress,
    onPointerLeave: endPress,
    onPointerCancel: endPress,
    onPointerMove,
    onTouchStart,
    onTouchMove,
    onTouchEnd: endPress,
    onTouchCancel: endPress,
    onClick,
    onContextMenu,
  }
}
