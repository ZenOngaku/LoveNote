'use client'

/**
 * ============================================================
 * 足迹页 /footprints —— 情侣共享的城市足迹地图
 * ============================================================
 * 布局：满屏矢量地图（AppShell 的 bleed 模式）+ 城市日志底部面板 + 删除二次确认。
 * - 未绑定情侣：地图可浏览，点城市只弹提示（引导去首页配对）
 * - 已绑定但没有记录：顶部提示「点一个城市」
 * - 记录属于情侣空间，双方实时同步（useFootprints 的 Realtime 订阅）
 * - 未登录：AuthGuard 自动跳转登录页
 */
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmDialog } from '@/components/notes/ConfirmDialog'
import { CitySheet, type CitySheetMode } from '@/components/footprint/CitySheet'
import { FootprintMap } from '@/components/footprint/FootprintMap'
import type { FootprintFormValue } from '@/components/footprint/FootprintForm'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useFootprints } from '@/hooks/useFootprints'
import { useMapData } from '@/hooks/useMapData'
import type { CityPoint, Footprint } from '@/lib/types'

export default function FootprintsPage() {
  return (
    <AuthGuard>
      <FootprintsContent />
    </AuthGuard>
  )
}

function FootprintsContent() {
  const { user } = useAuth()
  const { relation, partner, isBound, loading: coupleLoading } = useCouple()
  // 足迹恒为情侣共享：未绑定时 coupleId 为 null，useFootprints 不加载（页面走引导态）
  const coupleId = isBound && relation ? relation.id : null

  const {
    footprints,
    byCity,
    visitedCities,
    loading: recordsLoading,
    ready,
    createFootprint,
    updateFootprint,
    removeFootprint,
  } = useFootprints(coupleId)
  const { bundle, loading: mapLoading, error: mapError, retry, ensureDetail, ensureDetailTiles, ensureWorldCities } = useMapData()

  // 城市面板状态（模式由页面统一持有，切换城市时不会残留上一次的表单）
  const [selectedCity, setSelectedCity] = useState<CityPoint | null>(null)
  const [sheetMode, setSheetMode] = useState<CitySheetMode>('list')
  const [editing, setEditing] = useState<Footprint | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Footprint | null>(null)
  // 空状态提示是否已被用户关掉：只作用于本次浏览（刷新页面后若仍是一座城市都没点亮，会再次提示）
  const [hintDismissed, setHintDismissed] = useState(false)

  const cityRecords = selectedCity ? (byCity.get(selectedCity.a) ?? []) : []
  const cityVisited = selectedCity ? (visitedCities.get(selectedCity.a) ?? null) : null

  /**
   * 点地图上的城市：未绑定情侣也允许打开面板（先看看这座城市、了解功能），
   * 只有在真的要点「记录这次旅程」时才提示去绑定。
   */
  const handleSelectCity = useCallback((city: CityPoint) => {
    setSelectedCity(city)
    setSheetMode('list')
    setEditing(null)
  }, [])

  /** 进入新增记录：未绑定时提示先绑定情侣 */
  const handleStartCreate = useCallback(() => {
    if (!isBound) {
      toast.error('绑定情侣后，才能一起点亮这座城市 💗')
      return
    }
    setSheetMode('create')
    setEditing(null)
  }, [isBound])

  const closeSheet = useCallback(() => {
    setSelectedCity(null)
    setSheetMode('list')
    setEditing(null)
  }, [])

  /** 新增记录（城市信息由选中的城市带入） */
  async function handleCreate(value: FootprintFormValue): Promise<boolean> {
    if (!selectedCity) return false
    setSubmitting(true)
    const { error } = await createFootprint({
      city_adcode: selectedCity.a,
      city_name: selectedCity.n,
      // 世界城市没有省级 adcode（w=1），存 null
      province_adcode: selectedCity.w === 1 ? null : selectedCity.p ?? null,
      title: value.title,
      tags: value.tags,
      visited_at: value.visited_at,
      content: value.content,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success(`已点亮「${selectedCity.n}」💗`)
    setSheetMode('list')
    setEditing(null)
    return true
  }

  /** 编辑记录（城市不变） */
  async function handleUpdate(id: string, value: FootprintFormValue): Promise<boolean> {
    if (!selectedCity) return false
    setSubmitting(true)
    const { error } = await updateFootprint(id, {
      city_adcode: selectedCity.a,
      city_name: selectedCity.n,
      province_adcode: selectedCity.w === 1 ? null : selectedCity.p ?? null,
      title: value.title,
      tags: value.tags,
      visited_at: value.visited_at,
      content: value.content,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('已保存修改')
    setSheetMode('list')
    setEditing(null)
    return true
  }

  /** 删除记录（ConfirmDialog 二次确认后调用；失败时保持弹窗） */
  async function handleConfirmDelete(): Promise<boolean> {
    if (!deleteTarget) return false
    const { error } = await removeFootprint(deleteTarget.id)
    if (error) {
      toast.error(error)
      return false
    }
    toast.success('已删除这条足迹')
    setDeleteTarget(null)
    return true
  }

  return (
    <AppShell title="足迹" bleed>
      {/* flex-1 + min-h-0：由 flex 布局给出确定高度，地图再用 absolute 填充它 */}
      <div className="relative min-h-0 flex-1">
        <FootprintMap
          bundle={bundle}
          loading={mapLoading}
          error={mapError}
          onRetry={retry}
          visited={visitedCities}
          selectedAdcode={selectedCity?.a ?? null}
          onSelectCity={handleSelectCity}
          onNeedDetail={ensureDetail}
          onNeedTiles={ensureDetailTiles}
          onNeedWorldCities={ensureWorldCities}
        />

        {/* 提示条（未绑定引导 / 空记录提示）：放在图例下方，避免与左上角图例重叠。
            注意要等 useCouple 查询出结果再决定显示哪一条 —— 否则会先闪一下「绑定情侣后…」
            再换成「点击一个城市…」，文字跳动很出戏。 */}
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center px-8">
          {coupleLoading ? null : !isBound ? (
            <Link
              href="/"
              className="pointer-events-auto rounded-full border border-rose-100 bg-white/90 px-4 py-2 text-[11px] text-rose-500 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#3a241a]/90 dark:text-rose-300"
            >
              绑定情侣后，一起点亮你们去过的地方 💗
            </Link>
          ) : ready && !recordsLoading && footprints.length === 0 && !hintDismissed ? (
            <div
              data-hint="footprint-empty"
              className="pointer-events-auto relative flex items-center rounded-full border border-rose-100 bg-white/90 py-2 pl-4 pr-9 text-[11px] text-stone-500 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#3a241a]/90 dark:text-rose-200/70"
            >
              点击一个城市，记录下你们的第一次足迹 👣
              <button
                type="button"
                onClick={() => setHintDismissed(true)}
                aria-label="关闭提示"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-400 dark:text-rose-200/50 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* 城市日志面板 */}
      <CitySheet
        city={selectedCity}
        records={cityRecords}
        visited={cityVisited}
        mode={sheetMode}
        editing={editing}
        currentUserId={user?.id ?? null}
        partnerName={partner?.nickname ?? null}
        loading={recordsLoading}
        submitting={submitting}
        onStartCreate={handleStartCreate}
        isBound={isBound}
        onStartEdit={(record) => {
          setSheetMode('edit')
          setEditing(record)
        }}
        onCancelForm={() => {
          setSheetMode('list')
          setEditing(null)
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onRequestDelete={setDeleteTarget}
        onInvalid={() => toast.error('标题或正文至少填一项，再保存吧')}
        onClose={closeSheet}
      />

      {/* 删除二次确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除这条足迹吗？"
        description="删除后无法恢复，对方也将看不到这条记录。"
        confirmText="确定删除"
        danger
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  )
}
