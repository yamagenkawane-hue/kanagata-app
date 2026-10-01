-- 0001を適用した後に実行。既存データを削除しない。
begin;
create table public.bom_items (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
 name text not null check(length(btrim(name)) between 1 and 120), kind text not null check(kind in ('plate','part')),
 quantity integer not null check(quantity>0), notes text not null default '', processes text[] not null,
 is_archived boolean not null default false,
 check(cardinality(processes)>0 and processes <@ array['machining','grinding','wire','assembly','trial']::text[]),
 check(kind<>'plate' or processes=array['machining','grinding','wire','assembly','trial']::text[])
);
alter table public.parts add column bom_id uuid references public.bom_items(id), add column required_processes text[], add column is_archived boolean not null default false;
alter table public.work_logs add column is_deleted boolean not null default false;
alter table public.bom_items enable row level security;
revoke all on public.bom_items from anon,authenticated;
grant select on public.bom_items to authenticated;
create policy member_read on public.bom_items for select to authenticated using ((select app_private.member_role()) is not null);

create function app_private.lock_revision(expected bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if app_private.member_role() is null then raise exception '有効な利用者ではありません' using errcode='42501'; end if;
 perform 1 from public.schedule_state where id=true and revision=expected for update;
 if not found then raise exception '他の利用者が更新しました。再読み込みしてください' using errcode='40001'; end if;
end $$;
create function app_private.audit(kind text, target uuid, before_value jsonb, after_value jsonb) returns void language sql security definer set search_path='' as $$
 insert into public.change_logs(actor_id,entity_type,entity_id,before_data,after_data) values(auth.uid(),kind,target,before_value,after_value);
$$;
revoke all on function app_private.lock_revision(bigint),app_private.audit(text,uuid,jsonb,jsonb) from public,anon,authenticated;

create function app_private.normalize_priorities() returns void language sql security definer set search_path='' as $$
 update public.tasks t set priority_order=q.rank from (select a.id,row_number() over(partition by a.equipment_id order by a.priority_order,a.id)::integer rank from public.tasks a join public.parts p on p.id=a.part_id join public.products x on x.id=p.product_id where a.status='pending' and not p.is_archived and not x.is_archived) q where t.id=q.id;
$$;
revoke all on function app_private.normalize_priorities() from public,anon,authenticated;
create function public.manage_entity(entity text, payload jsonb, expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare target uuid; old_value jsonb; selected_processes text[]; r bigint;
begin
 perform app_private.lock_revision(expected);
 if app_private.member_role()<>'admin' then raise exception '管理者のみ操作できます' using errcode='42501'; end if;
 target:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if entity='product' then
  select to_jsonb(p) into old_value from public.products p where id=target;
  insert into public.products(id,name,customer_name,due_date,notes,is_archived) values(target,payload->>'name',coalesce(payload->>'customer',''),(payload->>'dueDate')::date,coalesce(payload->>'notes',''),coalesce((payload->>'archived')::boolean,false))
  on conflict(id) do update set name=excluded.name,customer_name=excluded.customer_name,due_date=excluded.due_date,notes=excluded.notes,is_archived=excluded.is_archived,version=public.products.version+1,updated_at=now();
 elsif entity='bom' then
  select to_jsonb(b) into old_value from public.bom_items b where id=target;
  select array_agg(p order by pos) into selected_processes from unnest(array['machining','grinding','wire','assembly','trial']) with ordinality as s(p,pos) where (payload->'processes') ? p;
  if (payload->>'kind')='plate' then selected_processes:=array['machining','grinding','wire','assembly','trial']; end if;
  if old_value is not null and (old_value->>'product_id')::uuid<>(payload->>'productId')::uuid then raise exception 'BOMの所属金型は変更できません'; end if;
  if (payload->>'quantity')::integer < (select coalesce(sum(quantity),0) from public.parts where bom_id=target and not is_archived) then raise exception '必要数量は登録済み数量以上にしてください'; end if;
  if not exists(select 1 from public.products where id=(payload->>'productId')::uuid and not is_archived) then raise exception '有効な金型を選択してください'; end if;
  insert into public.bom_items(id,product_id,name,kind,quantity,notes,processes,is_archived) values(target,(payload->>'productId')::uuid,payload->>'name',payload->>'kind',(payload->>'quantity')::integer,coalesce(payload->>'notes',''),selected_processes,coalesce((payload->>'archived')::boolean,false))
  on conflict(id) do update set name=excluded.name,kind=excluded.kind,quantity=excluded.quantity,notes=excluded.notes,processes=excluded.processes,is_archived=excluded.is_archived;
 elsif entity='equipment' then
  select to_jsonb(e) into old_value from public.equipment e where id=target;
  if exists(select 1 from public.tasks where equipment_id=target) and old_value->>'process_code'<>payload->>'process' then raise exception '使用済み設備の工程は変更できません'; end if;
  if not coalesce((payload->>'active')::boolean,true) and exists(select 1 from public.tasks t join public.parts p on p.id=t.part_id join public.products x on x.id=p.product_id where t.equipment_id=target and t.status<>'completed' and not p.is_archived and not x.is_archived) then raise exception '未完了の予定がある設備は停止できません'; end if;
  insert into public.equipment(id,name,process_code,is_active) values(target,payload->>'name',payload->>'process',coalesce((payload->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,process_code=excluded.process_code,is_active=excluded.is_active;
 elsif entity='part' then
  select to_jsonb(p) into old_value from public.parts p where id=target;
  if old_value is null then raise exception '製作ロットがありません'; end if;
  if coalesce((payload->>'archived')::boolean,false) and exists(select 1 from public.tasks where part_id=target and status<>'pending') then raise exception '作業中・完了済みロットは取消できません'; end if;
  if (payload->>'quantity')::integer<>(old_value->>'quantity')::integer then raise exception '製作数量は登録後に変更できません。未着手ロットを取り消して再登録してください'; end if;
  update public.parts set name=payload->>'name',is_archived=coalesce((payload->>'archived')::boolean,false) where id=target;
  if exists(select 1 from public.bom_items b where b.id=(old_value->>'bom_id')::uuid and b.quantity<(select coalesce(sum(quantity),0) from public.parts where bom_id=b.id and not is_archived)) then raise exception 'BOM必要数量を超えています'; end if;
 elsif entity='user' then
  select to_jsonb(p) into old_value from public.profiles p where user_id=target;
  if old_value is null then
   insert into public.profiles(user_id,display_name,role,is_active) values(target,payload->>'name',payload->>'role',(payload->>'active')::boolean);
  end if;
  if old_value->>'role'='admin' and (payload->>'role'<>'admin' or not (payload->>'active')::boolean) and (select count(*) from public.profiles where role='admin' and is_active)<=1 then raise exception '最後の管理者は降格・停止できません'; end if;
  if not (payload->>'active')::boolean and exists(select 1 from public.tasks t join public.parts p on p.id=t.part_id join public.products x on x.id=p.product_id where t.assignee_id=target and t.status<>'completed' and not p.is_archived and not x.is_archived) then raise exception '未完了の担当予定があります'; end if;
  update public.profiles set display_name=payload->>'name',role=payload->>'role',is_active=(payload->>'active')::boolean where user_id=target;
 elsif entity='calendar' then
  for old_value in select value from jsonb_array_elements(payload->'days') loop
   insert into public.calendar_days(date,is_working,label) values((old_value->>'date')::date,(old_value->>'working')::boolean,coalesce(old_value->>'label','')) on conflict(date) do update set is_working=excluded.is_working,label=excluded.label;
  end loop;
 else raise exception '操作対象が不正です'; end if;
 perform app_private.normalize_priorities();
 perform app_private.audit(entity,target,old_value,payload);
 update public.schedule_state set revision=revision+1,needs_recalculation=true where id=true returning revision into r;
 return r;
end $$;

create function public.commit_plan(payload jsonb, expected bigint, accept_overlap boolean default false) returns bigint language plpgsql security definer set search_path='' as $$
declare item jsonb; seg jsonb; b public.bom_items; old_task public.tasks; part_row public.parts; r bigint; required text[];
begin
 perform app_private.lock_revision(expected);
 if app_private.member_role()<>'admin' then raise exception '管理者のみ操作できます' using errcode='42501'; end if;
 for item in select value from jsonb_array_elements(payload->'parts') loop
  if not exists(select 1 from public.parts where id=(item->>'id')::uuid) then
   select * into b from public.bom_items where id=(item->>'bomId')::uuid and not is_archived;
   if not found or b.product_id<>(item->>'productId')::uuid then raise exception 'BOM項目が不正です'; end if;
   if not exists(select 1 from public.products where id=b.product_id and not is_archived) then raise exception '金型が非表示です'; end if;
   insert into public.parts(id,product_id,name,quantity,bom_id,required_processes) values((item->>'id')::uuid,b.product_id,b.name,(item->>'quantity')::integer,b.id,b.processes);
   if b.quantity<(select coalesce(sum(quantity),0) from public.parts where bom_id=b.id and not is_archived) then raise exception 'BOM必要数量を超えています'; end if;
  end if;
 end loop;
 for item in select value from jsonb_array_elements(payload->'tasks') loop
  select * into old_task from public.tasks where id=(item->>'id')::uuid;
  select * into part_row from public.parts where id=(item->>'partId')::uuid and not is_archived;
  if not found then raise exception '有効な製作ロットを選択してください'; end if;
  if date_trunc('minute',(item->>'plannedStart')::timestamptz)<>(item->>'plannedStart')::timestamptz or date_trunc('minute',(item->>'plannedEnd')::timestamptz)<>(item->>'plannedEnd')::timestamptz then raise exception '予定時刻は1分単位で入力してください'; end if;
  required:=coalesce(part_row.required_processes,array['machining','grinding','wire','assembly','trial']);
  if not (item->>'process'=any(required)) then raise exception '対象外の工程です'; end if;
  if old_task.id is not null and (old_task.part_id<>part_row.id or old_task.process_code<>item->>'process') then raise exception '所属は変更できません'; end if;
  if old_task.id is not null and (old_task.status<>'pending' or old_task.is_fixed) then
   if old_task.planned_start<>(item->>'plannedStart')::timestamptz or old_task.planned_end<>(item->>'plannedEnd')::timestamptz or old_task.equipment_id<>(item->>'equipmentId')::uuid or old_task.duration_minutes<>(item->>'duration')::integer or old_task.assignee_id<>(item->>'workerId')::uuid then
    if old_task.status<>'pending' or coalesce((item->>'fixed')::boolean,false) then raise exception '作業中・完了済み・固定予定は維持してください'; end if;
   end if;
  end if;
  if old_task.id is not null and old_task.status<>'pending' then continue; end if;
  if not exists(select 1 from public.equipment where id=(item->>'equipmentId')::uuid and is_active and process_code=item->>'process') and (old_task.id is null or old_task.equipment_id<>(item->>'equipmentId')::uuid) then raise exception '有効な設備を選択してください'; end if;
  if not exists(select 1 from public.profiles where user_id=(item->>'workerId')::uuid and is_active) and (old_task.id is null or old_task.assignee_id<>(item->>'workerId')::uuid) then raise exception '有効な担当者を選択してください'; end if;
  insert into public.tasks(id,part_id,process_code,equipment_id,assignee_id,duration_minutes,requested_start,planned_start,planned_end,priority_order,allow_break_run,allow_overnight,is_fixed,is_manual_override)
  values((item->>'id')::uuid,part_row.id,item->>'process',(item->>'equipmentId')::uuid,(item->>'workerId')::uuid,(item->>'duration')::integer,(item->>'earliestStart')::timestamptz,(item->>'plannedStart')::timestamptz,(item->>'plannedEnd')::timestamptz,(item->>'priority')::integer,(item->>'breakRun')::boolean,(item->>'overnight')::boolean,(item->>'fixed')::boolean,coalesce((item->>'manualOverride')::boolean,false))
  on conflict(id) do update set equipment_id=excluded.equipment_id,assignee_id=excluded.assignee_id,duration_minutes=excluded.duration_minutes,requested_start=excluded.requested_start,planned_start=excluded.planned_start,planned_end=excluded.planned_end,priority_order=excluded.priority_order,allow_break_run=excluded.allow_break_run,allow_overnight=excluded.allow_overnight,is_fixed=excluded.is_fixed,is_manual_override=excluded.is_manual_override;
  if jsonb_array_length(item->'segments')=0 then raise exception '稼働区間がありません'; end if;
  if (select sum(extract(epoch from ((value->>'end')::timestamptz-(value->>'start')::timestamptz))/60) from jsonb_array_elements(item->'segments'))<>(item->>'duration')::integer then raise exception '所要時間と稼働区間が一致しません'; end if;
  delete from public.task_segments where task_id=(item->>'id')::uuid;
  for seg in select value from jsonb_array_elements(item->'segments') loop
   if (seg->>'start')::timestamptz<(item->>'plannedStart')::timestamptz or (seg->>'end')::timestamptz>(item->>'plannedEnd')::timestamptz then raise exception '稼働区間が予定範囲外です'; end if;
   insert into public.task_segments(task_id,start_at,end_at) values((item->>'id')::uuid,(seg->>'start')::timestamptz,(seg->>'end')::timestamptz);
  end loop;
 end loop;
 if exists(select 1 from public.parts p join public.products x on x.id=p.product_id where not p.is_archived and not x.is_archived and (select count(*) from public.tasks t where t.part_id=p.id)<>cardinality(coalesce(p.required_processes,array['machining','grinding','wire','assembly','trial']))) then raise exception '必要工程をすべて登録してください'; end if;
 if exists(select 1 from public.tasks t join public.parts p on p.id=t.part_id where not p.is_archived and t.status='pending' and t.planned_start < (select max(coalesce(case when v.status='completed' then v.actual_end end,v.planned_end)) from public.tasks v where v.part_id=t.part_id and array_position(array['machining','grinding','wire','assembly','trial'],v.process_code)<array_position(array['machining','grinding','wire','assembly','trial'],t.process_code))) then raise exception '先行工程より前に開始できません'; end if;
 if not accept_overlap and exists(with occupied as (select t.id,t.equipment_id,o.start_at,o.end_at from public.tasks t join public.parts p on p.id=t.part_id join public.products x on x.id=p.product_id cross join lateral (select t.actual_start start_at,t.actual_end end_at where t.status='completed' and t.actual_start is not null and t.actual_end is not null union all select s.start_at,s.end_at from public.task_segments s where s.task_id=t.id and t.status<>'completed') o where not p.is_archived and not x.is_archived) select 1 from occupied a join occupied occupied_other on a.id<occupied_other.id and a.equipment_id=occupied_other.equipment_id and a.start_at<occupied_other.end_at and occupied_other.start_at<a.end_at) then raise exception '設備重複を確認してください'; end if;
 perform app_private.normalize_priorities();
 perform app_private.audit('plan',gen_random_uuid(),null,payload);
 update public.schedule_state set revision=revision+1,needs_recalculation=false where id=true returning revision into r;
 return r;
end $$;

create function public.save_actual(payload jsonb, expected bigint, remove_log boolean default false) returns bigint language plpgsql security definer set search_path='' as $$
declare target uuid; task_id_value uuid; old_value jsonb; start_value timestamptz; end_value timestamptz; snapshot jsonb; day_value date; br jsonb; deducted numeric:=0; calc integer; r bigint; state text;
begin
 perform app_private.lock_revision(expected);
 target:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 select to_jsonb(w) into old_value from public.work_logs w where id=target and not is_deleted;
 task_id_value:=coalesce((old_value->>'task_id')::uuid,(payload->>'taskId')::uuid);
 if not exists(select 1 from public.tasks t join public.parts p on p.id=t.part_id join public.products x on x.id=p.product_id where t.id=task_id_value and not p.is_archived and not x.is_archived) then raise exception '有効な工程を選択してください'; end if;
 if remove_log then
  if app_private.member_role()<>'admin' then raise exception '実績削除は管理者のみです' using errcode='42501'; end if;
  if old_value is null then raise exception '実績がありません'; end if;
  update public.work_logs set is_deleted=true,updated_by=auth.uid(),updated_at=now() where id=target;
  state:=case when exists(select 1 from public.work_logs where task_id=task_id_value and not is_deleted) then 'running' else 'pending' end;
 else
  start_value:=(payload->>'start')::timestamptz; end_value:=(payload->>'end')::timestamptz;
  if date_trunc('minute',start_value)<>start_value or date_trunc('minute',end_value)<>end_value then raise exception '時刻は1分単位で入力してください'; end if;
  if start_value>=end_value or end_value-start_value>interval '31 days' then raise exception '実績は開始より後、31日以内で入力してください'; end if;
  if old_value is not null and (payload->>'taskId')::uuid<>task_id_value then raise exception '実績の所属工程は変更できません'; end if;
  if not exists(select 1 from public.profiles where user_id=(payload->>'workerId')::uuid and is_active) then raise exception '有効な作業者を選択してください'; end if;
  if not coalesce((payload->>'acceptOverlap')::boolean,false) and exists(select 1 from public.work_logs where not is_deleted and id<>target and worker_id=(payload->>'workerId')::uuid and start_at<end_value and start_value<end_at) then raise exception '作業者の実績重複を確認してください'; end if;
  snapshot:=coalesce(old_value->'calendar_snapshot',jsonb_build_array(jsonb_build_array(720,770),jsonb_build_array(900,910)));
  for day_value in select d::date from generate_series((start_value at time zone 'Asia/Tokyo')::date::timestamp,(end_value at time zone 'Asia/Tokyo')::date::timestamp,interval '1 day') d loop
   for br in select value from jsonb_array_elements(snapshot) loop
    deducted:=deducted+greatest(0,extract(epoch from (least(end_value,(day_value::timestamp+((br->>1)::integer)*interval '1 minute') at time zone 'Asia/Tokyo')-greatest(start_value,(day_value::timestamp+((br->>0)::integer)*interval '1 minute') at time zone 'Asia/Tokyo')))/60);
   end loop;
  end loop;
  calc:=floor(extract(epoch from(end_value-start_value))/60-deducted);
  state:=payload->>'status'; if state not in ('pending','running','completed') then raise exception '状態が不正です'; end if;
  insert into public.work_logs(id,task_id,worker_id,start_at,end_at,calculated_minutes,override_minutes,override_reason,calendar_snapshot,created_by,updated_by)
  values(target,task_id_value,(payload->>'workerId')::uuid,start_value,end_value,calc,nullif(payload->>'overrideMinutes','')::integer,coalesce(payload->>'reason',''),snapshot,auth.uid(),auth.uid())
  on conflict(id) do update set worker_id=excluded.worker_id,start_at=excluded.start_at,end_at=excluded.end_at,calculated_minutes=excluded.calculated_minutes,override_minutes=excluded.override_minutes,override_reason=excluded.override_reason,updated_by=auth.uid(),updated_at=now();
 end if;
 update public.tasks set status=state,actual_start=(select min(start_at) from public.work_logs where task_id=task_id_value and not is_deleted),actual_end=case when state='completed' then (select max(end_at) from public.work_logs where task_id=task_id_value and not is_deleted) end where id=task_id_value;
 perform app_private.normalize_priorities();
 perform app_private.audit('actual',target,old_value,case when remove_log then jsonb_build_object('deleted',true) else payload end);
 update public.schedule_state set revision=revision+1,needs_recalculation=true where id=true returning revision into r;
 return r;
end $$;

create function public.seed_test_data(expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare product_id_value uuid; bom_id_value uuid; r bigint; p text; i integer; b record; part_value uuid; task_value uuid; equipment_value uuid; day_value date; start_value timestamptz; end_value timestamptz; parts_value jsonb:='[]'; tasks_value jsonb:='[]';
begin
 perform app_private.lock_revision(expected);
 if app_private.member_role()<>'admin' then raise exception '管理者のみ操作できます' using errcode='42501'; end if;
 if exists(select 1 from public.products where notes='KPLAN_TEST_SEED_V1') then raise exception 'テストデータは登録済みです'; end if;
 foreach p in array array['machining','grinding','wire','assembly','trial'] loop
  for i in 1..(case when p='wire' then 4 when p in ('machining','grinding') then 2 else 1 end) loop
   insert into public.equipment(name,process_code) select 'テスト-'||p||'-'||i,p where not exists(select 1 from public.equipment where name='テスト-'||p||'-'||i);
  end loop;
 end loop;
 for i in 1..2 loop
  insert into public.products(name,customer_name,due_date,notes) values('テスト金型-'||i,'テスト取引先',(now() at time zone 'Asia/Tokyo')::date+14,'KPLAN_TEST_SEED_V1') returning id into product_id_value;
  insert into public.bom_items(product_id,name,kind,quantity,notes,processes) values(product_id_value,'パンチプレート','plate',1,'テスト',array['machining','grinding','wire','assembly','trial']);
  insert into public.bom_items(product_id,name,kind,quantity,notes,processes) values(product_id_value,'ガイド部品','part',4,'分割登録確認用',array['machining','wire','assembly']);
 end loop;
 insert into public.calendar_days(date,is_working,label) select d::date,extract(isodow from d)<6,'テストカレンダー' from generate_series((now() at time zone 'Asia/Tokyo')::date::timestamp,((now() at time zone 'Asia/Tokyo')::date+180)::timestamp,interval '1 day') d on conflict(date) do nothing;

 day_value:=(now() at time zone 'Asia/Tokyo')::date;
 for b in select bi.* from public.bom_items bi join public.products x on x.id=bi.product_id where x.notes='KPLAN_TEST_SEED_V1' and bi.kind='plate' order by bi.id loop
  select min(date) into day_value from public.calendar_days where date>day_value and is_working;
  if day_value is null then raise exception 'テスト用稼働日がありません'; end if;
  part_value:=gen_random_uuid();
  parts_value:=parts_value||jsonb_build_array(jsonb_build_object('id',part_value,'productId',b.product_id,'bomId',b.id,'name',b.name,'quantity',1));
  i:=0;
  foreach p in array b.processes loop
   i:=i+1; task_value:=gen_random_uuid();
   select id into equipment_value from public.equipment where name='テスト-'||p||'-1';
   start_value:=(day_value::timestamp+(array[530,590,650,770,830])[i]*interval '1 minute') at time zone 'Asia/Tokyo'; end_value:=start_value+interval '60 minutes';
   tasks_value:=tasks_value||jsonb_build_array(jsonb_build_object('id',task_value,'partId',part_value,'process',p,'equipmentId',equipment_value,'workerId',auth.uid(),'duration',60,'earliestStart',start_value,'plannedStart',start_value,'plannedEnd',end_value,'priority',jsonb_array_length(parts_value),'breakRun',false,'overnight',false,'fixed',false,'status','pending','segments',jsonb_build_array(jsonb_build_object('start',start_value,'end',end_value))));
  end loop;
 end loop;
 perform public.commit_plan(jsonb_build_object('parts',parts_value,'tasks',tasks_value),expected,false);
 perform app_private.audit('seed',gen_random_uuid(),null,jsonb_build_object('marker','KPLAN_TEST_SEED_V1'));
 update public.schedule_state set revision=revision+1 where id=true returning revision into r;
 return r;
end $$;
revoke all on function public.manage_entity(text,jsonb,bigint), public.commit_plan(jsonb,bigint,boolean),public.save_actual(jsonb,bigint,boolean),public.seed_test_data(bigint) from public,anon;
grant execute on function public.manage_entity(text,jsonb,bigint),public.commit_plan(jsonb,bigint,boolean),public.save_actual(jsonb,bigint,boolean),public.seed_test_data(bigint) to authenticated;
-- 読み取りも1 SQL内で整合したスナップショットにする。
create function public.read_planning() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if app_private.member_role() is null then raise exception '有効な利用者ではありません' using errcode='42501'; end if;
 select jsonb_build_object(
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'customer',customer_name,'dueDate',due_date,'notes',notes,'archived',is_archived) order by created_at,id) from public.products),'[]'::jsonb),
  'bom',coalesce((select jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'name',name,'kind',kind,'quantity',quantity,'notes',notes,'processes',processes,'archived',is_archived) order by name,id) from public.bom_items),'[]'::jsonb),
  'parts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'bomId',bom_id,'name',name,'quantity',quantity,'drawingNumber',drawing_number,'processes',coalesce(required_processes,array['machining','grinding','wire','assembly','trial']),'archived',is_archived) order by created_at,id) from public.parts),'[]'::jsonb),
  'equipment',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'process',process_code,'active',is_active) order by name,id) from public.equipment),'[]'::jsonb),
  'workers',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'name',display_name,'role',role,'active',is_active) order by display_name,user_id) from public.profiles),'[]'::jsonb),
  'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'partId',part_id,'process',process_code,'equipmentId',equipment_id,'workerId',assignee_id,'duration',duration_minutes,'earliestStart',requested_start,'plannedStart',planned_start,'plannedEnd',planned_end,'priority',priority_order,'breakRun',allow_break_run,'overnight',allow_overnight,'fixed',is_fixed,'manualOverride',is_manual_override,'status',status,'actualStart',actual_start,'actualEnd',actual_end,'segments',coalesce((select jsonb_agg(jsonb_build_object('start',start_at,'end',end_at) order by start_at) from public.task_segments s where s.task_id=t.id),'[]'::jsonb))) from public.tasks t),'[]'::jsonb),
  'logs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'taskId',task_id,'workerId',worker_id,'start',start_at,'end',end_at,'calculatedMinutes',calculated_minutes,'overrideMinutes',override_minutes,'reason',override_reason,'breaks',calendar_snapshot,'editedBy',updated_by)) from public.work_logs where not is_deleted),'[]'::jsonb),
  'calendar',coalesce((select jsonb_object_agg(date::text,is_working) from public.calendar_days),'{}'::jsonb),
  'today',(now() at time zone 'Asia/Tokyo')::date,'revision',revision,'needsRecalculation',needs_recalculation
 ) into result from public.schedule_state where id=true;
 return result;
end $$;
revoke all on function public.read_planning() from public,anon;
grant execute on function public.read_planning() to authenticated;
commit;
