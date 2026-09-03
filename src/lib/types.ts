/**
 * ============================================================
 * 全局类型定义（与 supabase/schema.sql 中的表结构一一对应）
 * ============================================================
 */

/** 用户扩展信息（public.users 表，与 auth.users 一一对应） */
export interface Profile {
  id: string
  nickname: string | null
  created_at: string
}

/** 情侣关系状态：pending 待绑定 / active 已绑定 / dissolved 已解绑 */
export type CoupleStatus = 'pending' | 'active' | 'dissolved'

/** 情侣配对关系（public.couple_relation 表） */
export interface CoupleRelation {
  id: string
  /** 邀请码生成方 */
  user_a_id: string
  /** 邀请码使用方（绑定成功后写入） */
  user_b_id: string | null
  /** 6 位数字邀请码 */
  invite_code: string
  status: CoupleStatus
  /** 邀请码生成时间 */
  created_at: string
  /** 邀请码过期时间（24 小时后） */
  expires_at: string
  /** 绑定成功时间 */
  bound_at: string | null
  /** 解绑时间 */
  dissolved_at: string | null
  /** 发起解绑的一方 */
  dissolved_by: string | null
}

/** 笔记类型：shared 情侣共享 / private 私人 */
export type NoteType = 'shared' | 'private'

/** 笔记（public.notes 表） */
export interface Note {
  id: string
  /** 创建者用户 id */
  user_id: string
  /** 共享笔记所属的情侣空间 id（私人笔记为 null） */
  couple_id: string | null
  note_type: NoteType
  title: string
  content: string
  created_at: string
  updated_at: string
}

/** 新建/编辑笔记时的表单输入 */
export interface NoteInput {
  title: string
  content: string
}

/** 统一的异步操作结果（error 为中文提示，null 表示成功） */
export interface OpResult {
  error: string | null
}

/** 新建笔记结果：成功时携带创建后的完整笔记行（供立即进入全屏编辑） */
export interface NoteResult extends OpResult {
  note: Note | null
}
