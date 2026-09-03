/**
 * 深色版壁纸生成 —— 墨色重映射（纸墨分离重上色）
 * --------------------------------------------------------------
 * 用户问题：「有没有什么好的办法将当前的浅色背景处理下，得到深色版？」
 *
 * 原理：浅色壁纸本质是「米色纸 + 棕色墨迹」的两色线稿（外加极淡的
 * 水彩晕圈）。每个像素离纸色的「墨量」可以用棕色墨的特征通道差
 * （r-b：纸 ≈ 15，墨 ≈ 99~135）精确度量：
 *
 *     alpha = clamp((r - b - 20) / (90 - 20), 0, 1)
 *
 * 再用「深可可夜色纸 + 奶油色墨」重新渲染：
 *
 *     输出 = 夜色 × (1 - alpha) + 奶油 × alpha
 *
 * 效果：线条变成奶油色手绘，晕圈自动变成柔和暖光，抗锯齿边缘平滑
 * 保留；无需 AI 重绘，图案形状/密度与浅色版完全一致。
 *
 * 输入：public/bg-light.webp（浅色版，底色 #fdfbee）
 * 输出：public/bg-dark.webp（1600x2648，切换时 AuthShell 换 URL 即可）
 * 用法：bun run scripts/make-bg-dark.mjs
 */
import sharp from 'sharp'
import { statSync } from 'node:fs'

const SRC = 'public/bg-light.webp'
const OUT = 'public/bg-dark.webp'

// 深色版配色：深可可夜色底 + 奶油色墨迹（与应用 rose 玫瑰主题同暖调）
const DARK_BG = { r: 0x2b, g: 0x1a, b: 0x13 } // #2b1a13 深可可棕
const INK = { r: 0xf6, g: 0xe7, b: 0xd4 } // #f6e7d4 奶油色

const { data, info } = await sharp(SRC)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height

const LO = 20 // r-b 低于此值视为纯纸（alpha 0）
const HI = 90 // r-b 高于此次值视为纯墨（alpha 1）

// ---------- 1) 墨量初判：r-b 通道差线性映射 ----------
const total = W * H
const A = new Float32Array(total)
for (let i = 0, p = 0; i < total; i++, p += 3) {
  const t = (data[p] - data[p + 2] - LO) / (HI - LO)
  A[i] = t <= 0 ? 0 : t >= 1 ? 1 : t
}

// ---------- 2) alpha 轻量高斯模糊 —— 抗毛边关键步骤 ----------
// 深底亮线对人眼的锯齿敏感度远高于浅底暗线（明暗辉度效应），8-bit
// 像素阶梯在深色版上会显成毛边。[1,4,6,4,1]/16 一维两趟（半径约 2px）
// 把阶梯抹成连续渐变；纯 JS 手写，避免 sharp raw 流水线吞 alpha 的坑。
const KERNEL = [1, 4, 6, 4, 1]
const tmpA = new Float32Array(total)
for (let y = 0; y < H; y++) {
  const row = y * W
  for (let x = 0; x < W; x++) {
    let s = 0
    for (let d = -2; d <= 2; d++) s += A[row + Math.min(W - 1, Math.max(0, x + d))] * KERNEL[d + 2]
    tmpA[row + x] = s / 16
  }
}
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let s = 0
    for (let d = -2; d <= 2; d++) s += tmpA[Math.min(H - 1, Math.max(0, y + d)) * W + x] * KERNEL[d + 2]
    A[y * W + x] = s / 16
  }
}

// ---------- 3) smoothstep S 曲线：端点归零/满、核心恢复实度 ----------
// 模糊会把细线核心 alpha 拉低显得发灰；S 曲线把 >0.9 的重新推满、
// <0.06 的压回纸色，同时保留边缘连续渐变 —— 线更实、边更顺。
for (let i = 0; i < total; i++) {
  const t = Math.min(1, Math.max(0, (A[i] - 0.06) / (0.94 - 0.06)))
  A[i] = t * t * (3 - 2 * t)
}

// ---------- 4) 深可可夜色纸 + 奶油色墨 重上色 ----------
for (let i = 0, p = 0; i < total; i++, p += 3) {
  const a = A[i]
  data[p] = Math.round(DARK_BG.r + (INK.r - DARK_BG.r) * a)
  data[p + 1] = Math.round(DARK_BG.g + (INK.g - DARK_BG.g) * a)
  data[p + 2] = Math.round(DARK_BG.b + (INK.b - DARK_BG.b) * a)
}

// quality 92 + smartSubsample：降低色度抽样在细亮线边缘的压缩毛刺
await sharp(data, { raw: { width: W, height: H, channels: 3 } })
  .webp({ quality: 92, smartSubsample: true })
  .toFile(OUT)
const meta = await sharp(OUT).metadata()
console.log(`OK ${meta.width}x${meta.height} ${Math.round(statSync(OUT).size / 1024)}KB → ${OUT}`)
