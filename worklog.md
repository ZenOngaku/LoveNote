# CoupleNote 项目 Worklog

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
