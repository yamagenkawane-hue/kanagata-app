-- Apply after 202610070001_trial_next_day.sql. Existing plans and logs are preserved.
begin;
create table public.process_definitions (
 code text primary key, name text not null unique check(length(btrim(name)) between 1 and 120),
 sort_order integer not null unique, is_active boolean not null default true,
 color text not null default '#527c87', tint text not null default '#e3eff2'
);
insert into public.process_definitions(code,name,sort_order,color,tint) values
 ('machining','マシニング',10,'#d4a23b','#fff2ca'),
 ('grinding','自動研磨',20,'#38a578','#dbf3e5'),
 ('wire','ワイヤー',30,'#358cb2','#dcf0fa'),
 ('assembly','型組',1000003,'#8772bb','#ece5fa'),
 ('trial','トライ',1000004,'#d1785b','#fae5dc');
alter table public.process_definitions enable row level security;
revoke all on public.process_definitions from public,anon,authenticated;
grant select on public.process_definitions to authenticated;
create policy member_read on public.process_definitions for select to authenticated using ((select app_private.member_role()) is not null);
alter table public.equipment drop constraint equipment_process_code_check;
alter table public.tasks drop constraint tasks_process_code_check;
alter table public.equipment add constraint equipment_process_definition_fk foreign key(process_code) references public.process_definitions(code);
alter table public.tasks add constraint tasks_process_definition_fk foreign key(process_code) references public.process_definitions(code);
alter table public.bom_items drop constraint bom_items_processes_check;
alter table public.bom_items drop constraint bom_items_plate_processes_check;
alter table public.bom_items add constraint bom_items_processes_check check((is_archived or cardinality(processes)>0) and not processes && array['assembly','trial']::text[]);
alter table public.bom_items add constraint bom_items_plate_processes_check check(kind<>'plate' or array['machining','grinding','wire']::text[] <@ processes);

create function app_private.process_order() returns text[] language sql stable security definer set search_path='' as $$
 select array_agg(code order by sort_order,code) from public.process_definitions;
$$;
revoke all on function app_private.process_order() from public,anon,authenticated;

create or replace function app_private.bom_processing_only() returns trigger language plpgsql security definer set search_path='' as $$
declare selected text[];
begin
 selected:=array(select distinct code from unnest(new.processes) code where code not in ('assembly','trial'));
 if new.kind='plate' then selected:=array(select distinct code from unnest(selected||array['machining','grinding','wire']) code); end if;
 if exists(select 1 from unnest(selected) as chosen(process_code) where not exists(select 1 from public.process_definitions p where p.code=chosen.process_code and (p.is_active or (tg_op='UPDATE' and chosen.process_code=any(old.processes))))) then raise exception '有効な登録済み工程を選択してください'; end if;
 new.processes:=array(select p.code from public.process_definitions p where p.code=any(selected) order by p.sort_order,p.code);
 return new;
end $$;
revoke all on function app_private.bom_processing_only() from public,anon,authenticated;

-- Retain the original CRUD checks, name catalog validation, audit and revision lock.
-- Only replace the fixed process-order expressions in the underlying routines.
do $$ declare definition text;
begin
 definition:=pg_get_functiondef('public.manage_entity_before_categories(text,jsonb,bigint)'::regprocedure);
 if position('unnest(array[''machining'',''grinding'',''wire'',''assembly'',''trial''])' in definition)=0 then raise exception '管理RPCの事前SQLを確認してください'; end if;
 definition:=replace(definition,'unnest(array[''machining'',''grinding'',''wire'',''assembly'',''trial''])','unnest(app_private.process_order())');
 definition:=replace(definition,'selected_processes:=array[''machining'',''grinding'',''wire'',''assembly'',''trial''];','selected_processes:=array(select p.code from public.process_definitions p where p.code in (''machining'',''grinding'',''wire'') or (p.code not in (''assembly'',''trial'') and (payload->''processes'') ? p.code) order by p.sort_order);');
 execute definition;
 definition:=pg_get_functiondef('public.manage_entity_before_names(text,jsonb,bigint)'::regprocedure);
 definition:=replace(definition,'then array[''machining'',''grinding'',''wire'',''assembly'',''trial''] else processes end','then processes||array[''machining'',''grinding'',''wire''] else processes end');
 execute definition;
 definition:=pg_get_functiondef('public.commit_plan_before_trial_next_day(jsonb,bigint,boolean)'::regprocedure);
 if position('array_position(array[''machining'',''grinding'',''wire'',''assembly'',''trial'']' in definition)=0 then raise exception '予定RPCの事前SQLを確認してください'; end if;
 definition:=replace(definition,'array_position(array[''machining'',''grinding'',''wire'',''assembly'',''trial''],','array_position(app_private.process_order(),');
 definition:=replace(definition,'v.process_code in (''machining'',''grinding'',''wire'')','v.process_code not in (''assembly'',''trial'')');
 definition:=replace(definition,'v.process_code in (''machining'',''grinding'',''wire'',''assembly'')','v.process_code<>''trial''');
 execute definition;
end $$;

alter function public.manage_entity(text,jsonb,bigint) rename to manage_entity_before_custom_processes;
revoke all on function public.manage_entity_before_custom_processes(text,jsonb,bigint) from public,anon,authenticated;
create function public.manage_entity(entity text,payload jsonb,expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare target uuid; process_code_value text; previous jsonb; next_order integer; result bigint;
begin
 if entity<>'process' then
  -- Reject unknown codes before the legacy CRUD normalization can silently omit them.
  if entity='bom' and exists(select 1 from jsonb_array_elements_text(payload->'processes') as chosen(process_code) where not exists(select 1 from public.process_definitions p where p.code=chosen.process_code and p.code not in ('assembly','trial'))) then raise exception '未登録またはBOM対象外の工程です'; end if;
  return public.manage_entity_before_custom_processes(entity,payload,expected);
 end if;
 perform app_private.lock_revision(expected);
 if app_private.member_role()<>'admin' then raise exception '管理者のみ操作できます' using errcode='42501'; end if;
 target:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 process_code_value:='custom_'||target::text;
 select to_jsonb(p) into previous from public.process_definitions p where code=process_code_value;
 if payload->>'id' is not null and previous is null then raise exception '登録済みの追加工程を選択してください'; end if;
 select coalesce(max(sort_order),30)+10 into next_order from public.process_definitions where code not in ('assembly','trial');
 if next_order>=1000003 then raise exception '追加工程の上限です'; end if;
 insert into public.process_definitions(code,name,sort_order,is_active)
 values(process_code_value,btrim(payload->>'name'),next_order,coalesce((payload->>'active')::boolean,true))
 on conflict(code) do update set name=excluded.name,is_active=excluded.is_active;
 -- One resource is created together with the new process; the form only asks for a name.
 result:=public.manage_entity_before_custom_processes('equipment',jsonb_build_object('id',target,'name',btrim(payload->>'name'),'process',process_code_value,'active',coalesce((payload->>'active')::boolean,true)),expected);
 perform app_private.audit('process',target,previous,(select to_jsonb(p) from public.process_definitions p where code=process_code_value));
 return result;
end $$;
revoke all on function public.manage_entity(text,jsonb,bigint) from public,anon;
grant execute on function public.manage_entity(text,jsonb,bigint) to authenticated;

alter function public.read_planning() rename to read_planning_before_custom_processes;
revoke all on function public.read_planning_before_custom_processes() from public,anon,authenticated;
create function public.read_planning() returns jsonb language sql stable security definer set search_path='' as $$
 select public.read_planning_before_custom_processes()||jsonb_build_object('processes',coalesce((select jsonb_agg(jsonb_build_object('code',code,'name',name,'order',sort_order,'active',is_active,'color',color,'tint',tint) order by sort_order,code) from public.process_definitions),'[]'::jsonb));
$$;
revoke all on function public.read_planning() from public,anon;
grant execute on function public.read_planning() to authenticated;
update public.schedule_state set revision=revision+1,needs_recalculation=true where id=true;
commit;
