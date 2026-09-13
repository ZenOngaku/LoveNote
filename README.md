# 💞 LoveNote · 情侣共享记事本

一款简约温柔的**手机移动端优先**情侣共享记事本 Web 应用。

一对情侣通过 6 位数字邀请码完成配对后，拥有一个**实时同步**的共享笔记空间；同时每人还拥有**完全私密**的私人笔记。数据存储、登录认证、实时同步全部由 **Supabase** 提供，数据安全完全依赖 **RLS 行级安全策略**，无任何平台私有绑定代码，下载到本地即可运行。

## ✨ 功能特性

| 模块 | 说明 |
| --- | --- |
| 👤 账号系统 | 邮箱密码注册 / 登录 / 退出（Supabase Auth），登录态持久保存 |
| 🔐 路由守卫 | 未登录访问任何受保护页面自动跳转登录页 |
| 💑 情侣配对 | 生成 6 位数字邀请码（24 小时有效）→ 对方输入即完成绑定 |
| 🚫 单一配对 | 一个用户只能绑定一位情侣，重复绑定有明确错误提示 |
| 💔 解除配对 | 二次确认后解绑；共享空间关闭，共享笔记保留在创建者账号下 |
| 💞 共享笔记 | 绑定双方共同查看 / 新增 / 编辑 / 删除，**Realtime 实时同步** |
| 🔒 私人笔记 | 仅本人可见可写，另一半完全看不到 |
| 📍 足迹地图 | 可缩放矢量世界地图（默认聚焦并高亮中国），点城市即「点亮」足迹、打标签、记日志，情侣双方 Realtime 实时同步 |
| 📱 移动端优先 | 手机竖屏触控友好（44px+ 触控区、16px 输入字号防 iOS 缩放、安全区域适配），电脑端正常浏览 |
| 💬 反馈完善 | 加载骨架屏、成功 / 失败 Toast、错误中文提示、危险操作二次确认 |

## 🧱 技术栈

- **Next.js（App Router）+ TypeScript**：前端框架
- **Tailwind CSS + shadcn/ui**：UI 与样式（浅粉 + 浅白温柔风）
- **Supabase**：
  - `Auth`：邮箱密码认证、会话持久化
  - `Postgres + RLS`：数据存储与行级安全隔离
  - `Realtime`：notes / couple_relation / users / footprints 表变更实时推送
  - `RPC（数据库函数）`：邀请码生成 / 兑换 / 解绑的原子操作

> 架构说明：业务逻辑全部在前端（浏览器直连 Supabase），**不依赖任何自建服务端接口**；数据库权限完全由 `supabase/schema.sql` 中的 RLS 策略管控，即使拿到 anon key 也无法越权读写他人数据。

## 📁 项目文件清单

```
├── supabase/
│   └── schema.sql                 # ⭐ Supabase 建表 + RLS + RPC + Realtime 脚本
├── src/
│   ├── app/                       # App Router 页面
│   │   ├── page.tsx               # 首页（情侣配对页：生成/输入邀请码）
│   │   ├── login/page.tsx         # 登录页
│   │   ├── register/page.tsx      # 注册页
│   │   ├── forgot-password/page.tsx # 忘记密码页
│   │   ├── reset-password/page.tsx  # 重置密码页（邮件落地）
│   │   ├── notes/page.tsx         # 笔记主页（共享/私人双 Tab）
│   │   ├── footprints/page.tsx    # 足迹页（矢量地图 + 城市日志面板）
│   │   ├── settings/page.tsx      # 个人设置页（资料/解绑/退出）
│   │   ├── layout.tsx             # 根布局（AuthProvider + Toaster）
│   │   └── globals.css            # 全局样式（浅粉主题变量）
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthGuard.tsx      # 路由守卫（AuthGuard / PublicOnly / 加载页）
│   │   │   ├── AuthShell.tsx      # 认证页统一外壳（壁纸 + Logo + 标语）
│   │   │   └── AuthForm.tsx       # 登录/注册共用表单
│   │   ├── layout/
│   │   │   ├── AppShell.tsx       # 页面外壳（顶栏 + 底部导航）
│   │   │   ├── BottomNav.tsx      # 底部导航栏
│   │   │   └── ConfigNotice.tsx   # Supabase 未配置提示条
│   │   ├── pair/
│   │   │   ├── PairPanel.tsx      # 配对面板（邀请码生成/输入/倒计时）
│   │   │   └── CoupleCard.tsx     # 已绑定情侣卡片（含解绑）
│   │   ├── footprint/
│   │   │   ├── FootprintMap.tsx   # 矢量地图（SVG 分层渲染 + 手势 + 城市点位）
│   │   │   ├── CitySheet.tsx      # 城市日志底部面板（时间线 + 新增/编辑）
│   │   │   ├── FootprintTimeline.tsx # 记录时间线（按到访日期正序）
│   │   │   ├── FootprintForm.tsx  # 记录表单（标题/日期/标签/正文）
│   │   │   ├── TagPicker.tsx      # 标签选择（预设 + 自定义多选）
│   │   │   └── DateField.tsx      # 日期输入（原生日期选择器 + 星期）
│   │   ├── notes/
│   │   │   ├── NoteTabs.tsx       # 共享/私人双 Tab 切换
│   │   │   ├── NoteList.tsx       # 笔记列表（骨架屏/空状态）
│   │   │   ├── NoteEditorFullScreen.tsx # 全屏编辑器（含长按操作菜单）
│   │   │   ├── RichNoteEditor.tsx # TipTap 富文本编辑器
│   │   │   ├── NoteActionSheet.tsx# 笔记长按操作菜单
│   │   │   └── ConfirmDialog.tsx  # 通用二次确认弹窗
│   │   └── ui/                    # shadcn/ui 基础组件（仅保留在用）
│   ├── hooks/
│   │   ├── useAuth.tsx            # 鉴权 Hook（会话持久化/资料/登录注册退出）
│   │   ├── useCouple.ts           # 情侣关系 Hook（配对/解绑 + Realtime）
│   │   ├── useNotes.ts            # 笔记 Hook（CRUD + Realtime 实时同步）
│   │   ├── useFootprints.ts       # 足迹 Hook（CRUD + 城市聚合 + Realtime）
│   │   ├── useMapData.ts          # 地图数据 Hook（首屏三件套 + 省界惰性加载）
│   │   └── useMapViewport.ts      # 地图手势 Hook（拖拽/双指缩放/轻点命中）
│   └── lib/
│       ├── supabase/client.ts     # ⭐ Supabase 客户端初始化（单例）
│       ├── types.ts               # 数据类型定义
│       ├── helpers.ts             # 工具函数（时间格式化/错误翻译/复制）
│       ├── footprints.ts          # 足迹纯函数（标签归一化/日期/排序/聚合/标签剔除）
│       └── map/                   # 地图基础库
│           ├── constants.ts       # 单位/bbox/缩放档位等编译期常量
│           ├── projection.ts      # Web Mercator 投影（与构建脚本同源）
│           ├── viewport.ts        # 视口数学（取景/夹紧/锚点缩放/命中）
│           ├── geodata.ts         # 地图数据加载（自身域名静态资源）
│           └── types.ts           # 地图类型定义
├── public/
│   ├── data/                      # ⭐ 足迹地图数据（构建产物，见 public/data/README.md）
│   │   ├── world.json             # 世界国界轮廓（~39KB）
│   │   ├── china.json             # 中国轮廓（含南海诸岛，~26KB）
│   │   ├── cities.json            # 中国 370 个地级市 + 198 个世界首都（~39KB）
│   │   ├── cities-world.json      # 其余约 2000 个世界城市（放大后惰性加载，~190KB）
│   │   ├── world-detail.json      # 中等精度世界国界（放大后替代粗轮廓，~584KB）
│   │   ├── tiles/detail-*.json    # 精细国界分块（16×16，深放大按视野加载，单块 ≤101KB）
│   │   └── provinces.json         # 34 个省级边界（放大后惰性加载，~87KB）
│   ├── bg-light.webp              # 认证页浅色壁纸
│   ├── bg-dark.webp               # 认证页深色壁纸
│   ├── logo.svg                   # Logo
│   └── robots.txt
├── scripts/
│   ├── build-geodata.mjs          # ⭐ 足迹地图数据生成（DataV + world-atlas → public/data）
│   ├── make-bg-light.mjs          # 浅色壁纸生成：墨迹印章 + 斜向点阵密排
│   └── make-bg-dark.mjs           # 深色壁纸生成：墨色重映射
├── .github/workflows/keep-alive.yml # Supabase 免费版保活定时任务
├── .env.local.example             # ⭐ 环境变量示例
└── README.md
```

## 🚀 部署流程总览

```
① 创建 Supabase 项目 → ② 执行 schema.sql → ③ 配置 .env.local → ④ 启动应用
```

---

## 第一步：创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com) 注册并登录
2. 点击 **New Project** 创建新项目（选择离你较近的区域，设置数据库密码）
3. 等待项目初始化完成（约 1-2 分钟）

## 第二步：执行数据库脚本（建表 + RLS + Realtime）

1. 打开 Supabase Dashboard → 左侧 **SQL Editor** → **New query**
2. 复制 `supabase/schema.sql` 的**全部内容**，粘贴进去 → 点击 **Run**
3. 执行成功后，可以在左侧 Table Editor 中看到四张表：
   - `users` 用户扩展表
   - `couple_relation` 情侣配对关系表
   - `notes` 笔记表
   - `footprints` 足迹表（v2.0 新增）
4. 确认 Realtime 已开启：Dashboard → **Database → Replication**，`notes` / `couple_relation` / `users` / `footprints` 应已加入 `supabase_realtime` publication（脚本已自动完成）

> 脚本**幂等**：每次升级后（例如 v1.1 的对 users 策略修复、v2.0 的 footprints 表）把最新 `schema.sql` 全文重跑一遍即可，不会重复建表或丢数据。

## 第三步：配置环境变量

1. 在项目根目录复制环境变量示例文件：

```bash
cp .env.local.example .env.local
```

2. 在 Supabase Dashboard → **Project Settings → API Keys** 中找到：
   - `Project URL` → 填入 `NEXT_PUBLIC_SUPABASE_URL`
   - `publishable`（匿名公钥，老版控制台叫 anon）→ 填入 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - ⚠️ 不要使用 `secret`（service_role）密钥，那是管理员密钥

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> `anon key` 是匿名公钥，可以安全暴露在前端 —— 数据安全由 RLS 策略保证。

## 第四步：本地启动

```bash
# 1. 安装依赖（npm / pnpm / bun 均可）
npm install

# 2. 启动开发服务器
npm run dev

# 3. 浏览器访问
# http://localhost:3000
```

验证流程：

1. 用户 A：注册 → 登录 → 首页「生成邀请码」
2. 用户 B：注册 → 登录 → 首页「输入邀请码」→ 输入 A 的邀请码 → 绑定成功 🎉
3. 双方进入「笔记」页 → Tab「情侣共享笔记」→ 一方新建/修改，另一方页面自动刷新
4. Tab「我的私人笔记」→ 各自独立，对方不可见

## ✅ 功能验收清单（对接真实 Supabase 后逐条勾选）

> 沙箱开发环境无法连接真实 Supabase，以下条目是**配置好你们自己的 Supabase 项目后**
> 用于最终验收的测试用例（双人两台设备 / 或同一浏览器两个隐身窗口）。

**A. 账号系统**

- [ ] A、B 分别注册两个账号（若开启邮箱验证，先去邮箱点确认链接）
- [ ] 刷新页面 / 关闭浏览器重开，登录态保持（会话持久化）
- [ ] 未登录直接访问 `/notes`、`/settings`，自动跳回 `/login`
- [ ] 已登录访问 `/login`，自动跳回首页
- [ ] 退出登录后回到登录页
- [ ] 登录页「忘记密码？」→ 输入邮箱 → 收到重置邮件 → 点击链接 → 设置新密码成功
- [ ] 重置后用旧密码登录被拒绝、新密码登录成功
- [ ] 重置链接二次使用 / 直接过期访问 `/reset-password`，显示「链接无效或已过期」

**B. 情侣配对**

- [ ] A 生成 6 位邀请码，界面显示 24 小时倒计时，可一键复制
- [ ] A 重复点「生成邀请码」，返回同一个码（不重复生成，24h 内有效）
- [ ] B 输入 A 的邀请码 → 绑定成功，双方首页都显示伴侣信息与「在一起天数」
- [ ] B 再次尝试生成/绑定，被拒绝（一人只能绑定一位）
- [ ] C（第三个账号）输入同一个码 → 提示无效（码已被使用）
- [ ] 绑定成功后双方页面通过 Realtime 自动感知（无需手动刷新）
- [ ] 解绑（二次确认）→ 双方回到未绑定状态，共享空间关闭

**C. 笔记功能**

- [ ] 共享笔记：A 新建 → B 端 Realtime 自动出现；B 编辑 → A 端自动更新
- [ ] 私人笔记：A 创建后，B 登录完全看不到
- [ ] 列表按最后修改时间倒序，卡片显示创建者标识
- [ ] 空标题/空内容保存被拦截；保存成功 / 失败均有 toast 反馈
- [ ] 删除有二次确认；删除后双方设备同步消失
- [ ] 断网时操作给出中文错误提示，恢复后可继续使用

**D. 安全（RLS 越权测试，可选进阶）**

在 Supabase SQL Editor 中以 anon 角色执行（或在另一账号前端观察）：

- [ ] 未登录调用 `select * from notes` → 返回空（anon 无任何读取权限）
- [ ] 未登录 `select invite_code from couple_relation` → 返回空（外人查不到邀请码）
- [ ] B 尝试 `update notes set ... where user_id = A` → 影响 0 行（无 UPDATE 权限）
- [ ] B 查询 A 的私人笔记 → 查不到

**D2. 足迹地图（v2.0）**

- [ ] 底部导航出现 4 个入口：首页 / 笔记 / 足迹 / 我的，320px 窄屏下不挤压
- [ ] 进入 `/footprints`：地图默认聚焦中国（中国轮廓高亮、完整落在屏幕内）
- [ ] 双指捏合可缩放、单指拖拽可平移（微信内置浏览器里也不带动整页滚动/缩放）
- [ ] 一直缩小可以把**整个世界**装进画面（不再只限于中国），并能拖动到其他国家
- [ ] 地图横向可以一直拖（跨过 180° 经线后从另一侧接回来，世界循环）
- [ ] 贴边城市的名字不会被裁断（自动翻到点位内侧）
- [ ] 放大到别的国家后能看到陆地与**国界线**（不再是一片空白），城市点位可正常记录（如「东京」）
- [ ] 持续放大时海岸线依然平滑（精细分块会按视野自动加载）
- [ ] 没有城市名的点明显更小更淡，不会与带名字的点混淆
- [ ] 密集区域点哪个小点就打开哪个城市（不会因为旁边有个已点亮城市而误选）
- [ ] 未点亮任何城市时，提示条显示在左上角图例下方、不重叠
- [ ] 点没有小圆点的空白区域不会弹出任何城市面板
- [ ] 国内城市面板标题下显示所属省份（如「浙江省」；直辖市不显示）
- [ ] 点右下角 `+` / `−` 可缩放，点「回到中国」回到默认取景
- [ ] 点任意城市 → 弹出该城市面板；写下标题/日期/标签/正文 → 保存后地图上该城市点亮
- [ ] 同一城市可继续添加多条记录，面板内**按到访日期正序**展示
- [ ] 编辑 / 删除记录：删除需二次确认
- [ ] 对方不刷新页面时：你新增/编辑/删除后，对方地图与面板**自动更新**（Realtime）
- [ ] 把某城市最后一条记录删掉 → 该城市变回未点亮
- [ ] 未绑定情侣时进入 `/footprints`：显示「绑定情侣后，一起点亮你们去过的地方」，点城市只弹提示

**E. 边界情况**

- [ ] 邀请码过期测试：SQL Editor 执行
      `update couple_relation set expires_at = now() - interval '1 hour';`
      后用该码绑定 → 提示「邀请码无效或已过期」
- [ ] 解绑后：双方各自保留自己创建的共享笔记（对方与新第三方均不可见）

## ⚙️ Supabase 控制台建议配置

| 配置项 | 位置 | 建议 |
| --- | --- | --- |
| 邮箱验证 | Authentication → Sign In / Providers → Email | 开发调试建议**关闭 Confirm email**（注册即可直接登录）；开启则注册后需去邮箱点击确认链接 |
| 邮箱速率 | Authentication → Rate Limits | 测试频繁收不到验证邮件时可将发送频率调高 |
| 站点地址 | Authentication → URL Configuration → Site URL | 设为你的站点根地址（本地开发默认 `http://localhost:3000` 即可，其子路径如 `/reset-password` 自动允许） |
| 重定向白名单 | Authentication → URL Configuration → Redirect URLs | **部署到线上后必须把生产域名加入**（如 `https://your-domain.com`），否则注册验证邮件 / 密码重置邮件的链接无法跳回你的站点 |

## ☁️ 部署上线（Vercel 免费）

本项目为「纯客户端 + Supabase BaaS」架构：前端无自建服务端逻辑（数据/认证/实时同步全部由 Supabase 提供），可直接免费部署到 **Vercel Hobby** 计划（无需信用卡）。

**部署前**：确认已执行「第二步」的 `supabase/schema.sql`、本机 `.env.local` 已配好，且本地 `npm run build` 能通过。

1. 把代码推送到 GitHub 仓库
2. 打开 [vercel.com](https://vercel.com)，用 GitHub 账号登录（首次需授权 Vercel 访问该仓库）
3. **Add New → Project** → Import 该仓库：Framework 自动识别 Next.js，构建命令保持默认 `next build` 即可
4. 在 **Environment Variables** 中添加两项（值同「第三步」，取自 Supabase → Project Settings → API Keys）：
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
   > `NEXT_PUBLIC_*` 在构建时内联，之后修改值需要**重新部署**才生效。
5. 点击 **Deploy**，等待构建完成（约 1-3 分钟），获得 `https://<项目名>.vercel.app`
6. 回到 Supabase → **Authentication → URL Configuration**：把线上域名加入 `Site URL` 与 `Redirect URLs`（否则邮箱确认 / 密码重置邮件的链接无法跳回站点），改完配置后建议再手动 Redeploy 一次

**线上验证**：打开 Vercel 域名 → 注册新账号 → 写一条共享笔记 → Supabase Table Editor 中 `notes` 表应出现新行；另一台设备登录同一账号应能实时看到笔记。

> **免费额度提醒**：Supabase 免费项目连续 7 天无 API 请求会被自动暂停。仓库内 `.github/workflows/keep-alive.yml` 每 2 天自动 ping 一次兜底，但需要先在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY` 两个 Secret 才会生效。

## 🗺 足迹地图数据与合规

「足迹」页用的是**内嵌矢量地图**：世界国界 + 中国省级边界 + 中国地级市与全球约 2200 个城市点位
（均带中文名；国外城市另有英文名与当地外文名，点开面板可见），地图横向支持世界循环，
在构建期预投影成 SVG path 后放进 `public/data/`（运行时从自己域名按需加载，
**不请求任何第三方地图服务**，因此在微信内置浏览器与国内网络下都稳定）。

- 数据来源、体积与重新生成方式见 [`public/data/README.md`](public/data/README.md)
- 重新生成：`node scripts/build-geodata.mjs`（改动数据源或简化参数时用；脚本自带体积与坐标自检）
- 坐标常量（中国 bbox、单位总量）在 `src/lib/map/constants.ts`，脚本末尾会打印最新 bbox 供校准
- ⚠️ **合规提示**：数据源为阿里 DataV 行政区划（含南海诸岛/九段线），仅供**个人记录用途**，
  不含审图号；若要作为公开产品发布，中国地图需使用标准地图并通过审图流程 ——
  届时代码零改动，只需替换 `public/data/*.json`

## 🎨 壁纸定制（浅色 / 深色）

认证四页（登录/注册/忘记密码/重置密码）的背景由 `src/components/auth/AuthShell.tsx` 统一控制：
`public/bg-light.webp` 米色底棕色线条 / `public/bg-dark.webp` 深可可底奶油色线条，
均为单图 `bg-cover` 呈现（无拼接无缝），图案按 45° 斜向点阵排列、土豆与爆米花棋盘交替均匀分布。

**深浅切换（已内置）**：每个认证页右上角有月亮/太阳切换按钮，
选择持久化在 localStorage（`lovenote-wallpaper-theme`），刷新/重开浏览器保持，多标签页同步；
卡片、输入框、文字的深浅配色集中在 `src/components/auth/WallpaperTheme.tsx` 维护。

**重新生成壁纸**（更换源图或调整图案大小/密度）：

```bash
# 浅色版：修改 scripts/make-bg-light.mjs 顶部 SRC（源图）与
#         SCALE_MIN/SCALE_MAX（图案大小）、LATTICE_D（点阵间距，越小越密）后运行
bun run scripts/make-bg-light.mjs
# 深色版：基于浅色版自动重上色（DARK_BG / INK 可改配色）
bun run scripts/make-bg-dark.mjs
```

## 🔐 数据安全设计说明（RLS）

| 表 | 策略要点 |
| --- | --- |
| `users` | 只能读写自己的资料；情侣双方可互相查看昵称 |
| `couple_relation` | 只有关系内双方可以读取；外人查不到邀请码与配对信息；不开放 UPDATE 策略 |
| `notes`（private） | 仅创建者本人可读写，情侣另一方与任何第三方都无法访问 |
| `notes`（shared） | 仅当前共享空间（已绑定的情侣双方）可读写；解绑后各自保留自己创建的笔记 |

邀请码相关操作（生成 / 兑换 / 解绑）通过 `security definer` 数据库函数原子完成，函数内部做严格校验（有效期、是否重复绑定、不能绑自己的码、并发加锁），这是 Supabase 官方推荐的正确做法，避免了在 RLS 上开「允许陌生人按邀请码查行」的越权口子。

## ❓ 常见问题

**Q: 注册后一直收不到验证邮件？**
A: 开发阶段可在 Authentication → Providers → Email 中关闭「Confirm email」。

**Q: 笔记修改后对方页面没有实时刷新？**
A: 检查 `supabase/schema.sql` 第七节是否执行成功（Database → Replication 中 `notes` 已开启 Realtime）；确认浏览器标签页处于前台。

**Q: 提示「网络异常，请检查网络连接与 Supabase 配置」？**
A: 检查 `.env.local` 是否已正确填写并以 `npm run dev` 重新启动。

**Q: 点了重置邮件里的链接，页面提示「链接无效或已过期」？**
A: 重置链接默认只有 1 小时有效期且只能使用一次；另外请确认链接打开的域名已在 Supabase → Authentication → URL Configuration 的 Redirect URLs 白名单里（本地 `http://localhost:3000` 默认允许，线上域名需手动添加）。

**Q: 可以放进微信 web-view 小程序壳吗？**
A: 可以。应用为纯响应式 H5，已适配安全区域与数字键盘（`inputMode="numeric"`）；将构建后的站点域名配置到 web-view 业务域名白名单即可。

**Q: 数据库表想清空重来？**
A: SQL Editor 中执行 `truncate table public.notes, public.couple_relation cascade;`（auth 用户可在 Authentication 中删除）。
