begin;
create table public.bom_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(btrim(name)) between 1 and 120),
 kind text not null check(kind in ('plate','part')), is_active boolean not null default true
);
insert into public.bom_categories(id,name,kind) values
 ('00000000-0000-4000-8000-000000000001','プレート','plate'),
 ('00000000-0000-4000-8000-000000000002','パーツ','part');
alter table public.bom_items add column category_id uuid references public.bom_categories(id);
update public.bom_items set category_id=case kind when 'plate' then '00000000-0000-4000-8000-000000000001'::uuid else '00000000-0000-4000-8000-000000000002'::uuid end;
-- 既存シードRPCがcategory_idを省略する場合も、型に対応する初期区分を補う。
create function app_private.bom_category_consistency() returns trigger language plpgsql security definer set search_path='' as $$
declare category public.bom_categories;
begin
 if new.category_id is null then
  new.category_id:=case new.kind when 'plate' then '00000000-0000-4000-8000-000000000001'::uuid else '00000000-0000-4000-8000-000000000002'::uuid end;
 end if;
 select * into category from public.bom_categories where id=new.category_id;
 if not found or category.kind<>new.kind then raise exception '区分と入力形式が一致しません'; end if;
 return new;
end $$;
revoke all on function app_private.bom_category_consistency() from public,anon,authenticated;
create trigger bom_category_consistency before insert or update on public.bom_items for each row execute function app_private.bom_category_consistency();
alter table public.bom_categories enable row level security;
revoke all on public.bom_categories from anon,authenticated;
grant select on public.bom_categories to authenticated;
create policy member_read on public.bom_categories for select to authenticated using ((select app_private.member_role()) is not null);

alter function public.manage_entity(text,jsonb,bigint) rename to manage_entity_before_categories;
revoke all on function public.manage_entity_before_categories(text,jsonb,bigint) from public,anon,authenticated;
create function public.manage_entity(entity text,payload jsonb,expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare target uuid; previous jsonb; category public.bom_categories; result bigint;
begin
 perform app_private.lock_revision(expected);
 if app_private.member_role()<>'admin' then raise exception '管理者のみ操作できます' using errcode='42501'; end if;
 if entity='category' then
  target:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
  select to_jsonb(c) into previous from public.bom_categories c where id=target;
  if exists(select 1 from public.bom_items where category_id=target) and previous->>'kind'<>payload->>'kind' then raise exception '使用済み区分の型は変更できません'; end if;
  insert into public.bom_categories(id,name,kind,is_active) values(target,btrim(payload->>'name'),payload->>'kind',coalesce((payload->>'active')::boolean,true))
  on conflict(id) do update set name=excluded.name,kind=excluded.kind,is_active=excluded.is_active;
  perform app_private.audit('category',target,previous,(select to_jsonb(c) from public.bom_categories c where id=target));
  update public.schedule_state set revision=revision+1 where id=true returning revision into result;
  return result;
 elsif entity='bom' then
  target:=nullif(payload->>'id','')::uuid;
  select to_jsonb(b) into previous from public.bom_items b where id=target;
  select * into category from public.bom_categories where id=coalesce(nullif(payload->>'categoryId','')::uuid,(previous->>'category_id')::uuid,case payload->>'kind' when 'plate' then '00000000-0000-4000-8000-000000000001'::uuid else '00000000-0000-4000-8000-000000000002'::uuid end);
  if not found then raise exception '区分を選択してください'; end if;
  if not category.is_active and (previous is null or (previous->>'category_id')::uuid<>category.id) then raise exception '停止中の区分は新規選択できません'; end if;
  payload:=payload||jsonb_build_object('kind',category.kind);
  if target is null then target:=gen_random_uuid(); payload:=payload||jsonb_build_object('id',target); end if;
  -- 旧保存時のトリガーに新しい区分を渡すため、既存行の参照を先に変更する。
  if previous is not null then update public.bom_items set category_id=category.id,kind=category.kind,processes=case when category.kind='plate' then array['machining','grinding','wire','assembly','trial'] else processes end where id=target; end if;
  result:=public.manage_entity_before_categories(entity,payload,expected);
  update public.bom_items set category_id=category.id where id=target;
  perform app_private.audit('bom_category',target,previous,(select to_jsonb(b) from public.bom_items b where id=target));
  return result;
 end if;
 return public.manage_entity_before_categories(entity,payload,expected);
end $$;
revoke all on function public.manage_entity(text,jsonb,bigint) from public,anon;
grant execute on function public.manage_entity(text,jsonb,bigint) to authenticated;

alter function public.read_planning() rename to read_planning_before_categories;
revoke all on function public.read_planning_before_categories() from public,anon,authenticated;
create function public.read_planning() returns jsonb language sql stable security definer set search_path='' as $$
 select public.read_planning_before_categories()||jsonb_build_object(
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'active',is_active) order by name,id) from public.bom_categories),'[]'::jsonb),
 'bom',coalesce((select jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'categoryId',category_id,'name',name,'kind',kind,'quantity',quantity,'notes',notes,'processes',processes,'archived',is_archived) order by name,id) from public.bom_items),'[]'::jsonb));
$$;
revoke all on function public.read_planning() from public,anon;
grant execute on function public.read_planning() to authenticated;
commit;
