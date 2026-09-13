/**
 * 足迹地图 · 地理数据构建脚本（v2.0「足迹」）
 * --------------------------------------------------------------
 * 为什么要有这个脚本：App 的「足迹」页要在微信内置浏览器里稳定运行，
 * 不能依赖境外瓦片服务与第三方地图 key，因此采用「内嵌矢量地图」——
 * 世界国界 + 中国省级边界 + 全国地级市点位，全部预投影成 SVG path，
 * 运行时只做 translate/scale，零几何计算、零外部请求。
 *
 * 一次性把在线数据源抓下来、投影、简化、写进 public/data/（产物提交进仓库，
 * 运行时从自己域名按需加载）。数据源变更时重跑本脚本即可，前端代码零改动。
 *
 * 数据源：
 *   · 中国省界 / 南海诸岛：阿里 DataV GeoAtlas（areas_v3，含 100000_JD 九段线）
 *   · 全国地级市点位：DataV 各省 {adcode}_full.json 的 level:'city' feature，
 *     坐标直接取 properties.center（城市驻地经纬度），无需自算质心
 *   · 世界国界：world-atlas countries-110m（Natural Earth 110m，公有领域），
 *     由 topojson-client 转 GeoJSON
 *   · 全球城市点位：Natural Earth 10m populated places（公有领域，自带 NAME_ZH
 *     中文名）；中国/台湾的城市交给 DataV 数据，避免重复
 *
 * 投影：Web Mercator，归一化到 [0,1] 后乘 UNIT=8192（全图层共用同一坐标系，
 *       坐标保留 3 位小数 ≈ 实地球面 5 米精度）。
 * 简化：手写 Douglas-Peucker（容差按地图单位给，分层不同容差控制体积）。
 *
 * 输出（public/data/）：
 *   world.json         世界国界轮廓（首屏加载，纯装饰，不描边）
 *   china.json         中国轮廓（含南海诸岛，首屏加载，默认高亮）
 *   cities.json        中国地级市 + 世界首都点位（首屏加载）
 *   cities-world.json  其余世界城市（tier≥1 与省界一起惰性加载）
 *   world-detail.json  中等精度世界国界（tier≥1 惰性加载，替代 110m 粗轮廓）
 *   provinces.json     34 个省级边界（tier≥1 惰性加载，同时充当放大后的高精度轮廓层）
 *   tiles/detail-*.json 精细国界分块（8×8 网格，深放大时按视野加载，保证放大后依然平滑）
 *
 * 用法：node scripts/build-geodata.mjs
 * 合规提示：DataV 行政区划数据仅供个人记录用途展示；若作为公开产品发布，
 *          中国地图需使用标准地图并取得审图号（届时只换数据产物，代码不变）。
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { feature } from 'topojson-client'
import * as OpenCC from 'opencc-js'

/** 全图层共用的地图单位总量（世界经度 360° 对应 0..8192） */
const UNIT = 8192
/** 产物目录 */
const OUT_DIR = path.resolve('public/data')
/** DataV 行政区划数据端点 */
const DATAV = 'https://geo.datav.aliyun.com/areas_v3/bound'
/** 全球城市数据源：Natural Earth 10m populated places（含 NAME_ZH 中文名，公有领域） */
const NE_CITIES =
  'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_populated_places.geojson'
/**
 * 精细国界分块（vector-tile 思路）：世界切成 16 × 16 块，放大到哪块才加载哪块。
 * 分块让「细容差」与「小体积」可以兼得 —— 单文件方案在深放大时折线明显，
 * 想平滑就得几 MB，对移动端不可接受。
 */
const DETAIL_TILE_COLS = 16
const DETAIL_TILE_ROWS = 16
/** 精细数据源（Natural Earth 10m，公有领域） */
const NE_COUNTRIES_DETAIL =
  'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_admin_0_countries.geojson'
/** 分块精细层的简化容差（0.25 单位 ≈ 1.2 公里；深放大时 1 像素 ≈ 0.1~0.5 单位） */
const DETAIL_TILE_TOLERANCE = 0.25
/** 分块精细层丢弃的小岛尺寸（单位，1 单位 ≈ 4.9 公里） */
const DETAIL_TILE_MIN_SIZE = 0.8
/** 直辖市（省级即城市，children 是区而非市） */
const MUNICIPALITIES = new Set([110000, 120000, 310000, 500000])
/** 港澳台（同样按「省级即城市点位」处理，有市级数据时优先用市级） */
const SPECIAL_REGIONS = new Set([710000, 810000, 820000])
/** 体积预算（KB，超出即报错退出：守不住体积会拖慢移动端首屏） */
const SIZE_BUDGET_KB = {
  'world.json': 45,
  'china.json': 30,
  // 首屏城市 = 中国 370 个地级市 + 世界首都（含省份/国家/英文名/外文名/重要度）
  'cities.json': 65,
  // 其余世界城市：放大后才惰性加载（含中文名 / 国家 / 英文名 / 外文名 / 重要度）
  'cities-world.json': 270,
  // 中等精度世界国界（tier≥1 用；深放大由 tiles/ 接管）
  'world-detail.json': 600,
  'provinces.json': 110,
}

/**
 * 各图层「简化容差 + 坐标精度」——按该图层实际被看到的缩放档定：
 *   world  只在世界视角出现（缩放到中国时已淡出）→ 容差可以很大
 *   china  中国全域视角（约 0.4 倍缩放）→ 中容差
 *   provinces 放大到省/城市级才显示 → 容差最小、精度最高
 */
const LAYER_TUNING = {
  // 世界视角 1 像素 ≈ 20 地图单位 → 容差 8 单位仍不足半个像素
  world: { tolerance: 12, digits: 0 },
  // 中国全域视角（约 0.4 倍）1 像素 ≈ 2.5 单位
  china: { tolerance: 2.5, digits: 0 },
  // 省界层在 tier≥1 显示，1 像素 ≈ 1 单位；精度 0.1 单位 ≈ 490 米（亚像素）
  provinces: { tolerance: 1.0, digits: 1 },
  // 中等精度国界层（10m 源数据）：tier≥1 显示。此时 1 像素 ≈ 2 单位，
  // 容差 2 单位（≈10 公里）在屏幕上是 1 像素出头，看不出折线
  worldDetail: { tolerance: 2, digits: 1, minSize: 5 },
}

/* ------------------------------------------------------------------ 工具 */

/**
 * 体积优化：坐标小数位按图层精度给（省的每一字节都会拖慢移动端首屏）。
 * 参考换算——1 地图单位 ≈ 赤道 4.9 公里，故：
 *   0.1 单位 ≈ 490 米（世界/中国轮廓层足够）
 *   0.01 单位 ≈ 49 米（省界层足够，城市级视角 1 像素 ≈ 数百米）
 */
const roundTo = (n, digits) => {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/** 经纬度 → 地图单位（Web Mercator），digits 控制精度 */
function project(lng, lat, digits = 1) {
  const clampedLat = Math.max(-85.051129, Math.min(85.051129, lat))
  const rad = (clampedLat * Math.PI) / 180
  const x = (lng + 180) / 360
  const y = (1 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / Math.PI) / 2
  return [roundTo(x * UNIT, digits), roundTo(y * UNIT, digits)]
}

/** Douglas-Peucker 简化（输入输出均为地图单位坐标） */
function simplify(points, tolerance) {
  if (points.length <= 3) return points
  const sqTol = tolerance * tolerance
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1

  // 迭代式实现（避免深递归栈溢出）
  const stack = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()
    if (last <= first + 1) continue
    const [x1, y1] = points[first]
    const [x2, y2] = points[last]
    const dx = x2 - x1
    const dy = y2 - y1
    const norm = dx * dx + dy * dy
    let maxDist = -1
    let maxIndex = -1
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = points[i]
      let dist
      if (norm === 0) {
        dist = (px - x1) ** 2 + (py - y1) ** 2
      } else {
        let t = ((px - x1) * dx + (py - y1) * dy) / norm
        t = Math.max(0, Math.min(1, t))
        dist = (px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2
      }
      if (dist > maxDist) {
        maxDist = dist
        maxIndex = i
      }
    }
    if (maxDist > sqTol) {
      keep[maxIndex] = 1
      stack.push([first, maxIndex], [maxIndex, last])
    }
  }
  const out = []
  for (let i = 0; i < points.length; i += 1) if (keep[i]) out.push(points[i])
  return out
}

/** 环坐标 → SVG path 字符串（绝对坐标；顶点数与输出体积会被统计出来） */
function ringToPath(ring, tolerance, digits, stats, minSize = 0) {
  const projected = ring.map(([lng, lat]) => project(lng, lat, digits))
  stats.raw += projected.length
  const simplified = simplify(projected, tolerance)
  stats.kept += simplified.length
  if (simplified.length < 3) return null
  // 小岛过滤：尺寸小于 minSize（地图单位）的环在本项目的缩放档下不足一个像素，
  // 省下的字节相当可观（50m 国界数据里大量环是几公里级的小岛）
  if (minSize > 0) {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const [px, py] of simplified) {
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
    }
    if (Math.max(maxX - minX, maxY - minY) < minSize) return null
  }
  let d = `M${simplified[0][0]} ${simplified[0][1]}`
  for (let i = 1; i < simplified.length; i += 1) d += `L${simplified[i][0]} ${simplified[i][1]}`
  return `${d}Z`
}

/**
 * Sutherland–Hodgman 多边形裁剪（裁剪区是矩形，凸的，所以用这个最简单可靠）：
 * 把国界几何切进各个分块时用 —— 不裁剪的话一个跨多块的大国（如俄罗斯）会在
 * 每块里重复一份，分块体积会失控。
 */
function clipRing(points, clip) {
  const edges = [
    { inside: (p) => p[0] >= clip.minX, cut: (a, b) => [clip.minX, a[1] + ((b[1] - a[1]) * (clip.minX - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[0] <= clip.maxX, cut: (a, b) => [clip.maxX, a[1] + ((b[1] - a[1]) * (clip.maxX - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[1] >= clip.minY, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (clip.minY - a[1])) / (b[1] - a[1]), clip.minY] },
    { inside: (p) => p[1] <= clip.maxY, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (clip.maxY - a[1])) / (b[1] - a[1]), clip.maxY] },
  ]
  let out = points
  for (const edge of edges) {
    const input = out
    out = []
    for (let i = 0; i < input.length; i += 1) {
      const cur = input[i]
      const prev = input[(i + input.length - 1) % input.length]
      const curIn = edge.inside(cur)
      const prevIn = edge.inside(prev)
      if (curIn) {
        if (!prevIn) out.push(edge.cut(prev, cur))
        out.push(cur)
      } else if (prevIn) {
        out.push(edge.cut(prev, cur))
      }
    }
    if (out.length === 0) return []
  }
  return out
}

/** 地图单位坐标点列 → SVG path 字符串 */
function pointsToPath(points) {
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i += 1) d += `L${points[i][0]} ${points[i][1]}`
  return `${d}Z`
}

/** 点列的包围盒尺寸（小岛过滤用） */
function bboxSize(points) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [px, py] of points) {
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }
  return { w: maxX - minX, h: maxY - minY }
}

/** GeoJSON geometry → path 字符串数组（MultiPolygon / Polygon 通吃） */
function geometryToPaths(geometry, tolerance, digits, stats, minSize = 0) {
  if (!geometry) return []
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : []
  const paths = []
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const d = ringToPath(ring, tolerance, digits, stats, minSize)
      if (d) paths.push(d)
    }
  }
  return paths
}

/** 带重试的 JSON 抓取（数据源偶发抖动时脚本不至于中断） */
async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    if (attempt >= 3) throw new Error(`${url} 抓取失败：${err.message}`)
    await new Promise((r) => setTimeout(r, 600 * attempt))
    return fetchJson(url, attempt + 1)
  }
}

/**
 * 外文名清理：日/韩的城市官方名带行政后缀（東京都 / 福岡市 / 서울특별시），
 * 展示时去掉后缀更自然（東京 / 福岡 / 서울）。
 */
function trimLocaleSuffix(text) {
  let out = text
  if (/(특별시|직할시|광역시|특별자치시|시)$/.test(out)) {
    out = out.replace(/(특별시|직할시|광역시|특별자치시|시)$/, '')
  } else if (/市$/.test(out) && out.length > 2) {
    out = out.replace(/市$/, '')
  } else if (/(都|県|府)$/.test(out) && out.length > 2) {
    out = out.replace(/(都|県|府)$/, '')
  }
  return out.trim() || text
}

/** 繁体 → 简体（OpenCC 词典，只在构建期用；数据源的中文名简繁混用） */
const traditionalToSimplified = OpenCC.Converter({ from: 't', to: 'cn' })
function toSimplified(text) {
  return text ? traditionalToSimplified(text) : ''
}

/** 城市短名：去掉行政区划后缀与民族词（阿坝藏族羌族自治州 → 阿坝） */
const ETHNIC = /(维吾尔|柯尔克孜|哈萨克|塔吉克|蒙古|藏|回|羌|苗|侗|彝|白|傣|景颇|傈僳|哈尼|壮|朝鲜|土家|布依|瑶|仡佬|黎|畲|满|锡伯|裕固|纳西|拉祜|佤|德昂|阿昌|普米|怒|独龙|基诺|水|仫佬|毛南|京|高山|达斡尔|鄂温克|鄂伦春|赫哲|门巴|珞巴|保安|撒拉|东乡|土)族/g
function shortName(name) {
  return (name || '')
    .replace(/(特别行政区|自治州|自治县|自治旗|地区|林区|盟|市|县)$/, '')
    .replace(ETHNIC, '')
    .trim()
}

/** 两点经纬度差值（判断「哪个城市是省会」用，单位：度） */
function degDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/* -------------------------------------------------------------- 数据装配 */

/** 中国省级数据（含南海诸岛/九段线 feature） */
async function loadChina() {
  const geo = await fetchJson(`${DATAV}/100000_full.json`)
  const provinces = geo.features.filter((f) => f.properties.level === 'province')
  const lineFeatures = geo.features.filter((f) => f.properties.level !== 'province')
  console.log(`  省级 feature: ${provinces.length}，特殊 feature: ${lineFeatures.map((f) => f.properties.adcode).join(',') || '无'}`)
  return { provinces, lineFeatures }
}

/**
 * 全国地级市点位：
 * - 普通省份：取该省 {adcode}_full.json 中 level:'city' 的 feature（坐标为城市驻地）
 * - 直辖市 / 港澳台：优先用辖区数据，若没有市级 feature 则用省级中心点兜底
 * - 省会判定：与省级 properties.center 重合（<0.02°）者标记 cap=1
 */
async function loadCities(provinces, lineFeatures) {
  const cities = []
  for (const province of provinces) {
    const adcode = Number(province.properties.adcode)
    const provinceCenter = province.properties.center
    const isDirect = MUNICIPALITIES.has(adcode) || SPECIAL_REGIONS.has(adcode)
    let children = []
    try {
      const childGeo = await fetchJson(`${DATAV}/${adcode}_full.json`)
      children = childGeo.features.filter((f) => f.properties.level === 'city')
    } catch (err) {
      console.warn(`  ⚠️ ${province.properties.name} 市级数据获取失败，改用省级中心点：${err.message}`)
    }

    if (children.length > 0 && !isDirect) {
      for (const child of children) {
        const center = child.properties.center
        if (!center) continue
        const [x, y] = project(center[0], center[1], 1)
        cities.push({
          a: Number(child.properties.adcode),
          n: shortName(child.properties.name),
          x,
          y,
          p: adcode,
          cap: degDistance(center, provinceCenter) < 0.02 ? 1 : 0,
          // 省份全名（面板副标题用，如「浙江省」）；直辖市/港澳台不写（省会即省级，重复）
          pv: province.properties.name,
          // 重要度（越小越重要）：省会 0；其余按「下属区县数」估城市规模分档
          // —— 全景档按「重要度 + 密度上限」决定显示哪些点（见 FootprintMap 的 TIER0 规则）
          // childrenNum 是 DataV 给的下辖区县数量，是城市体量的合理代理（广州 11 / 深圳 9 / 珠海 3）
          r: (() => {
            const isCapital = degDistance(center, provinceCenter) < 0.02
            if (isCapital) return 0
            // 全国 363 个地级市的 childrenNum 分布：≥14 有 23 个、≥12 有 59 个、≥10 有 110 个…
            // 分档目标：全景档（rank ≤4）在中国视野里大约留 150 个点，既不空旷也不糊成一片
            const children = Number(child.properties.childrenNum) || 0
            if (children >= 14) return 2
            if (children >= 12) return 3
            if (children >= 10) return 4
            if (children >= 8) return 5
            return 7
          })(),
        })
      }
      continue
    }

    // 直辖市 / 港澳台 / 无市级数据：省级本身作为城市点位
    const center = provinceCenter ?? province.properties.centroid
    if (!center) continue
    const [x, y] = project(center[0], center[1], 1)
    const name = province.properties.name || ''
    cities.push({
      a: adcode,
      n: isDirect ? shortName(name) || name : shortName(name) || name,
      x,
      y,
      p: adcode,
      cap: 1,
    })
  }

  // 去重（同名 adcode 理论上不会重复，防数据源异常）+ 稳定排序
  const seen = new Set()
  const unique = cities.filter((c) => {
    if (seen.has(c.a)) return false
    seen.add(c.a)
    return true
  })
  unique.sort((a, b) => a.a - b.a)
  console.log(`  城市点位: ${unique.length}（其中省会/直辖/港澳台 ${unique.filter((c) => c.cap === 1).length}）`)

  // 南海诸岛等特殊 feature 不参与城市点位，仅作轮廓装饰（避免误点亮）
  if (lineFeatures.length > 0) console.log(`  轮廓装饰 feature: ${lineFeatures.length}（不生成城市点位）`)
  return unique
}

/**
 * 国家 → Natural Earth 本地语言名字段。
 * 只列「官方语言不是英语」的常见国家；未列出的（美/英/澳/加等英语国家）按需求
 * 只展示「中文名 + 英文名」，不额外给外文名。
 */
const COUNTRY_LOCALE_FIELD = {
  // 东亚 / 东南亚
  JP: 'NAME_JA', KR: 'NAME_KO', KP: 'NAME_KO', VN: 'NAME_VI', ID: 'NAME_ID',
  MY: 'NAME_ID', BN: 'NAME_ID', TH: null, PH: null, KH: null, LA: null, MM: null,
  // 欧洲
  FR: 'NAME_FR', BE: 'NAME_FR', MC: 'NAME_FR', LU: 'NAME_FR',
  DE: 'NAME_DE', AT: 'NAME_DE', LI: 'NAME_DE',
  ES: 'NAME_ES', IT: 'NAME_IT', PT: 'NAME_PT', BR: 'NAME_PT', AO: 'NAME_PT', MZ: 'NAME_PT',
  NL: 'NAME_NL', SR: 'NAME_NL', SE: 'NAME_SV', PL: 'NAME_PL', CZ: null, SK: null,
  HU: 'NAME_HU', GR: 'NAME_EL', CY: 'NAME_EL',
  RU: 'NAME_RU', BY: 'NAME_RU', KZ: 'NAME_RU', KG: 'NAME_RU', TJ: 'NAME_RU', UZ: 'NAME_RU',
  TM: 'NAME_RU', AZ: 'NAME_RU', UA: 'NAME_UK',
  TR: 'NAME_TR', RO: null, BG: null, HR: null, RS: null, SI: null, BA: null, AL: null,
  FI: null, NO: null, DK: null, IS: null, EE: null, LV: null, LT: null,
  // 南亚 / 中东 / 中亚
  IN: 'NAME_HI', PK: 'NAME_UR', BD: 'NAME_BN', LK: null, NP: null,
  IR: 'NAME_FA', AF: 'NAME_FA', IQ: 'NAME_AR', SA: 'NAME_AR', AE: 'NAME_AR',
  EG: 'NAME_AR', MA: 'NAME_AR', DZ: 'NAME_AR', TN: 'NAME_AR', LY: 'NAME_AR',
  JO: 'NAME_AR', LB: 'NAME_AR', SY: 'NAME_AR', KW: 'NAME_AR', QA: 'NAME_AR',
  BH: 'NAME_AR', OM: 'NAME_AR', YE: 'NAME_AR', SD: 'NAME_AR', IL: 'NAME_HE',
  // 拉美（西语 / 葡语）
  MX: 'NAME_ES', AR: 'NAME_ES', CL: 'NAME_ES', CO: 'NAME_ES', PE: 'NAME_ES',
  VE: 'NAME_ES', EC: 'NAME_ES', GT: 'NAME_ES', CU: 'NAME_ES', BO: 'NAME_ES',
  DO: 'NAME_ES', HN: 'NAME_ES', PY: 'NAME_ES', UY: 'NAME_ES', NI: 'NAME_ES',
  CR: 'NAME_ES', PA: 'NAME_ES', PR: 'NAME_ES',
}

/**
 * 全球城市点位（Natural Earth 10m populated places，自带 NAME_ZH 中文名）：
 * - 中国（CHN）与台湾（TWN）交给 DataV 数据，避免与国内 370 个地级市重复
 * - 排除科考站 / 历史遗迹这类非居住点
 * - 首都 / 世界城市 / 特大城市 / 规模较大（scalerank ≤ 8 或人口 ≥ 10 万）的保留
 * 返回 { capitals, others }：首都进首屏数据（缩小到世界视野时就能看到），
 * 其余城市单独成文件、放大后再惰性加载（首屏体积敏感）。
 */
async function loadWorldCities(countryNames) {
  const geo = await fetchJson(NE_CITIES)
  const capitals = []
  const others = []
  const seenIds = new Set()
  for (const f of geo.features) {
    const p = f.properties
    const country = String(p.ADM0_A3 ?? '').toUpperCase()
    if (country === 'CHN' || country === 'TWN') continue
    if (/Scientific|Historic/i.test(String(p.FEATURECLA ?? ''))) continue
    // 规模阈值：首都/世界城市/特大城市必留；其余按 NE 的重要性排序（scalerank）或人口取。
    // 全量 6800+ 个会让 cities-world.json 涨到 460KB，这里收到约 2000 个（~110KB）
    const keep =
      p.ADM0CAP === 1 ||
      p.WORLDCITY === 1 ||
      p.MEGACITY === 1 ||
      p.SCALERANK <= 6 ||
      p.POP_MAX >= 300000
    if (!keep) continue
    const id = Number(p.NE_ID)
    if (!Number.isFinite(id) || id <= 0 || id > 2147483647 || seenIds.has(id)) continue
    const lng = Number(p.LONGITUDE)
    const lat = Number(p.LATITUDE)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    seenIds.add(id)
    const [x, y] = project(lng, lat, 1)
    // 中文名统一转简体（数据源的 NAME_ZH 混了繁体，3% 左右）
    const name = toSimplified(String(p.NAME_ZH || '').trim()) || String(p.NAME_EN || p.NAME || '').trim() || `未命名(${id})`
    // 展示用英文名与当地外文名（英语国家没有外文名，或与英文名相同则不重复存）
    const english = String(p.NAME_EN || p.NAME || '').trim()
    const localeField = COUNTRY_LOCALE_FIELD[String(p.ISO_A2 || '').toUpperCase()] ?? COUNTRY_LOCALE_FIELD[String(p.ADM0_A3 || '').toUpperCase()]
    const rawLocal = localeField ? trimLocaleSuffix(String(p[localeField] || '').trim()) : ''
    const local = rawLocal && rawLocal.toLowerCase() !== english.toLowerCase() && rawLocal !== name ? rawLocal : ''
    const extra = {}
    if (english) extra.en = english
    if (local) extra.lo = local
    // 国家中文名（面板副标题用）与重要度（NE scalerank，越小越重要；地图分级显示用）
    const countryName = countryNames.get(country) || countryNames.get(String(p.ISO_A2 || '').toUpperCase())
    if (countryName) extra.co = countryName
    const rank = Number(p.SCALERANK)
    if (Number.isFinite(rank)) extra.r = rank
    if (p.ADM0CAP === 1) {
      // 首都进首屏数据：字段写全，便于和中国城市混在同一份文件里
      capitals.push({ a: id, n: name, x, y, p: 0, cap: 1, w: 1, ...extra })
    } else {
      // 其余世界城市单独成文件：p / w 由前端加载时推断，不占字节（体积敏感）
      others.push({ a: id, n: name, x, y, ...extra })
    }
  }
  capitals.sort((a, b) => a.a - b.a)
  others.sort((a, b) => a.a - b.a)
  console.log(`  世界城市: 首都 ${capitals.length} + 其他 ${others.length}`)
  return { capitals, others }
}

/**
 * 精细国界分块（vector-tile 思路）：
 * 把 10m 数据按 8×8 网格切开 —— 每个环先按分块矩形裁剪（跨块的几何被切开，
 * 不会在每块里重复一份），再按 0.4 单位（≈2 公里）容差简化。
 * 运行时放大到哪块就加载哪块：深放大时一屏通常只落在 1 块里，
 * 因此能用「很细的容差」而不用担心体积。
 */
async function loadDetailGeo() {
  const geo = await fetchJson(NE_COUNTRIES_DETAIL)
  console.log(`  精细国界源数据: ${geo.features.length} 个国家/地区`)
  return geo
}

/**
 * 国家代码 → 中文国名（取自同一份 Natural Earth 国家数据，避免再手写一张表）
 */
function buildCountryNames(geo) {
  const map = new Map()
  for (const f of geo.features) {
    const p = f.properties
    const name = toSimplified(String(p.NAME_ZH || p.NAME || '').trim())
    if (!name) continue
    for (const code of [p.ADM0_A3, p.ISO_A2, p.SOV_A3]) {
      const key = String(code || '').toUpperCase()
      if (key && key !== '-99' && !map.has(key)) map.set(key, name)
    }
  }
  return map
}

function buildDetailTiles(geo) {
  const tileW = UNIT / DETAIL_TILE_COLS
  const tileH = UNIT / DETAIL_TILE_ROWS
  const tiles = new Map()
  let rings = 0
  for (const f of geo.features) {
    const geometry = f.geometry
    if (!geometry) continue
    const polygons =
      geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
    for (const polygon of polygons) {
      for (const ring of polygon) {
        rings += 1
        const projected = ring.map(([lng, lat]) => project(lng, lat, 1))
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        for (const [px, py] of projected) {
          if (px < minX) minX = px
          if (px > maxX) maxX = px
          if (py < minY) minY = py
          if (py > maxY) maxY = py
        }
        const colFrom = Math.max(0, Math.min(DETAIL_TILE_COLS - 1, Math.floor(minX / tileW)))
        const colTo = Math.max(0, Math.min(DETAIL_TILE_COLS - 1, Math.floor(maxX / tileW)))
        const rowFrom = Math.max(0, Math.min(DETAIL_TILE_ROWS - 1, Math.floor(minY / tileH)))
        const rowTo = Math.max(0, Math.min(DETAIL_TILE_ROWS - 1, Math.floor(maxY / tileH)))
        for (let row = rowFrom; row <= rowTo; row += 1) {
          for (let col = colFrom; col <= colTo; col += 1) {
            const clipped = clipRing(projected, {
              minX: col * tileW,
              maxX: (col + 1) * tileW,
              minY: row * tileH,
              maxY: (row + 1) * tileH,
            })
            if (clipped.length < 3) continue
            const simplified = simplify(clipped, DETAIL_TILE_TOLERANCE)
            if (simplified.length < 3) continue
            const size = bboxSize(simplified)
            if (Math.max(size.w, size.h) < DETAIL_TILE_MIN_SIZE) continue
            const key = `${row}-${col}`
            const list = tiles.get(key) ?? []
            list.push(pointsToPath(simplified))
            tiles.set(key, list)
          }
        }
      }
    }
  }
  return { tiles, rings }
}

/** 世界国界：world-atlas TopoJSON → GeoJSON */
async function loadWorld() {
  const raw = await readFile(path.resolve('node_modules/world-atlas/countries-110m.json'), 'utf8')
  const topo = JSON.parse(raw)
  const geo = feature(topo, topo.objects.countries)
  console.log(`  世界国家/地区: ${geo.features.length}`)
  return geo
}

/* -------------------------------------------------------------- 自检与写盘 */

function assertOrExit(condition, message) {
  if (!condition) {
    console.error(`\n✖ 自检失败：${message}`)
    process.exit(1)
  }
}

async function writeJson(fileName, payload) {
  const filePath = path.join(OUT_DIR, fileName)
  const text = JSON.stringify(payload)
  await writeFile(filePath, text, 'utf8')
  const kb = Buffer.byteLength(text, 'utf8') / 1024
  const budget = SIZE_BUDGET_KB[fileName]
  console.log(`  → ${fileName.padEnd(18)} ${kb.toFixed(1).padStart(6)} KB${budget ? `（预算 ${budget} KB）` : ''}`)
  return kb
}

async function main() {
  console.log('足迹地图数据构建开始…')
  await mkdir(OUT_DIR, { recursive: true })

  // 1) 中国省级 / 轮廓
  console.log('· 抓取 DataV 中国省级数据')
  const { provinces, lineFeatures } = await loadChina()

  // 2) 世界国界（粗：缩小时用）+ 高精度国界（放大后用）
  console.log('· 读取 world-atlas 世界国界')
  const world = await loadWorld()
  console.log('· 抓取 Natural Earth 10m 精细国界')
  const detailGeo = await loadDetailGeo()

  // 3) 城市点位（中国 + 全球）
  console.log('· 抓取各省市级数据（34 次请求，请稍候）')
  const cities = await loadCities(provinces, lineFeatures)
  console.log('· 抓取全球城市数据（Natural Earth 10m）')
  const countryNames = buildCountryNames(detailGeo)
  const worldCities = await loadWorldCities(countryNames)

  // 4) 投影 + 简化 + 写盘
  console.log('· 投影与简化，写出产物')
  const allChina = [...provinces, ...lineFeatures]
  const emptyStats = () => ({ raw: 0, kept: 0 })
  const worldStats = emptyStats()
  const worldDetailStats = emptyStats()
  const chinaStats = emptyStats()
  const provinceStats = emptyStats()

  const worldPaths = world.features.flatMap((f) =>
    geometryToPaths(f.geometry, LAYER_TUNING.world.tolerance, LAYER_TUNING.world.digits, worldStats),
  )
  const worldDetailPaths = detailGeo.features.flatMap((f) =>
    geometryToPaths(
      f.geometry,
      LAYER_TUNING.worldDetail.tolerance,
      LAYER_TUNING.worldDetail.digits,
      worldDetailStats,
      LAYER_TUNING.worldDetail.minSize,
    ),
  )
  const chinaPaths = allChina.flatMap((f) =>
    geometryToPaths(f.geometry, LAYER_TUNING.china.tolerance, LAYER_TUNING.china.digits, chinaStats),
  )
  const provinceLayers = provinces.map((f) => ({
    a: Number(f.properties.adcode),
    n: shortName(f.properties.name) || f.properties.name,
    d: geometryToPaths(f.geometry, LAYER_TUNING.provinces.tolerance, LAYER_TUNING.provinces.digits, provinceStats),
  }))

  const sizes = {}
  sizes['world.json'] = await writeJson('world.json', { unit: UNIT, paths: worldPaths })
  sizes['world-detail.json'] = await writeJson('world-detail.json', { unit: UNIT, paths: worldDetailPaths })

  // 精细分块（深放大时按块加载）：写成 tiles/detail-<row>-<col>.json
  const { tiles: detailTiles, rings: detailRings } = buildDetailTiles(detailGeo)
  // 先清空分块目录：网格尺寸改过之后，旧网格的产物不能留在 public/ 里
  await rm(path.join(OUT_DIR, 'tiles'), { recursive: true, force: true })
  await mkdir(path.join(OUT_DIR, 'tiles'), { recursive: true })
  let tileTotal = 0
  let tileMax = 0
  for (const [key, paths] of detailTiles) {
    const text = JSON.stringify({ unit: UNIT, paths })
    await writeFile(path.join(OUT_DIR, 'tiles', `detail-${key}.json`), text, 'utf8')
    const kb = Buffer.byteLength(text, 'utf8') / 1024
    tileTotal += kb
    tileMax = Math.max(tileMax, kb)
  }
  console.log(`  → tiles/detail-*.json   ${detailTiles.size} 块 · 共 ${tileTotal.toFixed(0)} KB · 单块最大 ${tileMax.toFixed(0)} KB（源 ${detailRings} 个环）`)
  assertOrExit(tileMax <= 260, `单个分块体积过大：${tileMax.toFixed(0)}KB（预期 ≤260KB）`)
  sizes['china.json'] = await writeJson('china.json', { unit: UNIT, paths: chinaPaths })
  // 首屏城市：中国地级市 + 世界首都（各国首都先可见，其余城市放大后再加载）
  sizes['cities.json'] = await writeJson('cities.json', {
    unit: UNIT,
    cities: [...cities, ...worldCities.capitals],
  })
  sizes['cities-world.json'] = await writeJson('cities-world.json', {
    unit: UNIT,
    cities: worldCities.others,
  })
  sizes['provinces.json'] = await writeJson('provinces.json', { unit: UNIT, provinces: provinceLayers })

  for (const [name, s] of Object.entries({ world: worldStats, worldDetail: worldDetailStats, china: chinaStats, provinces: provinceStats })) {
    const ratio = s.raw > 0 ? ((1 - s.kept / s.raw) * 100).toFixed(1) : '0'
    console.log(`  · ${name.padEnd(10)} 顶点 ${s.raw} → ${s.kept}（简化掉 ${ratio}%）`)
  }

  // 5) 自检
  console.log('· 自检')
  assertOrExit(cities.length >= 330 && cities.length <= 420, `城市数量异常：${cities.length}（预期 330~420）`)
  assertOrExit(provinceLayers.length === 34, `省级数量异常：${provinceLayers.length}（预期 34）`)
  assertOrExit(worldPaths.length > 200, `世界轮廓路径异常：${worldPaths.length}`)
  for (const c of cities) {
    assertOrExit(/^[1-9][0-9]{5}$/.test(String(c.a)), `adcode 非法：${c.a}`)
    assertOrExit(Number.isFinite(c.x) && Number.isFinite(c.y), `坐标非法：${c.n}`)
    assertOrExit(c.x >= 0 && c.x <= UNIT && c.y >= 0 && c.y <= UNIT, `坐标越界：${c.n} (${c.x},${c.y})`)
    assertOrExit(c.n.length > 0 && !/族|自治/.test(c.n), `短名未清理干净：${c.n}`)
  }
  // 世界城市：数量、坐标、id 唯一性
  const worldAll = [...worldCities.capitals, ...worldCities.others]
  assertOrExit(worldCities.capitals.length >= 150 && worldCities.capitals.length <= 260, `世界首都数量异常：${worldCities.capitals.length}`)
  assertOrExit(worldAll.length >= 800, `世界城市数量异常：${worldAll.length}（预期 ≥800）`)
  const worldIds = new Set()
  for (const c of worldAll) {
    assertOrExit(Number.isInteger(c.a) && c.a > 0 && !worldIds.has(c.a), `世界城市 id 异常：${c.n} (${c.a})`)
    assertOrExit(Number.isFinite(c.x) && c.x >= 0 && c.x <= UNIT && Number.isFinite(c.y) && c.y >= 0 && c.y <= UNIT, `世界城市坐标越界：${c.n}`)
    worldIds.add(c.a)
  }
  const cnIds = new Set(cities.map((c) => c.a))
  for (const c of worldCities.capitals) {
    assertOrExit(!cnIds.has(c.a), `世界城市 id 与中国 adcode 冲突：${c.a}`)
  }
  for (const layer of provinceLayers) {
    assertOrExit(layer.d.length > 0, `省级边界为空：${layer.n}`)
  }
  for (const [name, kb] of Object.entries(sizes)) {
    assertOrExit(kb <= SIZE_BUDGET_KB[name], `${name} 体积 ${kb.toFixed(1)}KB 超出预算 ${SIZE_BUDGET_KB[name]}KB`)
  }

  // 6) bbox（供前端常量校准，可直接对照 src/lib/map/constants.ts）
  // 主体 bbox 只统计省界层（不含南海诸岛/九段线）——初始取景用它能得到饱满的中国视图
  const bboxOf = (paths) => {
    const nums = paths.join(' ').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < nums.length; i += 2) {
      minX = Math.min(minX, nums[i])
      maxX = Math.max(maxX, nums[i])
      minY = Math.min(minY, nums[i + 1])
      maxY = Math.max(maxY, nums[i + 1])
    }
    return { minX, maxX, minY, maxY }
  }
  const mainland = bboxOf(provinceLayers.flatMap((p) => p.d))
  const full = bboxOf(chinaPaths)
  console.log(`\n主体 bbox（省界层，初始取景用）：minX ${mainland.minX} maxX ${mainland.maxX} minY ${mainland.minY} maxY ${mainland.maxY}`)
  console.log(`全量 bbox（含南海诸岛）：minX ${full.minX} maxX ${full.maxX} minY ${full.minY} maxY ${full.maxY}`)
  const totalKb = Object.values(sizes).reduce((a, b) => a + b, 0)
  console.log(`✓ 构建完成，产物共 ${totalKb.toFixed(1)} KB（首屏仅需 world + china + cities）`)
}

main().catch((err) => {
  console.error('\n✖ 构建失败：', err)
  process.exit(1)
})
