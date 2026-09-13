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

/** 足迹记录（public.footprints 表）：情侣共享的城市打卡，一个城市可有多条 */
export interface Footprint {
  id: string
  /** 记录创建者用户 id */
  user_id: string
  /** 所属情侣空间 id（恒非空：足迹没有私人形态） */
  couple_id: string
  /** 城市行政区划代码（GB/T 2260，与 public/data/cities.json 同源） */
  city_adcode: number
  /** 城市名（冗余存储，地图数据更新后历史记录仍可读） */
  city_name: string
  /** 所属省级 adcode（可为 null） */
  province_adcode: number | null
  title: string
  /** 标签（预设 + 自定义，最多 8 个） */
  tags: string[]
  /** 记录日期 YYYY-MM-DD（数据库为 date 类型，无时区） */
  visited_at: string
  /** 正文 */
  content: string
  created_at: string
  updated_at: string
}

/** 新建 / 编辑足迹的表单输入（城市信息由地图选中项带入） */
export interface FootprintInput {
  city_adcode: number
  city_name: string
  province_adcode: number | null
  title: string
  tags: string[]
  visited_at: string
  content: string
}

/** 新建足迹结果：成功时携带创建后的完整行 */
export interface FootprintResult extends OpResult {
  footprint: Footprint | null
}

/** 地图城市点位（public/data/cities*.json 条目，字段名压缩以减小体积） */
export interface CityPoint {
  /** 城市 id：中国城市为 6 位 adcode，世界城市为 Natural Earth 的 NE_ID */
  a: number
  /** 城市短名（已去掉「市/地区/自治州」等后缀；世界城市为中文名） */
  n: string
  /** 预投影 x（地图单位，unit = 8192） */
  x: number
  /** 预投影 y */
  y: number
  /** 所属省级 adcode（世界城市为 0 / 缺省） */
  p?: number
  /** 是否首都 / 省会 / 直辖市（1 = 是，缺省视为否） */
  cap?: 0 | 1
  /** 是否中国以外的城市（1 = 世界城市，缺省视为中国城市） */
  w?: 0 | 1
  /** 英文名（世界城市才有，用于面板副标题） */
  en?: string
  /** 当地外文名（如 東京 / Москва / 서울；英语国家或与英文名相同则缺省） */
  lo?: string
  /** 所属省份全名（如「浙江省」；直辖市/港澳台与世界城市缺省） */
  pv?: string
  /** 所属国家中文名（世界城市才有，如「日本」） */
  co?: string
  /** 重要度（越小越重要：世界城市取 Natural Earth scalerank，国内城市省会是 0、其余 6） */
  r?: number
}

/** 某个城市的聚合点亮信息（由 footprints 本地派生，无需额外查询） */
export interface VisitedCity {
  adcode: number
  cityName: string
  /** 记录条数 */
  count: number
  /** 最早一次 YYYY-MM-DD */
  firstVisit: string
  /** 最近一次 YYYY-MM-DD */
  lastVisit: string
  /** 该城市所有记录标签的去重集合 */
  tags: string[]
}
