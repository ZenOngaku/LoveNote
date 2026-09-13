'use client'

/**
 * ============================================================
 * CitySheet —— 城市日志面板（底部滑出，Apple 风格）
 * ============================================================
 * 一个城市只有一个面板：面板内按时间正序列出这座城市的全部记录，
 * 并提供「记录这次旅程」入口与每条记录的编辑 / 删除。
 * 面板自身不持有状态（当前模式由页面统一管理），避免城市切换时状态残留。
 */
import { Loader2, MapPin, Plus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { FootprintForm, type FootprintFormValue } from '@/components/footprint/FootprintForm'
import { FootprintTimeline } from '@/components/footprint/FootprintTimeline'
import { formatVisitCN } from '@/lib/footprints'
import type { CityPoint, Footprint, VisitedCity } from '@/lib/types'

/** 面板模式：list 时间线 / create 新增 / edit 编辑 */
export type CitySheetMode = 'list' | 'create' | 'edit'

interface CitySheetProps {
  /** 当前城市（null = 面板关闭） */
  city: CityPoint | null
  /** 该城市的记录（已按时间正序） */
  records: Footprint[]
  /** 该城市的聚合状态（未点亮为 null） */
  visited: VisitedCity | null
  mode: CitySheetMode
  /** 编辑中的记录（mode === 'edit' 时非空） */
  editing: Footprint | null
  currentUserId: string | null
  partnerName: string | null
  /** 是否已绑定情侣（未绑定时只能浏览，新增记录会提示去绑定） */
  isBound: boolean
  loading: boolean
  submitting: boolean
  onStartCreate: () => void
  onStartEdit: (record: Footprint) => void
  onCancelForm: () => void
  onCreate: (value: FootprintFormValue) => Promise<boolean>
  onUpdate: (id: string, value: FootprintFormValue) => Promise<boolean>
  onRequestDelete: (record: Footprint) => void
  onInvalid: () => void
  onClose: () => void
}

export function CitySheet({
  city,
  records,
  visited,
  mode,
  editing,
  currentUserId,
  partnerName,
  isBound,
  loading,
  submitting,
  onStartCreate,
  onStartEdit,
  onCancelForm,
  onCreate,
  onUpdate,
  onRequestDelete,
  onInvalid,
  onClose,
}: CitySheetProps) {
  const lit = records.length > 0

  return (
    <Sheet open={!!city} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[86vh] max-w-md overflow-y-auto rounded-t-3xl border-rose-100 bg-white px-4 pb-9 pt-2 [&>button]:hidden dark:border-white/10 dark:bg-[#2b1a13]"
      >
        {/* 顶部把手（可下滑关闭） */}
        <div className="mx-auto mt-1 h-1.5 w-10 shrink-0 rounded-full bg-stone-200 dark:bg-white/20" aria-hidden />

        <SheetHeader className="shrink-0 items-center pb-1 pt-3 text-center">
          <SheetTitle className="flex items-center justify-center gap-1.5 text-lg font-semibold text-stone-800 dark:text-rose-50">
            <MapPin className={`h-4 w-4 ${lit ? 'text-rose-500' : 'text-stone-300 dark:text-rose-200/40'}`} aria-hidden />
            {city?.n ?? ''}
          </SheetTitle>
          {/* 副标题：国外城市显示「国家 · 外文原文 · 英文名」，国内城市显示省份全名 */}
          {city && (city.w === 1 ? city.co || city.en || city.lo : city.pv) && (
            <p className="fp-city-intl text-center text-[11px] tracking-wide text-stone-400 dark:text-rose-200/40">
              {city.w === 1
                ? [city.co, city.lo, city.en].filter(Boolean).join(' · ')
                : city.pv}
            </p>
          )}
          <SheetDescription className="text-center text-xs">
            {loading
              ? '正在读取记录…'
              : lit
                ? `已点亮 · ${records.length} 条记录${visited ? ` · 首次 ${formatVisitCN(visited.firstVisit)}` : ''}`
                : '这座城市还没有你们的足迹'}
          </SheetDescription>
        </SheetHeader>

        <div className="pt-2">
          {mode === 'list' ? (
            <div className="space-y-3">
              <FootprintTimeline
                records={records}
                currentUserId={currentUserId}
                partnerName={partnerName}
                onEdit={onStartEdit}
                onDelete={onRequestDelete}
                loading={loading}
                emptyHint={
                  isBound
                    ? '写下你们在这座城市的故事：吃了什么、看了什么、想对 TA 说什么'
                    : '绑定情侣后，就能一起在这里留下足迹 💗'
                }
              />

              <Button
                onClick={onStartCreate}
                className="h-12 w-full rounded-full bg-rose-500 text-base hover:bg-rose-600"
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                记录这次旅程
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-xs text-stone-400 dark:text-rose-200/50">
                {mode === 'edit' ? '编辑这条记录' : `在「${city?.n ?? ''}」留下一段回忆`}
              </p>
              <FootprintForm
                key={editing?.id ?? 'create'}
                initial={editing}
                submitting={submitting}
                onInvalid={onInvalid}
                onCancel={onCancelForm}
                onSubmit={async (value) => {
                  if (mode === 'edit' && editing) return await onUpdate(editing.id, value)
                  return await onCreate(value)
                }}
              />
            </div>
          )}
        </div>

        {submitting && (
          <span className="sr-only" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            保存中
          </span>
        )}
      </SheetContent>
    </Sheet>
  )
}
