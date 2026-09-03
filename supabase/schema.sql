-- ============================================================
-- CoupleNote · Supabase 数据库初始化脚本
-- ============================================================
-- 使用方法：
--   1. 打开 Supabase Dashboard → SQL Editor → New query
--   2. 粘贴本文件全部内容 → Run（脚本可重复执行，具备幂等性）
--
-- 内容总览：
--   一、数据表（users / couple_relation / notes）
--   二、工具函数（current_couple_id）
--   三、业务 RPC（生成邀请码 / 兑换邀请码 / 解除配对）
--   四、开启 RLS 行级安全
--   五、RLS 安全策略（数据隔离核心）
--   六、新用户自动建档触发器
--   七、开启 Realtime 实时推送（notes / couple_relation）
-- ============================================================


-- ============================================================
-- 一、数据表
-- ============================================================

-- 1. users 用户扩展表（与 auth.users 一一对应，存储业务资料）
create table if not exists public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text,                                  -- 昵称（默认取邮箱前缀，可修改）
  created_at timestamptz not null default now()
);
comment on table public.users is '用户扩展信息表：与 auth.users 一一对应';


-- 2. couple_relation 情侣配对关系表
create table if not exists public.couple_relation (
  id           uuid primary key default gen_random_uuid(),
  user_a_id    uuid not null references auth.users (id) on delete cascade,  -- 邀请码生成方
  user_b_id    uuid          references auth.users (id) on delete cascade,  -- 邀请码使用方（绑定成功后写入）
  invite_code  varchar(6) not null,                                         -- 6 位数字邀请码
  status       varchar(16) not null default 'pending',                      -- pending 待绑定 / active 已绑定 / dissolved 已解绑
  created_at   timestamptz not null default now(),                          -- 邀请码生成时间
  expires_at   timestamptz not null,                                        -- 邀请码过期时间（生成时间 + 24 小时）
  bound_at     timestamptz,                                                 -- 绑定成功时间
  dissolved_at timestamptz,                                                 -- 解绑时间
  dissolved_by uuid          references auth.users (id) on delete set null, -- 发起解绑的一方
  constraint couple_relation_status_check
    check (status in ('pending', 'active', 'dissolved'))
);

create index if not exists idx_relation_user_a on public.couple_relation (user_a_id);
create index if not exists idx_relation_user_b on public.couple_relation (user_b_id);
create index if not exists idx_relation_code   on public.couple_relation (invite_code);

-- 关键约束：一个用户同时只能有一个「进行中」的邀请 / 关系（数据库层面防止重复绑定）
create unique index if not exists uq_relation_user_a_active
  on public.couple_relation (user_a_id) where status in ('pending', 'active');
create unique index if not exists uq_relation_user_b_active
  on public.couple_relation (user_b_id) where status = 'active';


-- 3. notes 笔记表（note_type 区分共享笔记 / 私人笔记）
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,          -- 创建者
  couple_id  uuid          references public.couple_relation (id) on delete cascade, -- 共享笔记所属的情侣空间（私人笔记为 null）
  note_type  varchar(16) not null,                                                -- shared 共享 / private 私人
  title      text not null default '',
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_note_type_check check (note_type in ('shared', 'private')),
  constraint notes_shared_need_couple check (note_type <> 'shared' or couple_id is not null)
);

create index if not exists idx_notes_user    on public.notes (user_id);
create index if not exists idx_notes_couple  on public.notes (couple_id);
create index if not exists idx_notes_updated on public.notes (updated_at desc);

-- updated_at 自动维护：任何 UPDATE 都会自动刷新最后修改时间
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();


-- ============================================================
-- 二、工具函数
-- ============================================================

-- 返回当前登录用户所处「已绑定」情侣关系的 id（未绑定返回 null）
-- 说明：security definer 仅用于在 RLS 策略内可靠地做只读子查询，
--       函数内部已用 auth.uid() 严格过滤，不会泄漏他人关系。
create or replace function public.current_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select r.id
    from public.couple_relation r
   where r.status = 'active'
     and (r.user_a_id = auth.uid() or r.user_b_id = auth.uid())
   limit 1;
$$;


-- ============================================================
-- 三、业务 RPC（数据库函数，security definer 原子操作）
-- ============================================================
-- 为什么邀请码相关操作必须走 RPC？
--   「输入邀请码绑定」时，使用者 user_b 还不在关系行内，RLS 无法既阻止
--   TA 看到别人的邀请码、又允许 TA 更新那一行。因此把「找到邀请码 → 校验
--   有效期 → 写入 user_b」封装成数据库函数原子完成，在函数内部做严格校验，
--   这是 Supabase 官方推荐的正确做法，避免在 RLS 策略上开越权口子。
--   错误信息全部为中文，前端直接 toast 展示。

-- 1) 生成 6 位数字邀请码（24 小时有效）；返回创建的关系行
create or replace function public.generate_invite_code()
returns public.couple_relation
language plpgsql security definer set search_path = public as $$
declare
  caller   uuid := auth.uid();
  existing public.couple_relation;
  new_code text;
  rel      public.couple_relation;
begin
  if caller is null then
    raise exception '请先登录后再操作';
  end if;

  -- 已绑定：不允许再生成
  if exists (
    select 1 from public.couple_relation
     where status = 'active' and (user_a_id = caller or user_b_id = caller)
  ) then
    raise exception '你已绑定情侣，无法再生成邀请码';
  end if;

  -- 已有未过期的邀请码：直接返回，避免重复生成
  select * into existing
    from public.couple_relation
   where status = 'pending' and user_a_id = caller and expires_at > now()
   limit 1;
  if found then
    return existing;
  end if;

  -- 清理自己已过期的旧邀请码
  delete from public.couple_relation where status = 'pending' and user_a_id = caller;

  -- 生成不与「进行中」邀请码冲突的 6 位数字码（含前导零）
  loop
    new_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from public.couple_relation
       where invite_code = new_code and status = 'pending' and expires_at > now()
    );
  end loop;

  insert into public.couple_relation (user_a_id, invite_code, status, expires_at)
  values (caller, new_code, 'pending', now() + interval '24 hours')
  returning * into rel;

  return rel;
end;
$$;


-- 2) 使用邀请码完成情侣绑定；返回绑定后的关系行
create or replace function public.redeem_invite_code(p_code text)
returns public.couple_relation
language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  target public.couple_relation;
begin
  if caller is null then
    raise exception '请先登录后再操作';
  end if;
  if p_code !~ '^\d{6}$' then
    raise exception '邀请码格式不正确';
  end if;

  -- 已绑定：不允许重复绑定（对应产品需求「一个用户只能绑定一位情侣」）
  if exists (
    select 1 from public.couple_relation
     where status = 'active' and (user_a_id = caller or user_b_id = caller)
  ) then
    raise exception '你已绑定情侣，请先解除配对后再绑定';
  end if;

  -- 自动作废自己发出的未完成邀请
  -- （避免「生成了邀请码又想改用对方邀请码」时被自己的 pending 卡住）
  delete from public.couple_relation where status = 'pending' and user_a_id = caller;

  -- 锁定目标邀请码行（for update 防止两人并发绑定同一个码）
  select * into target
    from public.couple_relation
   where invite_code = p_code
     and status = 'pending'
     and expires_at > now()
     and user_a_id <> caller          -- 不能绑定自己发出的邀请码
   order by created_at desc
   limit 1
   for update;

  if not found then
    raise exception '邀请码无效或已过期';
  end if;

  update public.couple_relation
     set user_b_id = caller,
         status    = 'active',
         bound_at  = now()
   where id = target.id
   returning * into target;

  return target;
exception
  when unique_violation then
    raise exception '绑定失败：你或对方已在其他配对关系中';
end;
$$;


-- 3) 解除情侣配对（解绑后共享空间关闭，双方页面通过 Realtime 自动感知）
create or replace function public.unbind_couple()
returns void
language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception '请先登录后再操作';
  end if;

  update public.couple_relation
     set status       = 'dissolved',
         dissolved_at = now(),
         dissolved_by = caller
   where status = 'active'
     and (user_a_id = caller or user_b_id = caller);

  if not found then
    raise exception '当前没有可以解除的情侣关系';
  end if;
end;
$$;


-- ============================================================
-- 四、开启 RLS 行级安全（数据安全的根基）
-- ============================================================
alter table public.users           enable row level security;
alter table public.couple_relation enable row level security;
alter table public.notes           enable row level security;


-- ============================================================
-- 五、RLS 安全策略
-- ============================================================
-- 说明：策略中的 (select auth.uid()) 写法可以让 Postgres 把 auth.uid()
--       作为初始化参数缓存，避免逐行计算，是 Supabase 官方推荐写法。

-- ---------- users 用户扩展表 ----------
-- 只能看自己的资料
drop policy if exists "用户可查看自己的资料" on public.users;
create policy "用户可查看自己的资料" on public.users
  for select using (id = (select auth.uid()));

-- 情侣双方可互相查看资料（用于首页/设置页展示对方昵称）
drop policy if exists "情侣双方可互相查看资料" on public.users;
create policy "情侣双方可互相查看资料" on public.users
  for select using (
    exists (
      select 1
        from public.couple_relation r
       where r.status = 'active'
         and ((r.user_a_id = (select auth.uid()) and r.user_b_id = id)
           or (r.user_a_id = id and r.user_b_id = (select auth.uid())))
    )
  );

-- 只能创建 / 修改自己的资料
drop policy if exists "用户可创建自己的资料" on public.users;
create policy "用户可创建自己的资料" on public.users
  for insert with check (id = (select auth.uid()));

drop policy if exists "用户可更新自己的资料" on public.users;
create policy "用户可更新自己的资料" on public.users
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- ---------- couple_relation 情侣关系表 ----------
-- 只有关系内双方可以读取；外人完全查不到邀请码与配对信息
drop policy if exists "仅情侣双方可读取关系" on public.couple_relation;
create policy "仅情侣双方可读取关系" on public.couple_relation
  for select using (
    user_a_id = (select auth.uid()) or user_b_id = (select auth.uid())
  );

-- 仅允许生成「属于自己的待处理邀请」（user_b 必须为空，防止伪造绑定关系）
drop policy if exists "仅可创建自己的邀请码" on public.couple_relation;
create policy "仅可创建自己的邀请码" on public.couple_relation
  for insert with check (
    user_a_id = (select auth.uid()) and user_b_id is null and status = 'pending'
  );

-- 仅允许取消自己发出的待处理邀请
drop policy if exists "仅可取消自己的待处理邀请" on public.couple_relation;
create policy "仅可取消自己的待处理邀请" on public.couple_relation
  for delete using (
    user_a_id = (select auth.uid()) and status = 'pending'
  );

-- ⚠️ 注意：couple_relation 不开放 UPDATE 策略 ——
--    绑定（pending → active）与解绑（active → dissolved）全部通过上面
--    的 security definer RPC 完成，在函数内部做严格校验，杜绝直接改表越权。


-- ---------- notes 笔记表：私人笔记 ----------
-- 私人笔记：仅创建者本人可读 / 写 / 改 / 删，情侣另一方完全无法访问
drop policy if exists "私人笔记仅本人可读" on public.notes;
create policy "私人笔记仅本人可读" on public.notes
  for select using (note_type = 'private' and user_id = (select auth.uid()));

drop policy if exists "私人笔记仅本人可写" on public.notes;
create policy "私人笔记仅本人可写" on public.notes
  for insert with check (note_type = 'private' and user_id = (select auth.uid()));

drop policy if exists "私人笔记仅本人可改" on public.notes;
create policy "私人笔记仅本人可改" on public.notes
  for update using (note_type = 'private' and user_id = (select auth.uid()))
  with check (note_type = 'private' and user_id = (select auth.uid()));

drop policy if exists "私人笔记仅本人可删" on public.notes;
create policy "私人笔记仅本人可删" on public.notes
  for delete using (note_type = 'private' and user_id = (select auth.uid()));


-- ---------- notes 笔记表：共享笔记 ----------
-- 共享笔记：
--   1) 当前共享空间（couple_id = 自己所在的 active 关系）内的笔记，
--      绑定情侣双方都可读 / 写 / 改 / 删；
--   2) 自己亲手创建的共享笔记，即使解绑后也保留在自己账号下（创建者仍可见），
--      但对方与任何第三方都无法再访问。
drop policy if exists "共享笔记仅情侣双方可读" on public.notes;
create policy "共享笔记仅情侣双方可读" on public.notes
  for select using (
    note_type = 'shared'
    and (couple_id = public.current_couple_id()   -- 当前共享空间的笔记
         or user_id = (select auth.uid()))        -- 自己创建的笔记（解绑后仍保留）
  );

drop policy if exists "共享笔记仅情侣双方可写" on public.notes;
create policy "共享笔记仅情侣双方可写" on public.notes
  for insert with check (
    note_type = 'shared'
    and user_id = (select auth.uid())
    and couple_id = public.current_couple_id()    -- 必须写入当前共享空间
  );

drop policy if exists "共享笔记仅情侣双方可改" on public.notes;
create policy "共享笔记仅情侣双方可改" on public.notes
  for update
  using (
    note_type = 'shared'
    and (couple_id = public.current_couple_id() or user_id = (select auth.uid()))
  )
  with check (
    note_type = 'shared'
    and (couple_id = public.current_couple_id() or user_id = (select auth.uid()))
  );

drop policy if exists "共享笔记仅情侣双方可删" on public.notes;
create policy "共享笔记仅情侣双方可删" on public.notes
  for delete using (
    note_type = 'shared'
    and (couple_id = public.current_couple_id() or user_id = (select auth.uid()))
  );


-- ============================================================
-- 六、新用户自动建档触发器
-- ============================================================
-- 用户注册（写入 auth.users）后，自动在 public.users 创建扩展资料，
-- 昵称默认取邮箱前缀，后续可在设置页修改。
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, nickname)
  values (new.id, coalesce(split_part(new.email, '@', 1), '新用户'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 七、开启 Realtime 实时推送
-- ============================================================
-- notes 表：笔记变更后自动推送给有权限的用户（Realtime 会遵循 RLS ——
--          私人笔记只推给本人，共享笔记只推给绑定双方，不存在越权推送）
do $$
begin
  alter publication supabase_realtime add table public.notes;
exception
  when duplicate_object then null;  -- 已加入过则跳过，保证脚本可重复执行
end $$;

-- couple_relation 表：对方完成绑定 / 解绑时，本方页面自动刷新
do $$
begin
  alter publication supabase_realtime add table public.couple_relation;
exception
  when duplicate_object then null;
end $$;


-- ============================================================
-- 八、函数执行权限
-- ============================================================
grant execute on function public.generate_invite_code()   to authenticated;
grant execute on function public.redeem_invite_code(text) to authenticated;
grant execute on function public.unbind_couple()          to authenticated;
grant execute on function public.current_couple_id()      to authenticated, anon;

-- ============================================================
-- 完成 ✅
-- 下一步：在项目根目录创建 .env.local，填入
--   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
-- 然后启动应用即可（详见 README.md）
-- ============================================================
