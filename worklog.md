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
