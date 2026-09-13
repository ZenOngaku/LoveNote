# LoveNote 项目 Worklog

---
Task ID: 1
Agent: Z.ai Code (主 Agent)
Task: 从零开发「情侣共享记事本 CoupleNote」—— Next.js App Router + Tailwind CSS，后端完全对接外部 Supabase（Auth / Postgres+RLS / Realtime），禁止使用平台内置数据库，代码标准可导出。

Work Log:
- 勘察现有项目结构（Next.js 16 App Router + Tailwind v4 + shadcn/ui 组件齐全），确认无既有冲突代码
- 安装依赖 @supabase/supabase-js@2.114.0
- 编写 lib 层：src/lib/supabase/client.ts（浏览器端单例客户端 + isSupabaseConfigured 检测）、src/lib/types.ts（Profile/CoupleRelation/Note 类型）、src/lib/helpers.ts（相对时间格式化/错误中文化/剪贴板兼容降级/邀请码校验）
- 编写 hooks：useAuth.tsx（AuthProvider 全局会话 + 资料 + 登录注册退出）、useCouple.ts（关系查询/生成邀请码/兑换/解绑 + couple_relation Realtime）、useNotes.ts（按类型 CRUD + notes 表 Realtime，纯查询函数与 setState 分离以符合 React 新 lint 规则）
- 编写基础组件：AuthGuard/PublicOnly/SplashScreen、AppShell（max-w-md 移动优先外壳）、BottomNav（三 Tab + iOS 安全区）、ConfigNotice（未配置 Supabase 友好提示）、ConfirmDialog（通用二次确认，失败保持打开）
- 编写业务组件：AuthForm（登录/注册共用，含邮箱验证提示页）、PairPanel（邀请码生成/大号展示/倒计时/复制/重新生成 + InputOTP 六格输入绑定）、CoupleCard（双头像 + 在一起天数 + 解绑确认）、NoteTabs、NoteList（骨架屏/空状态/创建者标识）、NoteEditorModal（key 重建表单，含删除入口）
- 编写页面：layout.tsx（AuthProvider + sonner Toaster + viewport 安全区）、globals.css（浅粉主题 token + 细滚动条）、page.tsx（首页配对）、login/register/notes/settings 五个路由
- 编写 supabase/schema.sql：users/couple_relation/notes 三表 + 部分唯一索引（一人一关系）+ updated_at 触发器 + current_couple_id 工具函数 + generate_invite_code/redeem_invite_code/unbind_couple 三个 security definer RPC（中文报错、并发加锁、防自绑/重复绑定）+ 完整 RLS 策略（私人笔记仅本人、共享笔记仅双方、关系表外人不可读、不开放 UPDATE）+ 注册建档触发器 + Realtime publication + 幂等可重复执行
- 编写 .env.local.example 与 README.md（部署流程/文件清单/安全设计/FAQ/微信 webview 说明）
- 修复 lint（react-hooks v6 新规则：set-state-in-effect / refs）：重构 useAuth/useNotes 为「纯查询 + 回调内 setState」范式、NoteEditorModal 改 key 重建、PairPanel 倒计时改派生渲染
- agent-browser 端到端自检（移动端 390x844 + 桌面 1280x800）：路由守卫跳转、登录页渲染、注册页、登录报错 toast、模拟会话后首页配对面板双 Tab、六格邀请码输入、笔记页双 Tab/空状态/新建弹窗/空保存校验、设置页、退出登录跳转、FAB 定位
- 发现并修复 settings/page.tsx 的 nickname 变量重复声明（tsc --noEmit 复核 src/ 零错误）

Stage Summary:
- 全部 22 个应用源码文件 + schema.sql + README + env 示例已交付，lint 通过、tsc src/ 零错误、dev server 编译正常
- 沙箱未配置真实 Supabase：预览中用「占位客户端 + 友好提示条 + 模拟会话」完成 UI 验证；真实数据流需用户按 README 配置自己的 Supabase 项目
- 安全设计核心：绑定/解绑走 security definer RPC 原子完成，RLS 无越权口子；解绑后共享笔记保留在创建者账号下

---
Task ID: 2
Agent: Z.ai Code (主 Agent)
Task: 回答「如何测试、怎么保证功能已完全实现」——对本项目做一轮独立复验（不信任 Task 1 的自述结论），并给出分层质量保证说明与真实联调验收清单。

Work Log:
- 复核 worklog + 关键源码：schema.sql（三表/RPC/RLS/Realtime）、supabase/client.ts（未配置时占位客户端）、useAuth.tsx（Context 会话 + onAuthStateChange）、types.ts、AuthGuard（登录守卫/PublicOnly）
- 独立静态验证：bun run lint 零错误；bunx tsc --noEmit 仅 examples//skills/ 平台示例报 4 错，src/ 零错误
- 确认 dev server 存活（:3000），dev.log 全部 200 无新错误（历史 nickname 重复声明 500 已在 Task 1 修复）
- agent-browser 移动端 390x844 端到端复验：未登录访问 / 自动 replace 到 /login ✅；登录页渲染完整 ✅；表单提交失败出中文 toast「网络异常，请检查网络连接与 Supabase 配置」且不崩溃 ✅
- 注入伪造 Supabase 会话（sb-placeholder-auth-token）后复验登录态 UI：首页配对面板（ConfigNotice 提示条 + 生成/输入邀请码双 Tab + 生成失败中文 toast + 六格输入 + 未满 6 位绑定按钮 disabled）✅
- 笔记页：共享/私人双 Tab 切换、未绑定空状态 + 去配对引导、FAB 新建弹窗、空保存校验、未绑定保存拦截「尚未绑定情侣，无法使用共享笔记」、填写保存失败后弹窗保持且内容不丢失、私人 Tab 网络失败优雅降级为空状态 ✅
- 设置页（昵称/邮箱/情侣空间状态/退出登录）✅；退出登录自动跳回 /login 闭环 ✅
- 桌面 1280x800：登录卡片居中、浅粉渐变正常；AppShell 为 min-h-screen + flex-1 + fixed 底部导航方案（无语义 footer，内容区 pb-28 防遮挡），符合布局规范
- 移动端笔记页截图目检通过；临时截图已清理；agent-browser 已关闭

Stage Summary:
- 本轮为「独立复验」：静态检查 + 浏览器端到端全部通过，未发现新缺陷
- 沙箱边界（诚实声明）：无法验证真实 Supabase 数据流（Auth 会话/RLS 越权/Realtime 推送/双账号配对），需用户配置凭据后按 README 验收清单执行；UI 全部可达路径与错误分支已实测
- 验证方法沉淀：注入 sb-<ref>-auth-token 伪造会话可在未配置 Supabase 时走通全部登录态 UI 路径

---
Task ID: 3
Agent: Z.ai Code (主 Agent)
Task: 补齐密码重置功能（忘记密码 → 邮件 → 设置新密码 全流程），并顺带修复 .env.local.example 缺失问题。

Work Log:
- 发现并修复交付缺口：README/ConfigNotice 引用的 .env.local.example 实际不存在（Task 1 遗漏），已补写完整模板（含安全说明：anon key 可公开、service_role 不可放前端）
- 新增 src/components/auth/AuthShell.tsx：认证页统一外壳（粉渐变 + Logo + 标语），AuthForm 重构复用（视觉零变化，移除内联重复布局与未使用的 Heart 导入）
- 扩展 useAuth.tsx：resetPassword(email)（resetPasswordForEmail + redirectTo=/reset-password）、updatePassword(pwd)（auth.updateUser），接口风格与既有 OpResult 一致，错误统一走 getErrorMessage 中文翻译
- 新增 /forgot-password 页：邮箱校验 → 发送重置邮件 → 切换「邮件已发送」提示视图（含重新发送入口 + 返回登录）
- 新增 /reset-password 三态页面：loading（邮件凭证自动校验中）→ 无会话显示「链接无效或已过期」（重新发送引导）→ 有会话显示新密码表单（双次确认，成功后 signOut 清临时会话并跳登录页）；刻意不用 PublicOnly 守卫避免邮件落地被重定向
- AuthForm 登录模式密码 Label 右侧加「忘记密码？」链接
- README：验收清单 A 组 +3 条密码重置用例；Supabase 配置表补 Site URL / Redirect URLs 两行（线上部署必配）；FAQ 新增重置链接失效排查
- 验证：bun run lint 零输出；tsc --noEmit src/ 零错误；agent-browser 实测：登录页出现忘记密码链接 ✅、/forgot-password 表单渲染与失败 toast（URL 未误切视图）✅、无会话直接访问 /reset-password 显示失效页 ✅、「重新发送」按钮跳回 forgot-password 闭环 ✅、dev.log 新页面全部 200 无报错 ✅

Stage Summary:
- 密码重置全流程代码完成：login → forgot-password →（邮箱）→ reset-password → 用新密码登录
- 新增文件：.env.local.example、src/components/auth/AuthShell.tsx、src/app/forgot-password/page.tsx、src/app/reset-password/page.tsx
- 修改文件：useAuth.tsx、AuthForm.tsx、README.md、worklog.md
- 沙箱边界：发送邮件与真实改密需用户配置 Supabase 后在验收清单 A 组逐条验证；页面三态与错误分支已全部实测

---
Task ID: 4
Agent: Z.ai Code (主 Agent)
Task: ① 回应 Supabase 免费版 pause 问题（含保活落地方案）② placeholder 改为 love@potato.com ③ 用户提供的土豆花纹图用作认证页背景（裁水印 + 无缝平铺扩展）。

Work Log:
- 图片处理（sharp）：原上传图 1600x2848、底色 #fdfdf1、右下角有「豆包AI生成」水印
  - 第一版：裁掉底部 200px 水印带 → 800 宽 webp tile（59KB）；浏览器实测桌面端发现 x≈1040 处竖直接缝错位（原图非精确四方连续）
  - 第二版（最终）：壁纸业标准镜像法——裁水印 + 600 宽基准 + flop/flip/双镜像拼成 2x2 大 tile（1200x1986，public/pattern.webp），接缝处互为镜像天然无缝
- AuthShell 背景：粉色渐变改为 pattern.webp 平铺 + bg-[length:780px_auto]（保持元素视觉密度）+ 底色 #fdfdf1 匹配；四个认证页（登录/注册/忘记密码/重置密码）统一生效
- placeholder：AuthForm + forgot-password 两处 you@example.com → love@potato.com
- 新增 .github/workflows/keep-alive.yml：GitHub Actions 每 2 天 ping Supabase REST API 防免费项目 7 天闲置暂停；README 无需凭据即可先行合入，用户配置 Secrets 后生效
- 验证：桌面 1280x800 与移动 390x844 截图目检——平铺无缝 ✅、无水印 ✅、表单可读性 ✅、placeholder 生效 ✅；镜像拼合意外产出心形土豆图案，契合情侣主题；lint 零错误
- 清理临时截图；浏览器已关闭

Stage Summary:
- 认证页视觉升级为用户自定义土豆花纹背景（裁水印 + 镜像无缝平铺），placeholder 统一为 love@potato.com
- 交付保活方案：日常使用即保活 + GitHub Actions 每 2 天自动 ping 兜底（.github/workflows/keep-alive.yml，用户配置 SUPABASE_URL / SUPABASE_ANON_KEY 两个 Secrets 即可）
- Supabase 平台建议：免费版 + 保活即可长期用（情侣日常使用天然保活）；付费 $25/月免 pause；彻底自主需自托管（VPS + PocketBase/自托管 Supabase，成本与运维上升，不建议当前阶段迁移）

---
Task ID: 5
Agent: Z.ai Code (主 Agent)
Task: ① 项目更名 CoupleNote → LoveNote（项目名 + 页面显示）② 重做认证页壁纸：放弃平铺拼接，改为按重复规律扩展 ③ 统一浅色版配色（用户深色壁纸生成中，先交付浅色统一版）。

Work Log:
- 更名：layout.tsx（title/description/applicationName）、首页 AppShell title、设置页页脚、AuthGuard SplashScreen、AuthShell h1、globals.css 注释、package.json name=lovenote、README.md 全文替换、schema.sql 注释、worklog 标题；rg 复核 src/ 零残留
- 壁纸迭代（scripts/extend-bg-light.mjs，可重复执行）：
  - v1 镜像扩展（2x2 tile 平铺，上版遗留）→ 千鸟格对称「心形土豆」+ 780px 重复单元，用户反馈仍然奇怪
  - v2 单图四周镜像扩展 600px → 边缘被裁断的图案被反射补全成对称缝合体，仍怪
  - v3 内容缩 85% 垫底色再镜像 → 无缝合体但留白环勾出内容矩形；实测底色应为 #fdfbee（非 #fdfdf1）
  - 40 倍对比度放大诊断：源图每个图案带 30~80px 水彩晕圈 + 全图色度噪点，任何重复规则必暴露（晕圈被擦线留影成「幽灵图案」）
  - 最终：放弃扩展，整图交付——裁水印 + 连通域分析擦除全部触边图案（56 个，含包围笔画，8px 膨胀盖抗锯齿/振铃）→ bg-light.webp（1600x2648, 115KB）+ CSS bg-cover bg-center；cover 数学保证任意视口满铺、零接缝、一屏零重复，手机竖屏恰为壁纸原始密度
- 删除旧 public/pattern.webp；AuthShell 改单图 cover + 底色 #fdfbee 兜底
- 浅色版统一（登录/注册/忘记密码/重置密码四页）：标题/标语/卡片标题改 rose-900、正文 rose-900/60、Label rose-900/70、图标 rose-300、输入框改白 70% 填充 + rose-200 边框 + rose-400 placeholder + rose 聚焦环、卡片改白 85% + backdrop-blur；SplashScreen 底色同步 #fdfbee
- 验证：bun run lint 零错误；tsc --noEmit src/ 零错误；agent-browser 实测移动 390x844（login/register/forgot-password 截图目检：壁纸无缝满铺、浅色统一、LoveNote 生效、placeholder love@potato.com）+ 桌面 1280x800（自然横带满铺）；登录提交错误 toast 正常；页面 errors/console 零报错；dev.log 全 200
- 临时截图已清理；浏览器已关闭

Stage Summary:
- 品牌全面更名 LoveNote；认证页壁纸零拼接零重复（整图 cover + 边缘清障方案），四认证页浅色版配色统一
- 深色版壁纸就绪后：同流程可产出 bg-dark.webp（脚本改 SRC/OUT 即可），AuthShell 换 URL 即可切换
- 上传目录中的深色小图（176x143）判定为深色版色样，本轮未使用；等用户完整深色壁纸素材

---
Task ID: 6
Agent: Z.ai Code (主 Agent)
Task: ① 接入用户提供的真实 Supabase（URL + sb_publishable_ 新式 key）② 壁纸图案缩小重排（手机上观感自然）③ 用算法把浅色壁纸处理成深色版。

Work Log:
- 写入 .env.local（NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...），重启 dev server；curl 对照实验确认 key 有效（错误 key → 401 Invalid API key；用户 key → PostgREST PGRST205，认证已通过）
- 发现用户已在 Supabase 执行 schema.sql：users/couple_relation/notes 三表全部存在（初始探针查错表名 profiles 走了弯路，前端实际用 users），RPC generate_invite_code 返回自定义中文错误「请先登录后再操作」，schema 完整就位
- 壁纸 v2（scripts/make-bg-light.mjs）：矩形裁块重贴 → 印章内底色与画布有 1~3 色阶差，留矩形鬼影；且触边过滤按簇连坐淘汰了几乎所有土豆
- 壁纸 v3：改墨迹掩码 alpha（只贴线条像素）→ sharp raw 流水线吞 alpha（模糊后 max=255 的掩码过一次 resize 后 max≤126 甚至归零，图案淡不可见）；debug 探针定位：RGBA 同缩与分通道缩放在 sharp 中均异常
- 壁纸 v4（最终）：核心管线全部纯 JS —— 线稿掩码(r-b>30) + 连通域 + 小外扩(16px)相交合并 + 包围盒包容合并（保住土豆内部斑点）+ 连通域级触边淘汰(40px) + 孤立碎片过滤(<95px) + 墨迹膨胀4px + 二项式模糊 + 预乘空间面积平均缩放 + source-over 合成；sharp 只做 PNG 解码与 webp 编码
- 壁纸 v5 修正：去掉宽高交换（非等比压扁变形），碎片过滤阈值提至 max≥95px；最终 21 只印章散布 43 次，1600x2648 129KB，土豆+爆米花线条清晰、图案小而密、零鬼影
- 深色版（scripts/make-bg-dark.mjs）：纸墨分离重上色 —— 墨量 alpha=clamp((r-b-20)/70)，输出=深可可#2b1a13×(1-a)+奶油#f6e7d4×a；水彩晕圈自动变暖光，图案与浅色版完全一致，105KB
- 浏览器实测（390x844 + 1280x800）：登录页新壁纸自然、ConfigNotice 消失（真实配置生效）、LoveNote/love@potato.com 保持；登录错误账号 → 真实 Supabase 请求（POST /auth/v1/token 400）+ 中文 toast「邮箱或密码不正确」；注册假域名 → Supabase 拒绝（新项目默认校验邮箱域名），据此给 getErrorMessage 补「email address ... is invalid」中文映射并复测生效；dev.log 全 200 无错误
- README 更新：文件清单补齐 AuthShell/密码页/public 壁纸/scripts/keep-alive，新增「🎨 壁纸定制（浅色/深色）」章节（切换步骤 + 重新生成方法）；.env.local.example 头部 CoupleNote→LoveNote
- 清理临时探针脚本与旧 extend-bg-light.mjs；lint 零错误；浏览器已关闭

Stage Summary:
- 真实 Supabase 已接入且链路实测打通：Auth 登录/注册请求真实到达、错误正确翻译、三表 + RPC + RLS 就位（用户已自行执行 schema.sql，本轮确认无误）
- 壁纸定稿：浅色小图案密排版上线（手机自然不突兀）；深色版资产已生成待切换（bg-dark.webp + AuthShell 一行换 URL，文字配色需同步做深色统一）
- 遗留：注册需真实可收件邮箱（Supabase 新项目默认拒无 MX 域名）；深色版切换涉及文字/输入框深色统一，等用户确认后实施

---
Task ID: 7
Agent: Z.ai Code (主 Agent)
Task: ① 浅色壁纸改斜向排版 + 土豆/爆米花数量均匀分布 ② 认证页增加深浅壁纸手动切换按钮（深色版全套落地）。

Work Log:
- 壁纸 v6（scripts/make-bg-light.mjs）：散布布局从「随机网格抖动」改为 45° 旋转菱形点阵（点 (i,j) 落在 (i+j,j-i)×d/√2，LATTICE_D=290，抖动 ±14px），图案沿两个对角方向整齐排列；土豆/爆米花按点阵奇偶棋盘交替，每只图案的对角线近邻必为另一种题材，数量 18:24 接近均分
- 印章分类踩坑：土豆是斜放椭圆，轴对齐包围盒长宽比判别失效（全被分成爆米花）；改用墨迹二阶矩（协方差特征值比 sqrt(λ1/λ2)）度量主轴细长比，旋转不变
- 连锁合并问题：PAD=16 时相邻图案外扩盒相交连成混合簇（曾出现 788x700 巨型土豆+爆米花连体，分类失真且仅剩 2 只纯土豆章）；PAD 降至 8 打断连锁、删去冗余包容合并，得到 4 只土豆 + 11 只爆米花共 15 章，42 点阵点全放满
- 深浅切换架构：新建 src/components/auth/WallpaperTheme.tsx —— useSyncExternalStore 订阅 localStorage（key lovenote-wallpaper-theme），SSR/水合期固定浅色避免错配，不违反 react-hooks/set-state-in-effect；toggle 写存储 + 通知监听者，storage 事件跨标签页同步；导出 9 个配色构建器（卡片/输入框/标题/Label/链接/图标）集中维护深浅两版样式
- AuthShell：根容器按主题切换壁纸 URL 与底色（bg-light/#fdfbee ↔ bg-dark/#2b1a13）+ 右上角月亮/太阳切换按钮（44px 触达）；SplashScreen 底色跟随已存主题
- AuthForm（登录/注册/验证提示三视图）、forgot-password、reset-password（失效提示/新密码表单）全部换用主题构建器，深色版卡片 #3a241a/85、输入白 10%、文字 rose-50/100 系
- 踩坑（重要，已两次复发）：壁纸背景图禁止使用 Tailwind 带引号的 url 任意值类——类名经 Tailwind v4 + Next CSS 管线生成畸形规则，css-loader 把引号并进路径报 Module not found；且类名原文一旦写进任何被扫描的文件（含本 markdown 日志，v4 自动内容检测会扫所有非 gitignore 文件）就会复发（Task 7 收尾把踩坑原文追加进本文件，用户预览即复发）。定论：背景图一律内联 style 指定；文档/日志中只做文字描述，绝不出现类名原文
- MultiEdit 非原子教训：一条 old_str 不匹配时前面编辑仍会落盘（AuthForm import 被插重两次），已清理并改用单 Edit 逐段核对
- 验证：bun run lint 零错误、tsc src/ 零错误；agent-browser 实测 390x844 + 1280x800：浅色斜向点阵自然、点按钮切深色全套（壁纸/卡片/输入框/按钮/图标）即刻生效、刷新持久化（storage 确认 dark）、跨页保持、往返切回正常；登录错误账号仍返回真实 Supabase 错误中文 toast；console 无报错、dev.log 全 200
- README：文件清单与「🎨 壁纸定制」章节更新（内置切换说明 + LATTICE_D 调参）；清理调试打印；浏览器已关闭

Stage Summary:
- 壁纸定稿斜向点阵版：对角对齐 + 棋盘交替均匀分布，浅深两版同构（深版由浅版自动重上色）
- 深色版从「资产」升级为「完整主题」：四认证页一键切换、持久化、跨标签同步，用户可随时自选
- 全部源码 lint/tsc 零错误，浏览器端到端验证通过

---
Task ID: 8
Agent: Z.ai Code (主 Agent)
Task: 修复用户预览页构建错误（Module not found: 壁纸文件名带引号）。

Work Log:
- 定位：Tailwind v4 自动内容检测会扫描所有非 gitignore 文件（含 markdown）；Task 7 收尾时把「带引号的壁纸背景图任意值类」原文写进了本日志，重新编译时被当作候选类名生成畸形 CSS 规则，css-loader 把引号并进资源路径报 Module not found——这正是「Task 7 当时验证通过、用户之后打开预览却报错」的原因（追加日志在验证之后）
- 修复一：全局 rg 排查（排除 node_modules/.next），确认类名原文只存在于 AuthShell.tsx 与本日志第 146 行；AuthShell 改为内联 style 指定壁纸 URL（不经过 CSS 生成与模块解析，浏览器运行时按 origin 解析，dev/prod 均稳），底色仍用安全的颜色任意值类，并在文件头注释写明禁止改回任意值类的原因
- 修复二：本日志第 146 行踩坑记录改写为纯文字描述（Task 7 与 Task 8 条目均不再含任何类名原文），消除扫描源
- 进程踩坑：按端口 kill 只杀掉持 socket 的部分，上一轮 setsid 的旧进程树残留，与新 server 抢占 .next 致 build-manifest ENOENT 500；按 PID 全量清杀后干净重启解决
- 验证：编译 GET / 200 零报错；lint 零错误、tsc src/ 零错误（examples/skills 模板目录的既有报错与本项目无关）；agent-browser 390x844 实测——登录页浅色壁纸（内联 style 计算样式确认）→ 点月亮切深色（bg-dark + storage=dark + 卡片/输入框/文字全套深色）→ 刷新保持深色 → /register 自动联动深色 → 再切回浅色（bg-light + storage=light），页面 errors 零输出；dev.log 全 200，且用户预览面板的跨域请求已返回 200（修复对用户实时生效）

Stage Summary:
- 根因定性：Tailwind v4 扫描范围 = 所有非 gitignore 文件，文档/日志里出现类名原文等同于写在源码里
- 防复发双保险：壁纸 URL 一律内联 style（AuthShell 头注释已写明）；文档/日志只做文字描述、绝不出现类名原文

---
Task ID: 9
Agent: Z.ai Code (主 Agent)
Task: ① 深色版线条毛边优化 ② 壁纸图案密度调高、图案调小；顺带发现并修复 env 配置文件丢失。

Work Log:
- 壁纸 v7（make-bg-light.mjs）：SCALE 0.52~0.64 → 0.36~0.44，点阵间距 290 → 210（密度约 ×1.9），抖动 ±14 → ±10；斜向点阵与土豆/爆米花棋盘交替不变。实测点阵 42 → 85 点，放置 43 → 77 只（土豆 32 / 爆米花 45）
- 深色抗毛边（make-bg-dark.mjs v2）：毛边根因 = 线性 alpha 截断映射把柔和渐变两端削平 + 深底亮线的明暗辉度效应放大 8-bit 阶梯 + webp q85 色度抽样噪声。修复 = alpha 高斯模糊（[1,4,6,4,1]/16 两趟，纯 JS 防sharp吞alpha）抹平阶梯 → smoothstep S 曲线恢复核心实度与端点归零 → webp q92 + smartSubsample
- 新旧同区域 3 倍放大对比图目检：新深色线条明显更顺滑，小图案边缘干净
- 意外发现：浏览器实测时「尚未配置 Supabase」横幅复现。排查确认 .env.local 与 .env.local.example 在两轮会话之间（约 09:27）被外部删除（运行中 server 进程内存里还有旧 env，SSR 无横幅；但 Turbopack 监视 env 文件变动并失效重编译，客户端 bundle 以空值重编译 → 仅客户端出横幅）。已恢复两个 env 文件（真实凭据 + 模板），按 PID 全量清杀旧进程、清 .next 重启
- 验证：SSR 与客户端横幅均消失；错误凭据登录 → toast「邮箱或密码不正确，请重新输入」（真实 Supabase 400 的中文映射，证明客户端 bundle 已内联真实配置）；深浅切换、主题持久化复测正常；新版壁纸手机 390x844 目检两版均自然清晰；页面 errors 零输出；dev.log 全 200

Stage Summary:
- 壁纸定稿 v7：更小更密（77 只）+ 深色版顺滑无毛边；调参入口集中在两个脚本头部常量
- 运维警示：.env.local 被外部删除会导致「仅客户端」出现未配置横幅（Turbopack env 失效机制）；若横幅复现，第一步检查 .env.local 是否存在

---
Task ID: 10
Agent: Z.ai Code (主 Agent)
Task: 修复「壁纸右侧存在较大空白」。

Work Log:
- 量化诊断：写探针脚本测 bg-light 逐 100px 列条带的墨迹覆盖率 → x 1400-1600 仅 0.0~0.2%（右侧 200px 全空），左侧 100px 起即有图案，不对称实锤
- 根因：点阵锚定在原点（x = k·STEP），最大列号点落在「MARGIN 边界 + 印章半宽」都容不下的死区，整列被越界检查拒绝；该列按棋盘规则又恰是最大的土豆列，popcorn 列也够不到边 → 右缘空带。桌面/预览面板等能看全画布宽度的视口直接可见
- 修复（make-bg-light.mjs v8）：点阵 span 居中到「能容纳最大印章」的区域——外侧列距边 = MARGIN + 最大印章半宽 + 抖动（HALF_W_BOUND=140 / HALF_H_BOUND=95，运行时打印最大印章盒校验：实际 98/92 ≤ 界限）；越界从「整只拒绝」改为「向画布内收拢」（span 居中后最多收拢几十 px）；colCount 为奇数使首尾两列同为土豆列，左右推得一样远
- 结果：点阵 72 点 100% 放置（v7 85 点只放 77），土豆 40 / 爆米花 32；复测覆盖率 x 1400-1500 → 3.4%，最外侧两条 100px 带左右同为 0%（对称装饰性留白）
- 验证：桌面 1280x800 浅/深两版左右两侧对称铺满、斜向点阵整齐；移动 390x844 四边铺满、无收拢伪影；深色版由新浅色版重上色天然同构；页面零报错
- 清理探针脚本；浏览器已关闭

Stage Summary:
- 壁纸 v8：四边均匀铺满 + 对称装饰留白边框；布局算法从「锚定原点 + 拒绝越界」升级为「span 居中 + 收拢兜底」，从机制上杜绝单侧空带
- 经验：图案散布类生成必须按「最大元素占位半径」收缩可布点区域并居中，而非让边界检查隐式裁掉整列

---
Task ID: 11
Agent: Z.ai Code (主 Agent)
Task: 壁纸 v9「无限延伸」——用户反馈左右空白仍多，要求土豆/爆米花在画布边缘被截断，做出壁纸图案无限延伸的观感。

Work Log:
- 推翻 v8 的「印章必须完整落在画布内」策略：v8 的对称留白边框在能看全画布宽度的视口（桌面/预览面板）下仍显空白较多
- make-bg-light.mjs v8 → v9 三处改造：
  - 取消 60px 留白与 span 居中，点阵锚定原点直接向四周铺出画布：格点索引从负数起，中心最远越界「最大印章半宽 + 抖动」（横 150 / 纵 105），负数取模的奇偶棋盘判断在 JS 下不受影响（-1/-0）
  - 放置时不再向画布内收拢，允许印章越出画布；合成函数写入画布前逐像素裁剪（越界行列直接跳过），画布边界自然切出半只图案
  - 碰撞检测改为只看「画布内可见部分」（可见盒判交 + 8px 间隙），避免越界印章在画布外虚占位置导致边缘排布变稀；完全画布外的印章不占位
- 重新生成浅色版并链式重跑深色版重上色：点阵 123 点放置 122（土豆 59 / 爆米花 63），越界余量校验 98/92 ≤ 150/105；两图均 1600x2648
- agent-browser 四组合目检：移动 390x844 与宽屏 1280x800 × 浅/深两版，四边均为被截断的半只图案，无任何空白带，深色版抗毛边效果保持
- dev.log 全 200 零报错；lint 零错误；浏览器已关闭

Stage Summary:
- 壁纸 v9 无限延伸版上线：四边截断 + 任意视口 cover 裁切都看不出边界；布局策略从「限制在安全区内完整摆放」演进为「铺出画布 + 裁剪合成」，这是壁纸类平铺观感的正确做法
- 经验：碰撞检测必须与「可见性」一致——按原始包围盒判定会让边缘密集区被画布外的不可见部分挤稀

---
Task ID: 12
Agent: Z.ai Code (主 Agent)
Task: 笔记功能升级：点击笔记打开全屏编辑页 + Apple 备忘录式富文本编辑（加粗/下划线/待办清单等）。

Work Log:
- 技术选型：安装 Tiptap v2 全家桶（react/pm/starter-kit/underline/task-list/task-item/placeholder/highlight，2.27.2）+ dompurify 3.4.14；选 Tiptap 而非已依赖的 mdxeditor 的原因：React 19 兼容明确、工具栏可完全自绘成 Apple 风格、HTML 存储让渲染端简单
- 数据层零改动：notes.content 本就是 text，直接存 HTML；Realtime 已开启；schema.sql 不动
- 交互重设计（Apple 备忘录式）：点 FAB 立即创建空白笔记并全屏打开（底部滑入动画 z-50 盖过 BottomNav/FAB）→ 输入停顿 900ms 防抖自动保存 → 返回时 flush 补存 → 关闭时若标题正文全空则静默删除（不留垃圾数据）；旧「Dialog + Textarea + 保存按钮」模式废弃，NoteEditorModal.tsx 删除
- 新组件 RichNoteEditor：工具栏（H1-H3/粗/斜/下划线/删除线/高亮/无序/有序/待办/引用/分隔线/撤销重做，横向可滚动，mousedown preventDefault 保焦点）+ 编辑区；globals.css 新增 .note-editor 排版（标题/列表/自定义粉色勾选框/引用/虚线分隔线/占位文字）
- 新组件 NoteEditorFullScreen：全屏覆盖页（100dvh + 安全区），顶部「返回｜共享/私人徽章｜保存状态（保存中…/已保存 HH:MM）｜删除」；标题无边框大字输入；title/content 双份 ref 供防抖回调读最新值，dirty 标记 + 返回 flush
- 兼容历史纯文本：toEditorHtml 按行拆 <p>（转义防注入）、htmlToPlainText/noteExcerpt 列表摘要、countTodos 解析 data-checked 显示「待办 n/m」徽标、isBlankNoteContent 判空清理
- useNotes.createNote 改 .select().single() 返回新笔记行（NoteResult 类型），列表头插免查询；删除路径复用 ConfirmDialog
- 验证：lint 零错误、tsc src/ 零错误、helpers 新增函数 15 项断言全过（bun -e 内联跑）；浏览器冒烟：伪造 session 验证 /notes 新代码渲染无崩溃，FAB 失败分支正确（401 → 中文 toast → 无效会话被清除 → AuthGuard 踢回），errors 零报错
- ⚠️ 端到端（真实新建→富文本→自动保存→落库）本轮未完成：Supabase 免费确认邮件配额耗尽（email rate limit exceeded，mailer_autoconfirm=false 每次注册必发邮件），注册无法完成；属外部配额限制，待窗口恢复后用真实邮箱按 README 验收

Stage Summary:
- 笔记编辑全面升级：全屏编辑页 + Tiptap 富文本 + 自动保存 + 空笔记自动清理；数据库与 Realtime 架构零改动，历史纯文本笔记无缝兼容（可编辑可展示）
- 新依赖：@tiptap/*@^2、dompurify；删除 NoteEditorModal.tsx
- 经验：Supabase 免费版确认邮件限流会卡死自动化注册验证——测试验证要么用已确认账号，要么在 Supabase 后台临时关闭 Confirm email

---
Task ID: 13
Agent: Z.ai Code (主 Agent)
Task: （回填）修复「待办勾选框与文字不在同一行」；答复双人远程共用方案。

Work Log:
- 用户反馈富文本待办清单的勾选框与文字换行错位。逐层排查：磁盘上的 globals.css 排版规则正确、lightningcss 可独立解析无语法错误，最终用「浏览器遍历 document.styleSheets 检索目标选择器」定位——编译产物中整个排版块 0 命中，判定为 Turbopack CSS 增量编译腐化（磁盘源码正确但增量产物停留在旧版本，追加哨兵规则也不进产物），并非样式代码缺陷
- 修复：按 PID 清杀旧 dev server 进程树 → 删除 .next 缓存 → 用沙箱规范脚本干净重启（此前两次用 setsid nohup 手动拉起均约 20 秒静默死亡且无日志，规范脚本稳定）；重启后编译产物即时包含全部新规则
- 浏览器实测：列表项 display flex 生效，勾选框与文字同排且垂直居中；勾选切换、防抖自动保存（保存内容带 Tiptap taskItem 标记属性）、列表「待办 n/m」徽章全部正常；lint 零错误
- 答复双人远程共用：数据全部在 Supabase 云端，本地无需跑任何服务；同一网络直接用局域网 IP 访问 dev server，跨网络推荐部署 Vercel（最稳）或临时用 cloudflared/ngrok 隧道暴露本机

Stage Summary:
- 方法论沉淀：「样式莫名失效」先用浏览器遍历 styleSheets 检索选择器确认编译产物，再怀疑代码；Turbopack 长时间增量运行可能腐化 CSS 产物，清缓存干净重启是正确处置，不要盲目改样式代码
- dev server 必须用沙箱规范脚本启动，setsid nohup 方式会静默死亡

---
Task ID: 14
Agent: Z.ai Code (主 Agent)
Task: 落地并验证三项 UI 修改（① 页头标题居中 ② 笔记卡片长按菜单：共享⇄私人互转 + 删除二次确认 ③ 页脚「你们」改「我们」）；重新打包 VS Code 迁移 zip；解答本地 VS Code 使用 / GitHub 推送 / 预览方式。

Work Log:
- 排查发现三项修改的代码在上轮工具故障前已落盘：AppShell 页头改独立行绝对居中；新增 useLongPress（PointerEvent 500ms 计时、移动 10px 取消、触发后抑制 click、震动反馈、桌面右键等价）与 NoteActionSheet（底部滑出面板：转换类型 + 删除，未绑定情侣时「转共享」禁用并说明）；useNotes 新增 convertNoteType（转共享写 couple_id、转私人置空，转换后重拉列表）；notes 页把长按删除接入 ConfirmDialog 二次确认；设置页页脚文案已为「愿我们」——用户看不到是因为本地 zip 打包早于这些改动
- 用 Python Playwright（add_init_script 在应用代码前注入伪造会话 + fetch 补丁，全程不打真实数据库）做 19 项端到端断言：四个页面标题水平居中（偏差≤0.01px）、长按弹面板、私人转共享后私人列表清空且共享 Tab 双卡、删除弹二次确认后列表只剩一条、共享转私人反向同理、单击仍进全屏编辑页、设置页页脚文案、首页对方昵称显示；19/19 通过，console 零意外错误
- 调试踩坑三连：PostgREST 过滤参数是「字段=eq.值」形式，mock 需剥前缀；新版 postgrest-js 的 maybeSingle 不再发 object Accept 头、改为客户端取数组首元素；mock 脚本重写时漏声明一个变量导致对方资料查询抛引用错误（表现为资料回退「TA」）——用请求日志探针定位
- CLI 版 agent-browser 注入补丁存在时序竞争（无 addInitScript 能力、storage 事件被会话去重拦截），最终弃用改走 Playwright；验证管线脚本留存于沙箱 .zscripts 供复用（已加入 gitignore，不进仓库与 zip）
- 重新打包迁移 zip（保持旧包结构：含 .git 仓库、.env.local、示例与壁纸生成脚本；排除 node_modules/.next/tests/skills/沙箱脚本），同步更新 download/ 与 public/ 两份；提交 git 后打包保证包内仓库状态与工作区一致

Stage Summary:
- 三项 UI 修改确认上线并全量回归通过；长按交互与既有点击进编辑页互不干扰
- 迁移包已含全部新功能，用户重新下载解压即可；包内自带 git 历史与可运行配置
- 经验：浏览器自动化验证 Supabase 应用时，Playwright add_init_script 注入 mock 是最可靠路径；mock 必须完整模拟 PostgREST 的 URL 语义（eq. 过滤、数组响应、客户端解包）

---
Task ID: 15
Agent: Z.ai Code (主 Agent)
Task: 修复「配对成功后首页/我的-情侣空间对方恒显示 TA」+ 对方昵称资料实时同步 + 首字 emoji 头像显示问号。

Work Log:
- 用户真实双账号联调首次跑通，暴露配对后首页 CoupleCard 与设置页情侣空间对方长期「TA」、刷新无效。静态定位：前端 TA 仅在 partner 查不到时出现，刷新无效说明是数据库策略恒不通过——schema.sql「情侣双方可互相查看资料」策略的 EXISTS 子查询里未限定外层列 id，而 couple_relation 自带 id 主键，PostgreSQL 名称解析让 id 绑定到内层 couple_relation.id（关系行自身 uuid），条件退化为 r.user_b_id = r.id 恒 false → 双方永远读不到对方 users 行；此前 mock 测试绕过 RLS 所以从未暴露
- 修复 schema.sql：策略改限定 public.users.id + 注释说明遮蔽坑；users 表加入 supabase_realtime publication（幂等 DO block），昵称变更可实时推送
- useCouple.ts 新增 users 表 postgres_changes 订阅（RLS 下本方只收得到本人+对方两行），changedId === partner.id 时 refresh()，对方改昵称即时上屏
- 顺带修复用户发现的 emoji 首字头像问号：helpers.ts 新增 firstGrapheme（Intl.Segmenter 按字素取首字符，降级 Array.from），CoupleCard AvatarCircle、设置页本人与对方头像三处改用它
- 处理 react-hooks 7 set-state-in-effect 对 useCouple 首次加载 effect 的既有报错：refresh() 改放微任务回调（Promise.resolve().then），与 useAuth/useNotes「回调内 setState」范式一致
- 验证：full src lint 零错误、tsc --noEmit 零错误、firstGrapheme 断言（中文/英文/emoji 开头/ZWJ 家庭/肤色/国旗/组合字符）全过

Stage Summary:
- 根因是 SQL 策略列名遮蔽（非前端时序问题），需用户在 Supabase Dashboard 重跑 schema.sql（幂等）后生效
- 重跑后建议双真实账号回归：绑定即显示对方昵称+首字头像、一方改昵称另一方不刷新自动更新、emoji 开头昵称头像正常、notes 共享作者角标不再是 TA

---
Task ID: 16
Agent: Z.ai Code (主 Agent)
Task: v2.0「足迹」—— 底部导航第 4 栏：可缩放矢量世界地图，点城市点亮/打标签/记日志（情侣共享，实时同步）。

Work Log:
- 与用户确认四项关键决策：矢量地图（不接瓦片/第三方服务，运行时零外部依赖）｜一城一个日志弹窗、内部多条记录按时间正序｜标签预设+自定义多选｜命名「足迹」
- 数据链路本地实测：DataV GeoAtlas 中国省级 583KB / 单省 190KB、jsDelivr world-atlas 108KB 均可直连；DataV 的 feature properties.center 自带城市驻地经纬度，省去自算质心
- scripts/build-geodata.mjs 一次性生成 4 个产物并提交仓库：world 39KB（177 国）、china 26KB（含南海诸岛/九段线）、cities 24KB（370 个地级市，含省会标记）、provinces 87KB（34 省界，tier≥1 惰性加载）；全图层统一预投影到 unit=8192 的 Web Mercator，运行时只做 translate/scale；自检覆盖城市数/adcode 格式/坐标范围/体积预算（首屏三件套 ≈89KB，gzip ≈33KB）
- 简化策略按图层实际缩放档定容差（世界 12 单位≈2.5km、中国 2.5、省界 1.0），坐标精度分层（0~1 位小数）；首版体积超预算 3~5 倍（world 181KB/china 184KB/provinces 328KB），最终压到预算内；顺带砍掉与省界层重复的 china.detail.json
- 数据层：footprints 表（city_adcode/city_name/province_adcode/tags text[]/visited_at date/正文，含 title/content/tags 数量三条 check）+ 3 索引 + updated_at 触发器 + 照抄「共享笔记」范式的 RLS 四策略（子查询外层列一律限定表名，避免上次的列名遮蔽坑）+ Realtime 幂等 DO 块
- useFootprints 严格照抄 useNotes 范式（ready/loadedKey 派生/纯查询/Realtime 订阅/CRUD 返回 OpResult），额外本地派生 visitedCities（城市聚合）与 byCity（分组时间线）；loadFootprints 增加客户端排序兜底，时间线顺序不依赖服务端返回顺序
- useMapViewport 手势引擎：视口状态存 ref、手势期间直接写 DOM transform（不触发 React 渲染）、手势结束才 commit；PointerEvent 主路径 + touch 回退双路互斥（照抄 useLongPress 的微信内核兼容思路）；touchmove 非 passive + touch-action:none + overscroll-behavior:contain 三保险；不做双击缩放（城市轻点是主交互，延时判定会让每次点击都迟钝），缩放由捏合 + 常驻 +/− 按钮覆盖
- 组件自底向上：DateField / TagPicker / FootprintForm / FootprintTimeline / CitySheet / FootprintMap（模块顶层子组件满足 react-hooks/static-components；点与标签 counter-scale 保证屏幕尺寸恒定；捏合期间隐藏标记层）+ AppShell bleed 变体 + BottomNav 第 4 栏（min-w-20→min-w-0 防 320px 顶死）
- 浏览器实测揪出两个真 bug：① bleed 布局里用 h-full 取不到确定高度（flex 项的百分比高度不可靠），SVG 退回默认 150px 高 → 改为 flex-1 min-h-0 + absolute inset-0，并在首次交互前让尺寸变化重新取景；② 缩放按钮是地图容器子元素，点它会被地图轻点命中逻辑当成点城市（面板弹出挡住按钮）→ 手势只在事件目标位于 svg.fp-map 内时才启动
- 验证：eslint src/ 零错误、tsc 零错误、next build 通过（/footprints 静态路由）；纯函数断言 29 条（视口/投影：投影与构建产物互校、中国 bbox 四角落进视口、锚点缩放不变式、夹紧、档位、命中）+ 21 条（足迹：标签归一化/凌晨串日回归/排序/聚合/标签剔除）；Playwright（Edge + mock PostgREST）25/25：4 栏导航、默认聚焦中国、已点亮城市高亮与图例计数、点城市开面板、时间线正序（mock 乱序返回）、新增记录请求体断言 + 城市点亮、空表单不提交、删除二次确认、放大后点位 34→370 且省界惰性加载、回到中国、深色配色切换、加载失败中文提示、未绑定引导态、控制台零报错

- 截图目检后的两处视觉微调：浅色全景下世界底图过重、与中国主体难分辨 → 世界填充调淡到 #f7eff1 且全景不透明度压到 0.65（放大 1.8 倍后淡出）；中国层加 1px 非缩放描边，全景下省级轮廓自然显现（视觉断言同步更新，30 条断言仍全过）
- 构建脚本可重复性验证：重跑 node scripts/build-geodata.mjs 后四份产物 md5 逐字节一致

Stage Summary:
- v2.0 上线内容：第 4 个 Tab「足迹」（矢量世界地图 + 城市点亮/标签/日志 + 情侣实时同步），版本号 2.0.0，README 补充功能表/文件清单/地图数据与合规说明/验收清单 D2 小节
- 需用户在 Supabase Dashboard 重跑一次 schema.sql（幂等）以创建 footprints 表并加入 Realtime publication
- 经验：flex 布局里不要用 h-full 撑满（用 flex-1 + min-h-0 + absolute）；浮层控件与画布手势必须做事件目标隔离，否则点按钮会被画布当成点击命中

---
Task ID: 17
Agent: Z.ai Code (主 Agent)
Task: 用户反馈两项：「地图太小、移动范围有限，基本只有中国及附近」+「其他国家的城市加载不出来」——放开缩放下限到整个世界，并补全球城市数据。

Work Log:
- 根因一（缩放下限）：minScaleFor 用了 max(w,h)/MAP_UNIT（cover 语义）——竖屏手机上世界永远比视口大，缩到底也只能看到约半个世界。改为 min(w,h)/MAP_UNIT × 0.9（contain 语义 + 一点余量），缩到底时整个世界连同留白都在画面里，clampView 的双轴居中逻辑天然适配
- 根因二（数据只有中国）：新增 Natural Earth 10m populated places（公有领域，7342 个点位自带 NAME_ZH 中文名）→ 排除中国/台湾（交给 DataV，避免重复）与科考站/历史遗迹，按「首都/世界城市/特大城市 或 scalerank≤6 或人口≥30 万」收敛到 198 首都 + 2072 其他
- 体积控制：全球城市分两份——首都进 cities.json（首屏，缩到世界视野就能看到各国首都），其余单独 cities-world.json 与省界一起在 tier≥1 惰性加载；世界城市条目省掉 p/cap/w 三个冗余字段（前端加载时补齐），从 463KB（全量 6365 个）压到 134KB（2270 个）
- 渲染性能：世界城市两千多个不能全渲染 → 新增 visibleRect/inBBox（可见矩形含 25% 外扩），渲染前按视野裁剪；命中判定仍用全量城市保证准确性；标签碰撞剔除改为所有档位统一走 cullLabels（全景档标签盒天然很大，只会剩下稀疏若干，已点亮城市优先）
- 类型调整：CityPoint 的 p/cap/w 改为可选（世界城市没有省级 adcode，加载时补 p=0/w=1）；createFootprint 对世界城市写 province_adcode=null
- 验证：lint / tsc 零错误；视口断言增至 35 条（新增：最小缩放让世界装进视口、可见矩形裁剪、外扩比例）；Playwright 冒烟 29/29（新增：缩到底整个世界装进画面且 scale=0.04285、世界视野下东京等国外首都已渲染、点击东京能打开日志面板、放大后出现 61 个非省会的中国地级市、cities-world.json 惰性加载被触发）
- 文档：README 功能验收清单补「缩到世界 / 国外城市可点亮」，public/data/README 补世界城市数据源与体积

Stage Summary:
- 「足迹」现在是真正的世界地图：默认聚焦中国 → 可一直缩到全球 → 放大到任意国家都能看到城市点位并记录足迹
- 经验：地图缩放边界一定要区分 cover（铺满）与 contain（装下）两种语义；移动优先的矢量地图必须做视野裁剪，否则全球 POI 会拖垮渲染

---
Task ID: 18
Agent: Z.ai Code (主 Agent)
Task: 用户反馈三项：① 边缘城市名被截断（如「富纳富」），问主流地图怎么处理、能否做循环视图 ② 城市名统一简体 ③ 国外城市点击后要显示外文名+英文名（英语国家只显示中文+英文）。

Work Log:
- 边缘标签：主流做法是「锚点翻转」（贴右边画在点左侧、贴左边画在点右侧）+ 碰撞剔除。实现 labelAnchorFor（按屏幕 x 与估算标签宽判定 start/middle/end），并顺带处理「点位已出画布、标签还露半截」：点位不在视口内直接不画标签。踩坑：globals.css 里 `.fp-label { text-anchor: middle }` 会盖掉组件按边缘设置的锚点属性（presentation attribute 优先级低于 CSS 规则），已删除该行并注释说明
- 横向世界循环（Google/Apple 地图同款）：clampView 横向不再夹紧，改为把 tx 归一化到 (-worldPx, 0]（视觉等价、数值不飘），新增 wrapOffsets 计算需要渲染几份世界副本（通常 1~2 份，接缝处最多 3 份），渲染时按 offset 复制整套图层并对每份副本单独做视野裁剪与标签剔除；nearestCity 把水平距离折算到最近的一份世界，保证接缝另一侧的城市也能点中
- 简体化：引入 opencc-js（devDependency，仅构建期用）把 NAME_ZH 统一转简体，繁体特征字从 80 个降到 0
- 外文名/英文名：新增 COUNTRY_LOCALE_FIELD（国家 → NE 本地语言字段映射，覆盖日/韩/俄/法/德/西/葡/阿/希伯来/泰语系等常见国家），英语国家（美/英/澳/加等未列入）只给英文名；日韩官方名去行政后缀（東京都 → 東京、서울특별시 → 서울）；数据里存 en / lo 两个可选字段，城市面板在标题下显示「外文名 · 英文名」，英语国家只显示英文名。cities-world.json 因此从 134KB 涨到 195KB（gzip 71KB，惰性加载可接受），预算同步调到 200KB
- 验证：lint / tsc / next build 全绿；视口断言增至 43 条（新增：横向环绕归一化、纵向仍夹紧、接缝处 2 份副本、跨接缝命中、缩到底世界仍铺满）；Playwright 冒烟 32/32（新增：贴边标签零溢出——用圆点元素而非标记组测量，避免把标签算进中心；横向拖动跨接缝出现双份副本；东京面板显示「東京 · Tokyo」）
- 截图目检：接缝处同一城市（努库阿洛法）在左右两侧各出现一份，标签完整无裁断

Stage Summary:
- 三项反馈全部落地：贴边标签自动翻转且点位出画布即不画标签、世界横向可无限拖（循环视图）、城市名全简体 + 国外城市面板显示外文名/英文名
- 经验：SVG 的 presentation attribute（如 text-anchor）会被同名 CSS 规则覆盖，做「按数据动态设锚点」时必须确认样式表里没有写死同名属性

---
Task ID: 19
Agent: Z.ai Code (主 Agent)
Task: 用户反馈三项：① 国内城市面板也要显示所属省份（直辖市不加）② 点没有小圆点的空白处不应该展开城市面板 ③ 国外显示过浅、没有国界线，且越放大越淡直到完全没有边界。

Work Log:
- 省份名：构建脚本给国内城市加 pv 字段（DataV 省级 name 原样，如「浙江省」「新疆维吾尔自治区」），直辖市/港澳台不写（省会即省级，重复）；363 个城市带上省份，面板副标题与国外城市的「外文名 · 英文名」共用同一行
- 命中判定：原来用全量城市做最近点命中，导致点空白处会冒出「附近看不见的城市」。改为只认「屏幕上真的画出来了」的：视野矩形不留外扩余量 + 当前档位的显示规则（全景档只显示首都/省会/已点亮）。实现上因 size/tier 来自后面的 hook，用 tapContextRef（在 effect 里同步）传递最新值，避免「声明前使用」与渲染期读 ref
- 国外显示（根因是我上一版把世界层做成「纯装饰、放大即淡出」）：新增高精度世界国界层 —— Natural Earth 50m admin_0_countries，填充 + 描边同时得到陆地与国界线，容差 2.5 单位 + 丢弃 <8 单位的小岛，产物 280KB（gzip 111KB，tier≥1 惰性加载）；渲染上做分级：tier 0 用 110m 粗轮廓，tier≥1 换 50m 高精度层；同时给世界层加国界描边（vector-effect 保证描边不随缩放变粗），并删掉「放大淡出」逻辑（已无用）
- 验证：lint / tsc / next build 全绿；视口断言 40 条（移除淡出相关 4 条）；Playwright 冒烟 36/36（新增：国内面板显示省份「浙江省」、世界层有国界描边、高精度国界层惰性加载、点击无点位的空白海面不弹面板）；截图目检日本放大后的海岸线与国界、杭州面板的省份

Stage Summary:
- 三项反馈全部落地：国内城市带省份、空白处不再误触、国外放大后有陆地与国界线
- 经验：命中判定必须与「实际渲染出来的东西」一致 —— 用全量数据做最近点命中，会出现「点了空白弹出看不见的城市」这类不可解释的交互

---
Task ID: 20
Agent: Z.ai Code (主 Agent)
Task: 用户追问两项：① 国界线还是很粗糙，有没有更好的办法 ② 放大后有些点没有名字，与附近有名字的点容易混淆。

Work Log:
- 国界线：定位到根本矛盾 —— 单文件方案做不到「放大后仍平滑」：简化容差是地图单位，深放大时 1 像素 ≈ 0.1~0.5 单位，容差 1.5 单位会变成十几像素的折线；而全局把容差降到 0.25 需要几 MB，移动端不可接受。这正是主流地图用**矢量瓦片（vector tile）**的原因
- 落地方案（自建矢量瓦片，不引入第三方服务）：数据源换 Natural Earth 10m；构建期把世界切成 16×16 网格，每个环先按块矩形用 Sutherland–Hodgman **裁剪**（不裁剪的话跨块大国会在每块重复一份，体积失控），再按 0.25 单位（≈1.2 公里）容差简化 → 213 块、共 2.8MB、单块 ≤101KB；同时保留一份全局中等精度层（容差 2 单位）供 tier1 使用
- 运行时三级世界底图：缩小用 110m 粗轮廓 → tier≥1 用全局中等精度层 → tier≥2 按视野加载精细分块（未加载完时继续用上一级，加载后无缝替换）；新增 src/lib/map/tiles.ts（分块索引与视口求交，视口太宽时返回空、退回上一级，避免为看一个省拉几十块）
- 无名字的点：主流做法是「要么点+名字，要么不显示」。这里采用分级：被标签碰撞剔除的点画得更小更淡（fp-dot--minor，半径 2px 无描边），与带名字的点在视觉上明确区分；同时强制保留已点亮城市的名字（用户自己的足迹必须有名字）
- 验证：lint / tsc / next build 全绿；视口与分块断言 45 条（新增：深放大只需 1~4 块、中国全景不做分块加载、分块键与产物一致、分块尺寸=世界/16）；Playwright 冒烟 38/38（新增：深放大按视野加载精细分块、分块渲染后世界层路径数下降）；截图目检深放大海岸线明显更贴合真实形状
- 决策记录：曾尝试 8×8 网格 + 0.4 单位容差（单块最大 190KB、深放大时最多要 6 块），换算后改为 16×16 + 0.25 单位（单块 ≤101KB、同屏 1~4 块），既更平滑又更省流量

Stage Summary:
- 国界清晰度问题用「分级 + 分块」正解解决：这是本项目在不引入第三方地图服务前提下能做到的最好方案；再往上就是接真实瓦片服务（与「国内可用、零外部依赖」的约束冲突）
- 经验：地图上的标签必须与点位成对出现 —— 只给部分点加名字会造成「这个名字属于哪个点」的歧义；正确做法是明确分级（带名字 / 不带名字两种视觉权重），并保证用户自己的点位必定有名字

---
Task ID: 21
Agent: Z.ai Code (主 Agent)
Task: 用户反馈三项：① 深色模式图例没跟着变 ② 国外城市描述里也要加国家名（中文名 + 外文原文 + 英文名） ③ 某些尺度下俄罗斯只剩莫斯科一个点，问「降级的点」是什么逻辑、为什么这么空。

Work Log:
- 图例：实测深色下图例的背景与文字其实是正常的，问题在**色块**用的是写死的浅色配色（rose-500 / orange-300），而深色地图上实际画的是 #fb7185 与 rgb(253 164 175 / .45) —— 于是「图例和地图对不上」。改为色块也带 dark: 变体，并新增第三个色块解释「次要城市」的点
- 国家名：构建期用同一份 Natural Earth 国家数据生成「国家代码 → 中文国名」表（含 OpenCC 简体化），给每个世界城市加 co 字段；面板副标题从「外文原文 · 英文名」变为「国家 · 外文原文 · 英文名」（英语国家只有「国家 · 英文名」）
- 空旷问题（根因是两个叠加的）：① 全景档原规则是「只显示首都/省会 + 已点亮」，所以俄罗斯只有莫斯科；② 世界城市列表本来只在放大后才加载，缩到世界视野时手里只有各国首都，且国内非省会城市的重要度被我设成 6、被 ≤4 的门槛挡掉。改为：重要度门槛提到 6（覆盖全部国内城市与 NE rank ≤6 的国外城市）+ 600 个点位的密度上限（点亮城市优先、其余按重要度排序）；并新增「缩到世界视野（k ≤ 0.6）时单独加载世界城市列表」的触发（只拉城市点位，不带省界与精细国界，省几百 KB）
- 数据：世界城市补 co（国家中文名）与 r（重要度 = NE scalerank；国内城市省会是 0、其余 6）；cities.json 57KB（gzip 14KB）、cities-world.json 244KB（gzip 75KB）
- 验证：lint / tsc / next build 全绿；Playwright 冒烟 40/40（新增：全景档点位数 ≥150 —— 实测 405 个、国外面板显示「日本 · 東京 · Tokyo」、深色图例色块随模式变化）；截图目检世界视野 1200 个点位（两份世界副本）、深色图例三色块、东京面板国家名

Stage Summary:
- 三项反馈全部落地：图例跟随深色、国外城市带国家名、全景档不再空旷（中国视野 69 → 405 点位、世界视野 1200 点位）
- 经验：图例的色块必须引用「地图上实际使用的颜色」而不是随手挑一组近似色，否则深色/浅色切换时会出现「图例与地图对不上」；分级显示规则要按数据源分别校准（NE 的 scalerank 与国内城市的行政级别不是同一套刻度）

---
Task ID: 22
Agent: Z.ai Code (主 Agent)
Task: 用户反馈三项：① 空状态提示文案改成「点击一个城市，记录下你们的第一次足迹」② 提示条与图例重叠 ③ 城市点太密集、且点乌鲁木齐周围的次要小点会打开乌鲁木齐。

Work Log:
- 文案与避让：提示条文案按用户要求改写；位置从 top-3 下移到 top-24（图例展开后有三行，12px 处开始、约 68px 结束），并加断言校验两者矩形不相交
- 密度：重新校准「重要度」——国内城市改用 DataV 的 childrenNum（下属区县数，广州 11/深圳 9/珠海 3）分档：省会 0、≥14 县区 2、≥12 县区 3、≥10 县区 4、≥8 县区 5、其余 7；全景档门槛回到 rank ≤4、数量上限 260 → 中国视野从 405 个点降到 162 个（既不空旷也不糊成一片）
- 误触（关键 bug）：定位到两层原因。① 命中排序用的是「圆心距离 − 点亮加分」，密集处会让旁边的已点亮大城市越级抢选 → 改为最朴素的「哪个点离手指最近选哪个」（保留 22px 触达半径），并删掉点亮加分；② 更隐蔽的一层：命中候选列表用的还是旧的全景档规则（只有首都/省会 + 点亮），而渲染用的是新规则（含 rank ≤4 的次要城市）——于是屏幕上看得见的小点（如宁波）根本不在候选里，手指落在小点上被旁边的杭州接住。抽出共用的 selectTier0()，渲染与命中调用同一个函数
- 验证：lint / tsc / next build 全绿；视口断言 45 条（命中判定改为「取最近的点」，去掉点亮优先的断言）；Playwright 冒烟 43/43（新增：提示文案、提示与图例不重叠、全景档点位密度 60~260（实测 162）、**点宁波选中的是宁波而不是紧邻的杭州**）

Stage Summary:
- 三项反馈全部落地：文案更新、提示条与图例避让、点密度与命中精度修正
- 经验：命中判定与渲染必须共用同一套「哪些点可见」的规则，各写一份迟早会出现「看得见点不中、点空白弹出东西」这类不可解释的交互；命中排序也不该给某类点加优先级，否则密集区必然误触

---
Task ID: 23
Agent: Z.ai Code (主 Agent)
Task: 空状态提示条加 emoji + 右上角关闭按钮（关闭仅对本次浏览生效，刷新后仍未点亮任何城市则再次弹出）。

Work Log:
- 提示条加 👣（与「足迹」主题呼应）；右上角加圆形关闭按钮（绝对定位在胶囊内，右侧留出 pr-9 避免压字），点击后置 hintDismissed 隐藏
- 关闭状态刻意只放在组件 state 里（不落 localStorage）：刷新页面即复位，因此「一座城市都没点亮」时每次重新进入页面都会再提示一次 —— 与用户预期一致
- 提示容器从 <p> 改为 <div> 并加 data-hint="footprint-empty" 测试钩子（断言不再依赖标签类型）
- 验证：lint / tsc / next build 全绿；Playwright 冒烟 46/46（新增：文案含 emoji、存在关闭按钮、关闭后消失、重新加载后再次出现、仍与图例不重叠）

Stage Summary:
- 空状态提示的交互闭环完成：可见 → 可关闭 → 刷新后按数据状态重新判断
- 经验：这类「可关闭的引导提示」是否持久化要按产品语义定 —— 引导的是「还没有内容」这个数据状态，就应该用组件内 state 而不是持久化，否则用户永远看不到了

---
Task ID: 24
Agent: Z.ai Code (主 Agent)
Task: 用户反馈两项：① 未绑定情侣也应允许点城市、只有点「记录这次旅程」时才提示绑定 ② 未绑定提示是默认显示的，即使已绑定也会先闪一下再换成空状态提示，出现文字跳动。

Work Log:
- 未绑定可浏览：handleSelectCity 去掉 isBound 拦截（点城市一律打开面板），新增 handleStartCreate 在未绑定时 toast「绑定情侣后，才能一起点亮这座城市 💗」且不进入表单；CitySheet 增加 isBound prop，未绑定时时间线空状态文案换成「绑定情侣后，就能一起在这里留下足迹 💗」
- 文字跳动（根因）：页面原来的三元判断是 `!isBound ? 未绑定引导 : 空状态提示`，而 isBound 在 useCouple 查询返回前恒为 false —— 于是所有用户（包括已绑定的）首帧都会先渲染「绑定情侣后…」，查询回来才换成「点击一个城市…」。改为先读 useCouple 的 loading：查询未完成时两条提示都不渲染，返回后才按真实状态二选一；绑定后的记录查询期间也不渲染，避免第二次跳动
- 验证：lint / tsc / next build 全绿；Playwright 冒烟 50/50（改写未绑定场景：可开面板 + 面板内提示先绑定 + 点新增记录才 toast 且不进表单；新增场景 3b：用 mock 把情侣关系查询延迟 900ms，断言「返回前两条提示都不出现、返回后才显示正确的那条」）

Stage Summary:
- 未绑定用户的路径打通：可以浏览城市与地图、了解功能，只有真正产生数据的动作才引导去绑定
- 经验：拿「异步查询结果」做条件渲染时，不要把「查询未完成」当成 false 直接走 else 分支 —— 否则会先渲染错误分支再切换，用户看到的是文字跳动；正确做法是显式区分 loading / false / true 三态
