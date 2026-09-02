# 💞 CoupleNote · 情侣共享记事本

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
| 📱 移动端优先 | 手机竖屏触控友好（44px+ 触控区、16px 输入字号防 iOS 缩放、安全区域适配），电脑端正常浏览 |
| 💬 反馈完善 | 加载骨架屏、成功 / 失败 Toast、错误中文提示、危险操作二次确认 |

## 🧱 技术栈

- **Next.js（App Router）+ TypeScript**：前端框架
- **Tailwind CSS + shadcn/ui**：UI 与样式（浅粉 + 浅白温柔风）
- **Supabase**：
  - `Auth`：邮箱密码认证、会话持久化
  - `Postgres + RLS`：数据存储与行级安全隔离
  - `Realtime`：notes / couple_relation 表变更实时推送
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
│   │   ├── notes/page.tsx         # 笔记主页（共享/私人双 Tab）
│   │   ├── settings/page.tsx      # 个人设置页（资料/解绑/退出）
│   │   ├── layout.tsx             # 根布局（AuthProvider + Toaster）
│   │   └── globals.css            # 全局样式（浅粉主题变量）
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthGuard.tsx      # 路由守卫（AuthGuard / PublicOnly / 加载页）
│   │   │   └── AuthForm.tsx       # 登录/注册共用表单
│   │   ├── layout/
│   │   │   ├── AppShell.tsx       # 页面外壳（顶栏 + 底部导航）
│   │   │   ├── BottomNav.tsx      # 底部导航栏
│   │   │   └── ConfigNotice.tsx   # Supabase 未配置提示条
│   │   ├── pair/
│   │   │   ├── PairPanel.tsx      # 配对面板（邀请码生成/输入/倒计时）
│   │   │   └── CoupleCard.tsx     # 已绑定情侣卡片（含解绑）
│   │   ├── notes/
│   │   │   ├── NoteTabs.tsx       # 共享/私人双 Tab 切换
│   │   │   ├── NoteList.tsx       # 笔记列表（骨架屏/空状态）
│   │   │   ├── NoteEditorModal.tsx# 新建/编辑笔记弹窗
│   │   │   └── ConfirmDialog.tsx  # 通用二次确认弹窗
│   │   └── ui/                    # shadcn/ui 基础组件
│   ├── hooks/
│   │   ├── useAuth.tsx            # 鉴权 Hook（会话持久化/资料/登录注册退出）
│   │   ├── useCouple.ts           # 情侣关系 Hook（配对/解绑 + Realtime）
│   │   └── useNotes.ts            # 笔记 Hook（CRUD + Realtime 实时同步）
│   └── lib/
│       ├── supabase/client.ts     # ⭐ Supabase 客户端初始化（单例）
│       ├── types.ts               # 数据类型定义
│       └── helpers.ts             # 工具函数（时间格式化/错误翻译/复制）
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
3. 执行成功后，可以在左侧 Table Editor 中看到三张表：
   - `users` 用户扩展表
   - `couple_relation` 情侣配对关系表
   - `notes` 笔记表
4. 确认 Realtime 已开启：Dashboard → **Database → Replication**，`notes` 与 `couple_relation` 应已加入 `supabase_realtime` publication（脚本已自动完成）

## 第三步：配置环境变量

1. 在项目根目录复制环境变量示例文件：

```bash
cp .env.local.example .env.local
```

2. 在 Supabase Dashboard → **Project Settings → API** 中找到：
   - `Project URL` → 填入 `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → 填入 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

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

## ⚙️ Supabase 控制台建议配置

| 配置项 | 位置 | 建议 |
| --- | --- | --- |
| 邮箱验证 | Authentication → Sign In / Providers → Email | 开发调试建议**关闭 Confirm email**（注册即可直接登录）；开启则注册后需去邮箱点击确认链接 |
| 邮箱速率 | Authentication → Rate Limits | 测试频繁收不到验证邮件时可将发送频率调高 |

## ☁️ 部署上线（可选）

项目为标准 Next.js 应用，可直接部署到 Vercel / Netlify / 自托管服务器：

1. 推送代码到 GitHub
2. Vercel 导入仓库，Framework Preset 选择 Next.js
3. 环境变量中添加 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 部署完成后，建议在 Supabase → Authentication → URL Configuration 中把站点域名加入 allowed origins

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

**Q: 可以放进微信 web-view 小程序壳吗？**
A: 可以。应用为纯响应式 H5，已适配安全区域与数字键盘（`inputMode="numeric"`）；将构建后的站点域名配置到 web-view 业务域名白名单即可。

**Q: 数据库表想清空重来？**
A: SQL Editor 中执行 `truncate table public.notes, public.couple_relation cascade;`（auth 用户可在 Authentication 中删除）。
