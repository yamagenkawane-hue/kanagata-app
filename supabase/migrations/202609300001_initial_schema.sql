-- 初期スキーマ。新規のSupabaseプロジェクトでSQL Editorから実行します。
-- 業務の更新RPCは後続実装です。この段階では認証済みメンバーの読取のみ許可します。
begin;
create schema if not exists app_private;
create table public.profiles (
  user_id uuid primary key references auth.users(id), display_name text not null check(length(display_name)>0),
  role text not null check(role in ('admin','operator')), is_active boolean not null default true,
  version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name))>0),
  customer_name text not null default '', due_date date not null, notes text not null default '', is_archived boolean not null default false,
  version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.parts (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  name text not null check(length(btrim(name))>0), quantity integer not null check(quantity>0), drawing_number text not null default '',
  version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.equipment (
  id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name))>0),
  process_code text not null check(process_code in ('machining','grinding','wire','assembly','trial')), is_active boolean not null default true,
  version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,process_code)
);
create table public.company_settings (
  id boolean primary key default true check(id), timezone text not null default 'Asia/Tokyo' check(timezone='Asia/Tokyo'),
  work_start time not null default '08:50', work_end time not null default '17:40', version bigint not null default 1,
  check(work_start<work_end)
);
create table public.company_breaks (
  id uuid primary key default gen_random_uuid(), start_time time not null, end_time time not null, version bigint not null default 1,
  check(start_time<end_time)
);
create table public.calendar_days (
  date date primary key, is_working boolean not null, label text not null default '', version bigint not null default 1
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), part_id uuid not null references public.parts(id),
  process_code text not null check(process_code in ('machining','grinding','wire','assembly','trial')),
  equipment_id uuid not null, assignee_id uuid not null references public.profiles(user_id),
  duration_minutes integer not null check(duration_minutes>0 and duration_minutes%30=0), requested_start timestamptz not null,
  planned_start timestamptz not null, planned_end timestamptz not null, priority_order integer not null check(priority_order>0),
  allow_break_run boolean not null default false, allow_overnight boolean not null default false, is_fixed boolean not null default false, is_manual_override boolean not null default false,
  status text not null default 'pending' check(status in ('pending','running','completed')), actual_start timestamptz, actual_end timestamptz,
  version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(part_id,process_code), foreign key(equipment_id,process_code) references public.equipment(id,process_code),
  check(planned_start<planned_end), check(not allow_overnight or process_code in ('machining','grinding','wire')),
  check(actual_end is null or (actual_start is not null and actual_start<actual_end)),
  check(status<>'completed' or actual_end is not null), check(status<>'running' or actual_start is not null)
);
create table public.task_segments (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id),
  start_at timestamptz not null, end_at timestamptz not null, check(start_at<end_at)
);
create table public.work_logs (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id), worker_id uuid not null references public.profiles(user_id),
  start_at timestamptz not null, end_at timestamptz not null, calculated_minutes integer not null check(calculated_minutes>=0),
  override_minutes integer check(override_minutes>=0), override_reason text not null default '', calendar_snapshot jsonb not null,
  created_by uuid not null references public.profiles(user_id), updated_by uuid not null references public.profiles(user_id),
  version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(start_at<end_at)
);
create table public.change_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(user_id), entity_type text not null,
  entity_id uuid not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create table public.schedule_state (
  id boolean primary key default true check(id), revision bigint not null default 1, needs_recalculation boolean not null default false
);
create table public.schedule_drafts (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(user_id), base_revision bigint not null,
  operation text not null check(operation in ('create','reorder','insert','manual','actual_recalculation')),
  source_task_id uuid references public.tasks(id), source_work_log_id uuid references public.work_logs(id),
  proposed_changes jsonb not null, warnings jsonb not null default '[]', expires_at timestamptz not null, committed_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_equipment_start on public.tasks(equipment_id,planned_start);
create index tasks_part on public.tasks(part_id,process_code);
create index segments_task on public.task_segments(task_id);
create index logs_task_start on public.work_logs(task_id,start_at);

-- profiles自身のRLSを再帰させず、有効なメンバーの役割だけを返します。
create function app_private.member_role() returns text language sql stable security definer set search_path='' as $$
  select p.role from public.profiles p where p.user_id=(select auth.uid()) and p.is_active;
$$;
revoke all on schema app_private from public,anon;
grant usage on schema app_private to authenticated;
revoke all on function app_private.member_role() from public,anon;
grant execute on function app_private.member_role() to authenticated;

do $$ declare item text; begin
  foreach item in array array['profiles','products','parts','equipment','company_settings','company_breaks','calendar_days','tasks','task_segments','work_logs','change_logs','schedule_state','schedule_drafts'] loop
    execute format('alter table public.%I enable row level security',item);
    execute format('revoke all on public.%I from anon,authenticated',item);
    execute format('grant select on public.%I to authenticated',item);
    if item in ('change_logs','schedule_drafts') then
      execute format('create policy member_read on public.%I for select to authenticated using ((select app_private.member_role())=''admin'')',item);
    else
      execute format('create policy member_read on public.%I for select to authenticated using ((select app_private.member_role()) is not null)',item);
    end if;
  end loop;
end $$;
insert into public.company_settings(id) values(true);
insert into public.company_breaks(start_time,end_time) values('12:00','12:50'),('15:00','15:10');
insert into public.schedule_state(id) values(true);
commit;

-- Auth Usersにアカウントを作成した後、実際のUUIDと氏名を使いSQL Editorでprofilesへ登録してください。
-- 例（コメントのままです。UUIDを置き換えてから実行）:
-- insert into public.profiles(user_id,display_name,role) values('実際のAuth User UUID','管理者名','admin');
-- 一般担当者はrole='operator'。クライアントからの役割変更は許可しません。

