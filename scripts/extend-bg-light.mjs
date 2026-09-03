/**
 * 认证页浅色背景生成（最终版：边缘清障 + 整图 cover 呈现，零拼接零重复）
 * --------------------------------------------------------------
 * 背景 URL 为单张整图 + CSS bg-cover bg-center：
 *   · cover 数学上保证任意视口都铺满，不存在接缝
 *   · 一屏内图案零重复（平铺/镜像扩展都会让非四方连续的源图暴露拼接感：
 *     直接平铺有错位硬缝；镜像扩展会把边缘裁断的图案补全成心形；
 *     源图每个图案还带 30~80px 的水彩晕圈，擦线留晕会出「幽灵图案」）
 *   · 手机竖屏恰好以壁纸原始密度完整显示，桌面端显示中部横带，观感自然
 *
 * 图像处理：裁掉底部 200px「豆包AI生成」水印；再用连通域分析找出所有
 * 被图片边缘裁断的线条图案整只擦除（涂回底色），这样在极端宽高比下
 * 露出图像边缘时也不会看到「被切断的半只图案」。
 *
 * 用法：bun run scripts/extend-bg-light.mjs
 */
import sharp from 'sharp'
import { statSync } from 'node:fs'

const SRC = 'upload/pasted_image_1788407321581.png'
const OUT = 'public/bg-light.webp'
const BG = { r: 0xfd, g: 0xfb, b: 0xee } // 实测原图底色 #fdfbee

// 1) 裁掉底部 200px 水印带 → 1600x2648，取原始像素
const { data, info } = await sharp(SRC)
  .extract({ left: 0, top: 0, width: 1600, height: 2648 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height

// 2) 线稿掩码：棕色线条 r-b 通道差约 99，米色底约 15，取 30 为阈值
const total = W * H
const isLine = new Uint8Array(total)
for (let i = 0, p = 0; i < total; i++, p += 3) {
  if (data[p] - data[p + 2] > 30) isLine[i] = 1
}

// 3) 连通域标记（4 邻域 BFS）
const comp = new Int32Array(total).fill(-1)
const stack = new Int32Array(total)
const comps = []
for (let start = 0; start < total; start++) {
  if (!isLine[start] || comp[start] !== -1) continue
  let sp = 0
  stack[sp++] = start
  comp[start] = comps.length
  let minX = W, maxX = 0, minY = H, maxY = 0
  const pixels = []
  while (sp > 0) {
    const idx = stack[--sp]
    pixels.push(idx)
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
  comps.push({ minX, maxX, minY, maxY, pixels })
}

// 4) 标记待擦除：a) 触碰边缘的图案；b) 被其包围的内部小笔画（土豆身上的短须）
const remove = new Uint8Array(comps.length)
comps.forEach((c, i) => {
  if (c.minX <= 5 || c.minY <= 5 || c.maxX >= W - 6 || c.maxY >= H - 6) remove[i] = 1
})
comps.forEach((c, i) => {
  if (remove[i]) return
  for (let j = 0; j < comps.length; j++) {
    if (!remove[j]) continue
    const t = comps[j]
    // 只把「正常尺寸」的触边图案当容器，防止极端大连通域误删中央图案
    if (t.maxX - t.minX > 450 || t.maxY - t.minY > 450) continue
    if (
      c.minX >= t.minX - 18 && c.maxX <= t.maxX + 18 &&
      c.minY >= t.minY - 18 && c.maxY <= t.maxY + 18
    ) {
      remove[i] = 1
      break
    }
  }
})

// 5) 擦除：标记像素 + 膨胀 8px 盖住抗锯齿光晕与压缩振铃，涂回底色
const kill = new Uint8Array(total)
comps.forEach((c, i) => {
  if (remove[i]) for (const idx of c.pixels) kill[idx] = 1
})
for (let it = 0; it < 8; it++) {
  const snap = Uint8Array.from(kill)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      if (snap[idx]) continue
      if (
        (x > 0 && snap[idx - 1]) || (x < W - 1 && snap[idx + 1]) ||
        (y > 0 && snap[idx - W]) || (y < H - 1 && snap[idx + W])
      ) kill[idx] = 1
    }
  }
}
for (let idx = 0; idx < total; idx++) {
  if (kill[idx]) {
    const p = idx * 3
    data[p] = BG.r
    data[p + 1] = BG.g
    data[p + 2] = BG.b
  }
}
console.log(`连通域 ${comps.length} 个，擦除触边图案 ${remove.reduce((a, b) => a + b, 0)} 个（含包围笔画）`)

// 6) 输出整图 webp（前端 bg-cover bg-center 呈现）
await sharp(data, { raw: { width: W, height: H, channels: 3 } })
  .webp({ quality: 85 })
  .toFile(OUT)

const meta = await sharp(OUT).metadata()
console.log(`OK ${meta.width}x${meta.height} ${Math.round(statSync(OUT).size / 1024)}KB`)
