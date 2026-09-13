'use client'

/**
 * ============================================================
 * useMapViewport —— 足迹地图手势与视口 Hook
 * ============================================================
 * 能力：单指拖拽平移、双指捏合缩放（以两指中点为锚点）、轻点回调、+/− 与回到中国。
 *
 * 关键实现约定（决定移动端流畅度与微信兼容性）：
 * 1. 手势期间视口只写 ref 与 DOM transform（setAttribute），不触发 React 渲染；
 *    手势结束后才 commit 到 React 状态 —— 既避免每帧 re-render，也满足
 *    react-hooks/refs（渲染期不读 ref）。
 * 2. 事件源双路互斥：PointerEvent 主路径 + touch 事件回退（微信 XWeb 内核上
 *    部分版本多指事件不全），同一手势内先到者生效，直到手势结束。
 * 3. touchmove 用非 passive 监听并 preventDefault，配合 CSS 的 touch-action:none
 *    与 overscroll-behavior:contain，阻止整页跟着缩放 / 触发微信下拉刷新。
 * 4. 不做双击缩放：城市轻点是主交互，若为双击做延时判定会让每次点击都迟钝；
 *    缩放有「捏合 + 常驻 +/− 按钮」两条路径，覆盖所有机型。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { chinaFitView, clampView, panBy, tierOf, zoomAtScale } from '@/lib/map/viewport'
import type { MapView, Viewport } from '@/lib/map/types'

/** 位移小于该像素且时长足够短 → 视为轻点（否则算拖动） */
const TAP_MOVE_TOLERANCE = 8
/** 轻点最长持续时间（毫秒） */
const TAP_MAX_DURATION = 350

/**
 * 手势「会话」级状态：从第一根手指按下到最后一根手指抬起为一次会话。
 * 为什么需要它：捏合结束时会先抬起一根、再抬起另一根，若只按「当前基线」判断，
 * 最后那根手指会被当成一次新的轻点 —— 于是捏合会顺带打开手指下的城市。
 * 会话级记录「是否用过双指」「是否拖动过」，整段手势内一旦发生就不再判轻点。
 */
interface GestureSession {
  moved: boolean
  multi: boolean
}

interface GestureState {
  /** 手势起始时的视口（捏合以它为基准，避免误差累积） */
  baseView: MapView
  /** 手势起始屏幕点（轻点判定用） */
  startPoint: [number, number]
  /** 手势开始时间戳 */
  startAt: number
  /** 是否已判定为拖动 */
  moved: boolean
  /** 本次手势是否用过双指 */
  pinched: boolean
  /** 双指基准：起始距离与中点 */
  startDistance: number
  startMid: [number, number]
  /** 单指平移的上一帧位置 */
  lastPan: [number, number]
}

interface UseMapViewportOptions {
  /**
   * 轻点（未拖动、未捏合）时回调：容器内屏幕坐标 + 该次手势完成后的视口。
   * 视口由 hook 侧传入，调用方无需自己去读 ref（渲染期读 ref 会被 lint 拦下）。
   */
  onTap?: (x: number, y: number, view: MapView) => void
}

export function useMapViewport({ onTap }: UseMapViewportOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const groupRef = useRef<SVGGElement | null>(null)
  const viewRef = useRef<MapView | null>(null)
  const sizeRef = useRef<Viewport | null>(null)
  /** 活跃触点：id → 容器内坐标（pointer 用 pointerId，touch 用 identifier） */
  const pointersRef = useRef<Map<number, [number, number]>>(new Map())
  /** 事件源互斥标记 */
  const sourceRef = useRef<'pointer' | 'touch' | null>(null)
  const gestureRef = useRef<GestureState | null>(null)
  const sessionRef = useRef<GestureSession | null>(null)
  /** 用户是否已经自己操作过视口（拖动/缩放）；未操作前尺寸变化一律重新取景 */
  const interactedRef = useRef(false)

  const [view, setView] = useState<MapView | null>(null)
  const [size, setSize] = useState<Viewport | null>(null)
  /** 捏合中：地图组件据此隐藏标记层（标记在松手后按新缩放重算） */
  const [pinching, setPinching] = useState(false)

  /** 只写 DOM 与 ref（手势每帧调用，不触发渲染） */
  const paint = useCallback((next: MapView) => {
    viewRef.current = next
    const el = groupRef.current
    if (el) {
      el.setAttribute('transform', `translate(${next.tx} ${next.ty}) scale(${next.scale})`)
    }
  }, [])

  /** 写入并同步到 React 状态（手势结束 / 按钮操作 / 尺寸变化时调用） */
  const commit = useCallback(
    (next: MapView) => {
      paint(next)
      setView(next)
    },
    [paint],
  )

  /** 容器尺寸变化：更新尺寸、夹紧（或初始化）视口 */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => {
      const rect = container.getBoundingClientRect()
      const next: Viewport = { w: Math.round(rect.width), h: Math.round(rect.height) }
      if (next.w <= 0 || next.h <= 0) return
      sizeRef.current = next
      setSize(next)
      const current = viewRef.current
      // 用户还没操作过（或刚点过「回到中国」）：按新尺寸重新取景 ——
      // 首屏布局抖动、手机地址栏伸缩、横竖屏切换都能得到正确的中国视图；
      // 已经拖动/缩放过的，就只做夹紧，保留用户当前浏览位置。
      commit(current && interactedRef.current ? clampView(current, next) : chinaFitView(next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [commit])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    /** 取容器内相对坐标 */
    const localPoint = (clientX: number, clientY: number): [number, number] => {
      const rect = container.getBoundingClientRect()
      return [clientX - rect.left, clientY - rect.top]
    }

    /**
     * 手势是否从「地图表面」开始：
     * 容器里还叠着图例、缩放按钮、引导链接等浮层，点在它们上面不应触发地图手势，
     * 否则点「放大」会先被当成轻点命中附近城市（面板弹出来挡住按钮）。
     */
    const isMapSurface = (target: EventTarget | null): boolean =>
      target instanceof Element && target.closest('svg.fp-map') !== null

    /** 触点数量变化后重设手势基准（避免加入/离开手指时视口跳变） */
    const resetBaseline = () => {
      const current = viewRef.current
      const points = [...pointersRef.current.values()]
      if (!current || points.length === 0) {
        gestureRef.current = null
        return
      }
      // 会话状态：多指出现过就标记（整段手势内不会退回单指判定）
      if (!sessionRef.current) sessionRef.current = { moved: false, multi: false }
      if (points.length > 1) sessionRef.current.multi = true
      const [first] = points
      const gesture: GestureState = {
        baseView: current,
        startPoint: first,
        startAt: Date.now(),
        moved: false,
        pinched: points.length > 1,
        startDistance:
          points.length > 1 ? Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]) : 0,
        startMid:
          points.length > 1
            ? [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2]
            : first,
        lastPan: first,
      }
      gestureRef.current = gesture
      // 从双指变回单指时不必再判轻点
      if (points.length > 1) setPinching(true)
    }

    /** 根据当前触点推导视口 */
    const updateGesture = () => {
      const gesture = gestureRef.current
      const current = viewRef.current
      const viewport = sizeRef.current
      if (!gesture || !current || !viewport) return
      const points = [...pointersRef.current.values()]
      if (points.length === 0) return

      if (points.length === 1) {
        const [x, y] = points[0]
        const dx = x - gesture.lastPan[0]
        const dy = y - gesture.lastPan[1]
        gesture.lastPan = [x, y]
        if (Math.hypot(x - gesture.startPoint[0], y - gesture.startPoint[1]) > TAP_MOVE_TOLERANCE) {
          gesture.moved = true
        }
        if (dx !== 0 || dy !== 0) {
          interactedRef.current = true
          if (sessionRef.current) sessionRef.current.moved = true
          paint(panBy(current, dx, dy, viewport))
        }
        return
      }

      // 双指：以「手势起始视口 + 起始中点」为基准换算，避免误差累积
      const [a, b] = points
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1])
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      if (gesture.startDistance <= 0) {
        gesture.startDistance = distance
        gesture.startMid = mid
        gesture.baseView = current
        return
      }
      gesture.moved = true
      interactedRef.current = true
      if (sessionRef.current) sessionRef.current.moved = true
      const ratio = distance / gesture.startDistance
      const zoomed = zoomAtScale(
        gesture.baseView,
        gesture.baseView.scale * ratio,
        gesture.startMid[0],
        gesture.startMid[1],
        viewport,
      )
      paint(
        panBy(zoomed, mid[0] - gesture.startMid[0], mid[1] - gesture.startMid[1], viewport),
      )
    }

    /** 手势收尾：提交视口、判定轻点、复位状态 */
    const endGesture = () => {
      const gesture = gestureRef.current
      const session = sessionRef.current
      const current = viewRef.current
      gestureRef.current = null
      sessionRef.current = null
      sourceRef.current = null
      setPinching(false)
      if (!gesture || !current) return
      commit(current)
      // 轻点判定只看整段手势：期间出现过双指、或拖动过，就一律不算轻点
      const isTap =
        !gesture.moved &&
        !gesture.pinched &&
        !session?.multi &&
        !session?.moved &&
        Date.now() - gesture.startAt <= TAP_MAX_DURATION
      if (isTap) onTap?.(gesture.startPoint[0], gesture.startPoint[1], current)
    }

    /* ---------------- Pointer 主路径 ---------------- */

    const handlePointerDown = (event: PointerEvent) => {
      if (sourceRef.current === 'touch') return // touch 路径已接管本次手势
      if (!isMapSurface(event.target)) return // 点在浮层控件上：交给控件自己处理
      sourceRef.current = 'pointer'
      pointersRef.current.set(event.pointerId, localPoint(event.clientX, event.clientY))
      resetBaseline()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) return
      pointersRef.current.set(event.pointerId, localPoint(event.clientX, event.clientY))
      updateGesture()
    }

    const pointerUpHandler = (event: PointerEvent, cancelled: boolean) => {
      if (!pointersRef.current.has(event.pointerId)) return
      if (cancelled) gestureRef.current = null // 被系统打断（来电/手势冲突）：按取消处理，不判轻点
      pointersRef.current.delete(event.pointerId)
      if (pointersRef.current.size === 0) endGesture()
      else resetBaseline()
    }
    const handlePointerUp = (event: PointerEvent) => pointerUpHandler(event, false)
    const handlePointerCancel = (event: PointerEvent) => pointerUpHandler(event, true)

    /* ---------------- Touch 回退路径（微信 XWeb） ---------------- */

    const syncTouches = (event: TouchEvent) => {
      const next = new Map<number, [number, number]>()
      for (let i = 0; i < event.touches.length; i += 1) {
        const touch = event.touches[i]
        next.set(touch.identifier, localPoint(touch.clientX, touch.clientY))
      }
      pointersRef.current = next
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (sourceRef.current === 'pointer') return // pointer 路径已接管本次手势
      if (!isMapSurface(event.target)) return
      sourceRef.current = 'touch'
      syncTouches(event)
      resetBaseline()
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (sourceRef.current !== 'touch') return
      // 阻止整页滚动 / 微信下拉刷新（必须是非 passive 监听才会生效）
      event.preventDefault()
      syncTouches(event)
      updateGesture()
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (sourceRef.current !== 'touch') return
      syncTouches(event)
      if (pointersRef.current.size === 0) endGesture()
      else resetBaseline()
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerup', handlePointerUp)
    container.addEventListener('pointercancel', handlePointerCancel)
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)
    container.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerup', handlePointerUp)
      container.removeEventListener('pointercancel', handlePointerCancel)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [commit, onTap, paint])

  /** 以视口中心（或指定锚点）缩放，供 +/− 按钮使用 */
  const zoomBy = useCallback(
    (factor: number, anchor?: [number, number]) => {
      const current = viewRef.current
      const viewport = sizeRef.current
      if (!current || !viewport) return
      const [ax, ay] = anchor ?? [viewport.w / 2, viewport.h / 2]
      interactedRef.current = true
      commit(zoomAtScale(current, current.scale * factor, ax, ay, viewport))
    },
    [commit],
  )

  /** 回到默认取景（聚焦中国） */
  const resetToChina = useCallback(() => {
    const viewport = sizeRef.current
    if (!viewport) return
    // 回到默认取景后重新视为「未操作」，之后尺寸变化继续自动取景
    interactedRef.current = false
    commit(chinaFitView(viewport))
  }, [commit])

  /** 当前缩放档位（tier 0/1/2，由提交后的状态派生） */
  const tier = view && size ? tierOf(view, size) : 0

  return { containerRef, groupRef, view, size, tier, pinching, zoomBy, resetToChina, paint, commit }
}
