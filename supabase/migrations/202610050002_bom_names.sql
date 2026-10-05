-- 202610050001_bom_categories.sqlの後に1回適用する。
begin;
create table public.bom_names (
 id uuid primary key default gen_random_uuid(), category_id uuid not null references public.bom_categories(id),
 name text not null check(length(btrim(name)) between 1 and 120), is_active boolean not null default true,
 unique(category_id,name)
);
insert into public.bom_names(category_id,name)
select '00000000-0000-4000-8000-000000000001'::uuid,name from unnest(array['PPパンチプレート','PBパンチバッキング','SPストリッパープレート','SBストリッパーバッキング','DPダイプレート','DB1ダイバッキング','DB2ダイバッキング','DB3ダイバッキング','DS1ダイセット','DS2ダイセット']) name;
insert into public.bom_names(category_id,name) select distinct category_id,name from public.bom_items on conflict(category_id,name) do nothing;
alter table public.bom_names enable row level security;
revoke all on public.bom_names from anon,authenticated;
grant select on public.bom_names to authenticated;
create policy member_read on public.bom_names for select to authenticated using ((select app_private.member_role()) is not null);

alter function public.manage_entity(text,jsonb,bigint) rename to manage_entity_before_names;
revoke all on function public.manage_entity_before_names(text,jsonb,bigint) from public,anon,authenticated;
create function public.manage_entity(entity text,payload jsonb,expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare target uuid; previous jsonb; category public.bom_categories; candidate text;
begin
 perform app_private.lock_revision(expected);
 if app_private.member_role()<>'admin' then raise exception '管理者のみ操作できます' using errcode='42501'; end if;
 if entity='bomName' then
  target:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
  select to_jsonb(n) into previous from public.bom_names n where id=target;
  if previous is not null and (previous->>'category_id')::uuid<>(payload->>'categoryId')::uuid then raise exception '名称の区分は変更できません。別区分へ新規登録してください'; end if;
  select * into category from public.bom_categories where id=(payload->>'categoryId')::uuid;
  if not found or (not category.is_active and previous is null) then raise exception '有効な区分を選択してください'; end if;
  insert into public.bom_names(id,category_id,name,is_active) values(target,category.id,btrim(payload->>'name'),coalesce((payload->>'active')::boolean,true))
  on conflict(id) do update set name=excluded.name,is_active=excluded.is_active;
  perform app_private.audit('bom_name',target,previous,(select to_jsonb(n) from public.bom_names n where id=target));
  update public.schedule_state set revision=revision+1 where id=true;
 elsif entity='bom' then
  select to_jsonb(b) into previous from public.bom_items b where id=nullif(payload->>'id','')::uuid;
  if not coalesce((payload->>'archived')::boolean,false) then
   select * into category from public.bom_categories where id=coalesce(nullif(payload->>'categoryId','')::uuid,(previous->>'category_id')::uuid,case payload->>'kind' when 'plate' then '00000000-0000-4000-8000-000000000001'::uuid else '00000000-0000-4000-8000-000000000002'::uuid end);
   candidate:=payload->>'name';
   if previous is null or previous->>'name'<>candidate or (previous->>'category_id')::uuid<>category.id then
    if not exists(select 1 from public.bom_names where category_id=category.id and name=candidate and is_active) then raise exception '区分の名称リストから選択してください'; end if;
    if category.kind='plate' and exists(select 1 from public.bom_items b where b.product_id=(payload->>'productId')::uuid and b.kind='plate' and b.name=candidate and not b.is_archived and b.id<>coalesce(nullif(payload->>'id','')::uuid,'00000000-0000-0000-0000-000000000000'::uuid)) then raise exception '同じ金型にこのプレートは登録済みです'; end if;
   end if;
  end if;
  return public.manage_entity_before_names(entity,payload,expected);
 else
  return public.manage_entity_before_names(entity,payload,expected);
 end if;
 return (select revision from public.schedule_state where id=true);
end $$;
revoke all on function public.manage_entity(text,jsonb,bigint) from public,anon;
grant execute on function public.manage_entity(text,jsonb,bigint) to authenticated;

alter function public.read_planning() rename to read_planning_before_names;
revoke all on function public.read_planning_before_names() from public,anon,authenticated;
create function public.read_planning() returns jsonb language sql stable security definer set search_path='' as $$
 select public.read_planning_before_names()||jsonb_build_object('bomNames',coalesce((select jsonb_agg(jsonb_build_object('id',id,'categoryId',category_id,'name',name,'active',is_active) order by name,id) from public.bom_names),'[]'::jsonb));
$$;
revoke all on function public.read_planning() from public,anon;
grant execute on function public.read_planning() to authenticated;

alter function public.seed_test_data(bigint) rename to seed_test_data_before_names;
revoke all on function public.seed_test_data_before_names(bigint) from public,anon,authenticated;
create function public.seed_test_data(expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 result:=public.seed_test_data_before_names(expected);
 insert into public.bom_names(category_id,name) select distinct category_id,name from public.bom_items on conflict(category_id,name) do nothing;
 return result;
end $$;
revoke all on function public.seed_test_data(bigint) from public,anon;
grant execute on function public.seed_test_data(bigint) to authenticated;
commit;
