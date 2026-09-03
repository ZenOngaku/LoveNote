/**
 * 认证页浅色壁纸 v4 —— 墨迹掩码印章 + 图案缩小加密重排（纯 JS 像素运算版）
 * --------------------------------------------------------------
 * 用户反馈：整图 cover 下图案太大，手机上观感突兀，要「图案小一点才自然」。
 *
 * 思路：把手绘土豆 / 爆米花图案的「线条墨迹」整只提取出来当印章，
 * 缩小后在纯净底色画布上密集随机散布 —— 图案变小、密度变高、风格不变。
 *
 * v7：用户反馈「密度再高些、图案再小些」→ 缩放降至 0.36~0.44，
 *     点阵间距 290 → 210（密度约 ×1.9），抖动同步收敛到 ±10px，
 *     斜向点阵与土豆/爆米花棋盘交替保持不变。
 *
 * v8：用户反馈「壁纸右侧存在较大空白」→ 根因是点阵锚定在原点，
 *     最大列号的点落进「MARGIN 边界 + 印章半宽」都容不下的死区，
 *     整列被拒（该列又恰是最大的土豆）→ 右缘空出约 200px。修复：
 *     点阵 span 居中到能容纳最大印章的区域内，四边对称；越界改为
 *     向内收拢而非整只拒绝。
 *
 * 踩坑记录（为什么核心管线全部手写）：
 *   · v2 裁矩形色块当印章 → 印章内底色与画布有 1~3 色阶差，留下矩形鬼影
 *   · v3 用 sharp 对 raw 像素做 blur/resize/composite → 掩码 alpha 在
 *     sharp 流水线里被吞掉（模糊后 max=255 的掩码，过一次 resize 后
 *     max≤126 甚至归零），图案淡到几乎看不见
 *   · v4 只有「PNG 解码」和「webp 编码」走 sharp，其余膨胀 / 模糊 /
 *     缩放（预乘空间面积平均）/ source-over 合成全部手写，数值可控可查
 *
 * 印章 alpha = 连通域墨迹 ∪ 4px 膨胀，再近似高斯模糊 → 边缘柔和无硬边；
 * 缩放在预乘空间做面积平均，边缘不晕深色圈；印章必须完整落在原图
 * 内部（距边 ≥40px）；画布四周留 60px 空白，cover 裁切不切出半只图案。
 *
 * 输出：public/bg-light.webp（1600x2648，前端继续 bg-cover bg-center 单图呈现）
 * 用法：bun run scripts/make-bg-light.mjs
 */
import sharp from 'sharp'
import { statSync } from 'node:fs'

const SRC = 'upload/pasted_image_1788407321581.png'
const OUT = 'public/bg-light.webp'
const BG = { r: 0xfd, g: 0xfb, b: 0xee } // 原图底色 #fdfbee

// 可复现的伪随机（mulberry32），调参重跑结果一致
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20240603)

// ---------- 1) 裁掉底部 200px 水印带 → 1600x2648 ----------
const { data, info } = await sharp(SRC)
  .extract({ left: 0, top: 0, width: 1600, height: 2648 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height

// ---------- 2) 线稿掩码：棕色线条 r-b 通道差约 99，米色底约 15 ----------
const total = W * H
const isLine = new Uint8Array(total)
for (let i = 0, p = 0; i < total; i++, p += 3) {
  if (data[p] - data[p + 2] > 30) isLine[i] = 1
}

// ---------- 3) 连通域标记（4 邻域 BFS） ----------
const comp = new Int32Array(total).fill(-1)
const stack = new Int32Array(total)
const comps = []
for (let start = 0; start < total; start++) {
  if (!isLine[start] || comp[start] !== -1) continue
  let sp = 0
  stack[sp++] = start
  comp[start] = comps.length
  let minX = W, maxX = 0, minY = H, maxY = 0
  while (sp > 0) {
    const idx = stack[--sp]
    const x = idx % W
    const y = (idx / W) | 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (x > 0 && isLine[idx - 1] && comp[idx - 1] === -1) { comp[idx - 1] = comps.length; stack[sp++] = idx - 1 }
    if (x < W - 1 && isLine[idx + 1] && comp[idx + 1] === -1) { comp[idx + 1] = comps.length; stack[sp++] = idx + 1 }
    if (y > 0 && isLine[idx - W] && comp[idx - W] === -1) { comp[idx - W] = comps.length; stack[sp++] = idx - W }
    if (y < H - 1 && isLine[idx + W] && comp[idx + W] === -1) { comp[idx + W] = comps.length; stack[sp++] = idx + W }
  }
  comps.push({ minX, maxX, minY, maxY })
}

// ---------- 4) 连通域级过滤：靠近原图边缘的笔画整只淘汰 ----------
const EDGE_SAFE = 40
const alive = comps.map((c) => !(c.minX <= EDGE_SAFE || c.minY <= EDGE_SAFE || c.maxX >= W - EDGE_SAFE || c.maxY >= H - EDGE_SAFE))

// ---------- 5) 聚合成「印章」：小外扩(8px)相交合并 ----------
// PAD 只需盖住线条旁的晕圈余量；取太大（如16px+）会把相邻图案
// 连锁合并成混合簇（土豆+爆米花连体），导致后续形状分类失真。
// 土豆内部的斑点/短须与轮廓盒天然相交，无需额外的包容合并。
const PAD = 8
const parent = comps.map((_, i) => i)
function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
function union(a, b) { parent[find(a)] = find(b) }
const boxes = comps.map((c, i) => alive[i] ? {
  minX: c.minX - PAD, maxX: c.maxX + PAD, minY: c.minY - PAD, maxY: c.maxY + PAD,
} : { minX: 1, maxX: 0, minY: 1, maxY: 0 }) // 死域给空盒，永不参与合并
for (let i = 0; i < boxes.length; i++) {
  if (!alive[i]) continue
  for (let j = i + 1; j < boxes.length; j++) {
    if (!alive[j]) continue
    const a = boxes[i], b = boxes[j]
    if (a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY) union(i, j)
  }
}
const clustersMap = new Map()
comps.forEach((c, i) => {
  if (!alive[i]) return
  const root = find(i)
  if (!clustersMap.has(root)) clustersMap.set(root, { minX: W, maxX: 0, minY: H, maxY: 0, ids: [] })
  const g = clustersMap.get(root)
  g.ids.push(i)
  const b = boxes[i]
  if (b.minX < g.minX) g.minX = b.minX
  if (b.maxX > g.maxX) g.maxX = b.maxX
  if (b.minY < g.minY) g.minY = b.minY
  if (b.maxY > g.maxY) g.maxY = b.maxY
})
// 过滤碎片：包容合并后仍孤立的细小笔画（爆米花旁散落的风纹小钩等）
// 单独印章会像污点，直接丢弃；主体图案（土豆/爆米花）最小短边 ≥55px
const stamps = [...clustersMap.values()].filter((g) => {
  const bw = g.maxX - g.minX
  const bh = g.maxY - g.minY
  return Math.min(bw, bh) >= 55 && Math.max(bw, bh) >= 95
})
console.log(`连通域 ${comps.length} 个（边缘淘汰 ${alive.filter((a) => !a).length}）→ 印章 ${stamps.length} 只`)

// ---------- 6) 印章制作（纯 JS）：墨迹掩码 + 膨胀 + 高斯模糊 ----------
const EXTRA = 14
const stampImages = stamps.map((g) => {
  const x0 = Math.max(0, g.minX - EXTRA)
  const y0 = Math.max(0, g.minY - EXTRA)
  const x1 = Math.min(W - 1, g.maxX + EXTRA)
  const y1 = Math.min(H - 1, g.maxY + EXTRA)
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const rgb = Buffer.alloc(w * h * 3)
  const mask = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y0 + y) * W + (x0 + x)
      const di = y * w + x
      rgb[di * 3] = data[si * 3]
      rgb[di * 3 + 1] = data[si * 3 + 1]
      rgb[di * 3 + 2] = data[si * 3 + 2]
      if (isLine[si]) mask[di] = 255
    }
  }
  // 膨胀 2px（水平 + 垂直两次一维最大值），盖住线条边缘的抗锯齿过渡
  let dil = mask
  for (let axis = 0; axis < 2; axis++) {
    const out = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0
        for (let d = -2; d <= 2; d++) {
          const sx = axis === 0 ? Math.min(w - 1, Math.max(0, x + d)) : x
          const sy = axis === 1 ? Math.min(h - 1, Math.max(0, y + d)) : y
          const sv = dil[sy * w + sx]
          if (sv > v) v = sv
        }
        out[y * w + x] = v
      }
    }
    dil = out
  }
  // 二项式模糊核 [1,4,6,4,1]/16 两轮（近似高斯），印章边缘柔和
  let soft = dil
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0
      for (let d = -2; d <= 2; d++) s += (soft[y * w + Math.min(w - 1, Math.max(0, x + d))]) * [1, 4, 6, 4, 1][d + 2]
      tmp[y * w + x] = s / 16
    }
    const out = new Float32Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0
      for (let d = -2; d <= 2; d++) s += (tmp[Math.min(h - 1, Math.max(0, y + d)) * w + x]) * [1, 4, 6, 4, 1][d + 2]
      out[y * w + x] = s / 16
    }
    soft = out
  }
  return { rgb, mask: soft, w, h }
})

// ---------- 7) 斜向点阵布局：45° 旋转菱形格 + 土豆/爆米花棋盘交替 ----------
const CANVAS_W = 1600
const CANVAS_H = 2648
const MARGIN = 60
const SCALE_MIN = 0.36
const SCALE_MAX = 0.44
const canvas = Buffer.alloc(CANVAS_W * CANVAS_H * 3)
for (let i = 0; i < CANVAS_W * CANVAS_H; i++) {
  canvas[i * 3] = BG.r
  canvas[i * 3 + 1] = BG.g
  canvas[i * 3 + 2] = BG.b
}

/**
 * 点阵生成：点 (i,j) 落在 (i+j, j-i)*STEP —— 即把正方形点阵旋转 45°，
 * 图案沿两个对角方向整齐排列（斜向纹理）；STEP = 邻间距 d/√2。
 * 土豆 / 爆米花按 (i+j) 奇偶棋盘交替：每只图案的四条对角线近邻
 * 都是另一种图案，两种题材数量与分布严格均匀。
 */
const LATTICE_D = 210 // 相邻点间距（画布像素）—— 越小越密（v7: 290→210）
const STEP = LATTICE_D / Math.SQRT2
const JITTER = 10 // 轻微抖动，打破机械感但保持斜向可读（随间距同步收敛）

// v8 点阵 span 居中：外侧列/行必须留出「最大印章半宽 + 抖动」的落位
// 余量，否则靠边列会系统性放不下印章 → 画布一侧出现空带。
// HALF_W/H 取「最大印章盒 × 最大缩放 ÷ 2 + 抖动」，下方有运行时日志校验；
// colCount 为奇数时首尾两列同为 k 偶 → 都是土豆列，左右推得一样远，对称。
const HALF_W_BOUND = 140
const HALF_H_BOUND = 95
const CX0 = MARGIN + HALF_W_BOUND
const CX1 = CANVAS_W - MARGIN - HALF_W_BOUND
const CY0 = MARGIN + HALF_H_BOUND
const CY1 = CANVAS_H - MARGIN - HALF_H_BOUND
const colCount = Math.floor((CX1 - CX0) / STEP) + 1
const rowCount = Math.floor((CY1 - CY0) / STEP) + 1
const xShift = (CX1 - CX0 - (colCount - 1) * STEP) / 2
const yShift = (CY1 - CY0 - (rowCount - 1) * STEP) / 2
const points = []
for (let k = 0; k < colCount; k++) {
  for (let m = 0; m < rowCount; m++) {
    if ((k + m) % 2 !== 0) continue // 菱形点阵只取同奇偶格点
    points.push({ x: CX0 + xShift + k * STEP, y: CY0 + yShift + m * STEP, type: k % 2 === 0 ? 'potato' : 'popcorn' })
  }
}
// 界限校验：最大印章在最大缩放下的半宽/半高不得超过上述 span 余量
const maxStampW = Math.max(...stampImages.map((s) => s.w))
const maxStampH = Math.max(...stampImages.map((s) => s.h))
console.log(
  `最大印章盒 ${maxStampW}x${maxStampH} → 半宽 ${Math.round((maxStampW * SCALE_MAX) / 2) + JITTER}（界限 ${HALF_W_BOUND}）/ 半高 ${Math.round((maxStampH * SCALE_MAX) / 2) + JITTER}（界限 ${HALF_H_BOUND}）`,
)
// 打散同类型内部取章顺序（不同点同类不重复同一只）
for (let i = points.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1))
  ;[points[i], points[j]] = [points[j], points[i]]
}

// 按形状细长程度分类印章：土豆=斜放细长椭圆，爆米花=近圆形云朵。
// 注意：土豆是斜放的，轴对齐包围盒接近方形，长宽比判别会失效；
// 这里用墨迹的二阶矩（协方差特征值比 sqrt(λ1/λ2)）度量主轴细长比，
// 对任意旋转角都稳定。
function elongation(st) {
  const { mask, w, h } = st
  let sw = 0, sx = 0, sy = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = mask[y * w + x]
      if (v <= 128) continue
      sw += v
      sx += v * x
      sy += v * y
    }
  }
  if (!sw) return 1
  const mx = sx / sw
  const my = sy / sw
  let xx = 0, yy = 0, xy = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = mask[y * w + x]
      if (v <= 128) continue
      const dx = x - mx
      const dy = y - my
      xx += v * dx * dx
      yy += v * dy * dy
      xy += v * dx * dy
    }
  }
  xx /= sw
  yy /= sw
  xy /= sw
  const tr = xx + yy
  const det = Math.sqrt(Math.max(0, (xx - yy) * (xx - yy) + 4 * xy * xy))
  const l1 = (tr + det) / 2
  const l2 = Math.max(1e-6, (tr - det) / 2)
  return Math.sqrt(l1 / l2)
}
const ratio = stampImages.map((st) => elongation(st))
console.log(`细长比分布: ${ratio.map((r) => r.toFixed(2)).join(', ')}`)
const potatoStamps = []
const popcornStamps = []
stampImages.forEach((st, idx) => {
  ;(ratio[idx] >= 1.3 ? potatoStamps : popcornStamps).push(st)
})
// 兜底：某一类为空时按细长比中位数二分，保证两边都有章可用
if (!potatoStamps.length || !popcornStamps.length) {
  potatoStamps.length = 0
  popcornStamps.length = 0
  const sorted = stampImages.map((st, idx) => ({ st, r: ratio[idx] })).sort((a, b) => b.r - a.r)
  const half = Math.ceil(sorted.length / 2)
  sorted.forEach((e, i) => (i < half ? potatoStamps : popcornStamps).push(e.st))
  console.log('警告：细长比阈值分类失衡，已按中位数二分兜底')
}
console.log(`印章分类：土豆 ${potatoStamps.length} 只，爆米花 ${popcornStamps.length} 只`)
let potatoCursor = Math.floor(rand() * potatoStamps.length)
let popcornCursor = Math.floor(rand() * popcornStamps.length)

const placed = []
function hits(x, y, w, h) {
  return placed.some((p) => x < p.x + p.w + 8 && p.x < x + w + 8 && y < p.y + p.h + 8 && p.y < y + h + 8)
}

/**
 * 印章缩放（预乘空间面积平均）+ 可选水平镜像 + source-over 写入画布。
 * 预乘后再平均：半透明边缘像素的颜色不会被透明区的底色「冲淡出深圈」。
 */
function stampAt(st, dx, dy, dw, dh, flop) {
  const acc = new Float64Array(dw * dh * 4) // R*A, G*A, B*A, A 的面积累积
  const cnt = new Float64Array(dw * dh) // 覆盖计数
  for (let sy = 0; sy < st.h; sy++) {
    const ty0 = Math.floor((sy * dh) / st.h)
    const ty1 = Math.max(ty0, Math.floor(((sy + 1) * dh) / st.h) - 1)
    for (let sx = 0; sx < st.w; sx++) {
      const sxx = flop ? st.w - 1 - sx : sx
      const a = st.mask[sy * st.w + sxx] / 255
      const si = (sy * st.w + sxx) * 3
      const ra = st.rgb[si] * a
      const ga = st.rgb[si + 1] * a
      const ba = st.rgb[si + 2] * a
      const tx0 = Math.floor((sx * dw) / st.w)
      const tx1 = Math.max(tx0, Math.floor(((sx + 1) * dw) / st.w) - 1)
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const ti = ty * dw + tx
          acc[ti * 4] += ra; acc[ti * 4 + 1] += ga; acc[ti * 4 + 2] += ba; acc[ti * 4 + 3] += a
          cnt[ti]++
        }
      }
    }
  }
  for (let ty = 0; ty < dh; ty++) {
    for (let tx = 0; tx < dw; tx++) {
      const ti = ty * dw + tx
      if (!cnt[ti]) continue
      const a = acc[ti * 4 + 3] / cnt[ti] // 平均 alpha
      if (a < 0.004) continue
      const ci = ((dy + ty) * CANVAS_W + (dx + tx)) * 3
      const inv = 1 / (a * cnt[ti])
      const sr = acc[ti * 4] * inv // 还原预乘 → 印章颜色
      const sg = acc[ti * 4 + 1] * inv
      const sb = acc[ti * 4 + 2] * inv
      canvas[ci] = Math.round(sr * a + canvas[ci] * (1 - a))
      canvas[ci + 1] = Math.round(sg * a + canvas[ci + 1] * (1 - a))
      canvas[ci + 2] = Math.round(sb * a + canvas[ci + 2] * (1 - a))
    }
  }
}

let placedCount = 0
let potatoCount = 0
let popcornCount = 0
for (const pt of points) {
  // 该点缩放后能容纳的半宽（保证印章完整落在留白边内）
  const pool = pt.type === 'potato' ? potatoStamps : popcornStamps
  const cursorRef = pt.type === 'potato' ? () => (potatoCursor = (potatoCursor + 1 + Math.floor(rand() * 2)) % pool.length) : () => (popcornCursor = (popcornCursor + 1 + Math.floor(rand() * 2)) % pool.length)
  const startCursor = pt.type === 'potato' ? potatoCursor : popcornCursor

  let done = false
  for (let tryN = 0; tryN < pool.length && !done; tryN++) {
    const idx = (startCursor + tryN) % pool.length
    const st = pool[idx]
    // 缩放从大到小降档尝试：优先大图案，碰撞/越界则缩小，仍不行换一只
    for (const scale of [SCALE_MAX, (SCALE_MAX + SCALE_MIN) / 2, SCALE_MIN]) {
      const dw = Math.max(1, Math.round(st.w * scale))
      const dh = Math.max(1, Math.round(st.h * scale))
      // 越界时向画布内收拢（而非整只拒绝）：span 居中后最多收拢几十 px，
      // 不影响斜向观感，却能保证边缘列不会被系统性清空
      const x = Math.min(CANVAS_W - MARGIN - dw, Math.max(MARGIN, Math.round(pt.x + (rand() - 0.5) * JITTER * 2 - dw / 2)))
      const y = Math.min(CANVAS_H - MARGIN - dh, Math.max(MARGIN, Math.round(pt.y + (rand() - 0.5) * JITTER * 2 - dh / 2)))
      if (hits(x, y, dw, dh)) continue
      stampAt(st, x, y, dw, dh, rand() < 0.5) // 水平镜像增加变奏（线条图案无方向性）
      placed.push({ x, y, w: dw, h: dh })
      cursorRef()
      done = true
      break
    }
  }
  if (done) {
    placedCount++
    if (pt.type === 'potato') potatoCount++
    else popcornCount++
  }
}
console.log(`画布 ${CANVAS_W}x${CANVAS_H} 点阵 ${points.length} 点，放置 ${placedCount} 只（土豆 ${potatoCount} / 爆米花 ${popcornCount}）`)

// ---------- 8) 输出 ----------
await sharp(canvas, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 3 } })
  .webp({ quality: 85 })
  .toFile(OUT)
const meta = await sharp(OUT).metadata()
console.log(`OK ${meta.width}x${meta.height} ${Math.round(statSync(OUT).size / 1024)}KB → ${OUT}`)
