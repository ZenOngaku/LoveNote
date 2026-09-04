'use client'

/**
 * ============================================================
 * NoteTabs —— 笔记页顶部双 Tab 切换
 * ============================================================
 * 【情侣共享笔记】｜【我的私人笔记】
 * 胶囊分段控件样式，触控友好（高度 44px）
 */
import { Heart, Lock } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NoteType } from '@/lib/types'

interface NoteTabsProps {
  value: NoteType
  onChange: (value: NoteType) => void
}

export function NoteTabs({ value, onChange }: NoteTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as NoteType)}>
      <TabsList className="grid h-12 w-full grid-cols-2 rounded-full bg-rose-100/70 p-1 dark:bg-white/10">
        <TabsTrigger
          value="shared"
          className="h-10 rounded-full text-sm data-[state=active]:bg-white data-[state=active]:text-rose-500 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/15 dark:data-[state=active]:text-rose-300"
        >
          <Heart className="mr-1 h-4 w-4" />
          情侣共享笔记
        </TabsTrigger>
        <TabsTrigger
          value="private"
          className="h-10 rounded-full text-sm data-[state=active]:bg-white data-[state=active]:text-rose-500 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/15 dark:data-[state=active]:text-rose-300"
        >
          <Lock className="mr-1 h-4 w-4" />
          我的私人笔记
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
