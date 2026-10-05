-- 型組・トライは設備を要求せず、使用プレスNoを記録する。
begin;
alter table public.tasks add column press_no text not null default '' check(length(press_no)<=40);
alter table public.tasks alter column equipment_id drop not null;
alter table public.tasks add constraint tasks_equipment_required_check check(equipment_id is not null or process_code in ('assembly','trial'));
update public.tasks t set equipment_id=null from public.parts p where p.id=t.part_id and p.scope='mold';
create or replace function public.commit_plan(payload jsonb, expected bigint, accept_overlap boolean default false) returns bigint language plpgsql security definer set search_path='' as $$
declare item jsonb; seg jsonb; b public.bom_items; old_task public.tasks; part_row public.parts; r bigint; required text[];
begin
 perform app_private.lock_revision(expected);
 if app_private.member_role()<>'admin' then raise exception '管理者のみ操作できます' using errcode='42501'; end if;
 for item in select value from jsonb_array_elements(payload->'parts') loop
  if not exists(select 1 from public.parts where id=(item->>'id')::uuid) then
   if item->>'scope'='mold' then
    if not exists(select 1 from public.products where id=(item->>'productId')::uuid and not is_archived) then raise exception '有効な金型を選択してください'; end if;
    select array_agg(value) into required from jsonb_array_elements_text(item->'processes');
    if required is null or cardinality(required)<>1 or not required <@ array['assembly','trial']::text[] then raise exception '単体工程は型組またはトライを指定してください'; end if;
    insert into public.parts(id,product_id,name,quantity,required_processes,scope) values((item->>'id')::uuid,(item->>'productId')::uuid,case when required[1]='assembly' then '型組' else 'トライ' end,1,required,'mold');
   else
   select * into b from public.bom_items where id=(item->>'bomId')::uuid and not is_archived;
   if not found or b.product_id<>(item->>'productId')::uuid then raise exception 'BOM項目が不正です'; end if;
   if not exists(select 1 from public.products where id=b.product_id and not is_archived) then raise exception '金型が非表示です'; end if;
   insert into public.parts(id,product_id,name,quantity,bom_id,required_processes) values((item->>'id')::uuid,b.product_id,b.name,(item->>'quantity')::integer,b.id,b.processes);
   if b.quantity<(select coalesce(sum(quantity),0) from public.parts where bom_id=b.id and not is_archived) then raise exception 'BOM必要数量を超えています'; end if;
   end if;
  end if;
 end loop;
 for item in select value from jsonb_array_elements(payload->'tasks') loop
  select * into old_task from public.tasks where id=(item->>'id')::uuid;
  select * into part_row from public.parts where id=(item->>'partId')::uuid and not is_archived;
  if not found then raise exception '有効な製作ロットを選択してください'; end if;
  if part_row.scope='mold' and nullif(item->>'equipmentId','') is not null then raise exception '金型単体工程に設備の指定は不要です'; end if;
  if date_trunc('minute',(item->>'plannedStart')::timestamptz)<>(item->>'plannedStart')::timestamptz or date_trunc('minute',(item->>'plannedEnd')::timestamptz)<>(item->>'plannedEnd')::timestamptz then raise exception '予定時刻は1分単位で入力してください'; end if;
  required:=coalesce(part_row.required_processes,array['machining','grinding','wire','assembly','trial']);
  if part_row.scope='mold' and ((item->>'duration')::integer%470<>0 or (item->>'breakRun')::boolean or (item->>'overnight')::boolean) then raise exception '単体工程は整数日数・通常勤務で登録してください'; end if;
  if not (item->>'process'=any(required)) then raise exception '対象外の工程です'; end if;
  if old_task.id is not null and (old_task.part_id<>part_row.id or old_task.process_code<>item->>'process') then raise exception '所属は変更できません'; end if;
  if old_task.id is not null and (old_task.status<>'pending' or old_task.is_fixed) then
   if old_task.planned_start<>(item->>'plannedStart')::timestamptz or old_task.planned_end<>(item->>'plannedEnd')::timestamptz or old_task.equipment_id is distinct from nullif(item->>'equipmentId','')::uuid or old_task.duration_minutes<>(item->>'duration')::integer or old_task.assignee_id<>(item->>'workerId')::uuid then
    if old_task.status<>'pending' or coalesce((item->>'fixed')::boolean,false) then raise exception '作業中・完了済み・固定予定は維持してください'; end if;
   end if;
  end if;
  if old_task.id is not null and old_task.status<>'pending' then continue; end if;
  if part_row.scope<>'mold' and not exists(select 1 from public.equipment where id=nullif(item->>'equipmentId','')::uuid and is_active and process_code=item->>'process') and (old_task.id is null or old_task.equipment_id is distinct from nullif(item->>'equipmentId','')::uuid) then raise exception '有効な設備を選択してください'; end if;
  if not exists(select 1 from public.profiles where user_id=(item->>'workerId')::uuid and is_active) and (old_task.id is null or old_task.assignee_id<>(item->>'workerId')::uuid) then raise exception '有効な担当者を選択してください'; end if;
  insert into public.tasks(id,part_id,process_code,equipment_id,assignee_id,duration_minutes,requested_start,planned_start,planned_end,priority_order,allow_break_run,allow_overnight,is_fixed,is_manual_override,press_no)
  values((item->>'id')::uuid,part_row.id,item->>'process',nullif(item->>'equipmentId','')::uuid,(item->>'workerId')::uuid,(item->>'duration')::integer,(item->>'earliestStart')::timestamptz,(item->>'plannedStart')::timestamptz,(item->>'plannedEnd')::timestamptz,(item->>'priority')::integer,(item->>'breakRun')::boolean,(item->>'overnight')::boolean,(item->>'fixed')::boolean,coalesce((item->>'manualOverride')::boolean,false),coalesce(btrim(item->>'pressNo'),''))
  on conflict(id) do update set press_no=excluded.press_no,equipment_id=excluded.equipment_id,assignee_id=excluded.assignee_id,duration_minutes=excluded.duration_minutes,requested_start=excluded.requested_start,planned_start=excluded.planned_start,planned_end=excluded.planned_end,priority_order=excluded.priority_order,allow_break_run=excluded.allow_break_run,allow_overnight=excluded.allow_overnight,is_fixed=excluded.is_fixed,is_manual_override=excluded.is_manual_override;
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
 if exists(select 1 from public.tasks t join public.parts p on p.id=t.part_id where p.scope='mold' and not p.is_archived and t.status='pending' and exists(select 1 from public.tasks v join public.parts q on q.id=v.part_id where q.product_id=p.product_id and not q.is_archived and ((t.process_code='assembly' and v.process_code in ('machining','grinding','wire')) or (t.process_code='trial' and v.process_code in ('machining','grinding','wire','assembly'))) and t.planned_start<coalesce(case when v.status='completed' then v.actual_end end,v.planned_end))) then raise exception '金型の先行工程より前に開始できません'; end if;
 perform app_private.normalize_priorities();
 perform app_private.audit('plan',gen_random_uuid(),null,payload);
 update public.schedule_state set revision=revision+1,needs_recalculation=false where id=true returning revision into r;
 return r;
end $$;
alter function public.read_planning() rename to read_planning_before_press_no;
revoke all on function public.read_planning_before_press_no() from public,anon,authenticated;
create function public.read_planning() returns jsonb language sql stable security definer set search_path='' as $$
 select public.read_planning_before_press_no() || jsonb_build_object('tasks',coalesce((select jsonb_agg(value || jsonb_build_object('equipmentId',coalesce(t.equipment_id::text,''),'pressNo',t.press_no)) from jsonb_array_elements(public.read_planning_before_press_no()->'tasks') value join public.tasks t on t.id=(value->>'id')::uuid),'[]'::jsonb));
$$;
revoke all on function public.read_planning() from public,anon;
grant execute on function public.read_planning() to authenticated;
update public.schedule_state set revision=revision+1,needs_recalculation=true where id=true;
commit;
