-- Apply after 202610050005_press_no.sql. Works with or without custom processes.
-- One snapshot assembly instead of nested repeated full reads. No business data changes.
begin;
create or replace function public.read_planning() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; catalog jsonb;
begin
 if app_private.member_role() is null then raise exception '有効な利用者ではありません' using errcode='42501'; end if;
 select jsonb_build_object(
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'customer',customer_name,'dueDate',due_date,'notes',notes,'archived',is_archived) order by created_at,id) from public.products),'[]'::jsonb),
  'bom',coalesce((select jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'name',name,'categoryId',category_id,'kind',kind,'quantity',quantity,'notes',notes,'processes',processes,'archived',is_archived) order by name,id) from public.bom_items),'[]'::jsonb),
  'parts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'scope',scope,'bomId',bom_id,'name',name,'quantity',quantity,'drawingNumber',drawing_number,'processes',coalesce(required_processes,array['machining','grinding','wire','assembly','trial']),'archived',is_archived) order by created_at,id) from public.parts),'[]'::jsonb),
  'equipment',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'process',process_code,'active',is_active) order by name,id) from public.equipment),'[]'::jsonb),
  'workers',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'name',display_name,'role',role,'active',is_active) order by display_name,user_id) from public.profiles),'[]'::jsonb),
  'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'partId',part_id,'process',process_code,'equipmentId',coalesce(equipment_id::text,''),'pressNo',press_no,'workerId',assignee_id,'duration',duration_minutes,'earliestStart',requested_start,'plannedStart',planned_start,'plannedEnd',planned_end,'priority',priority_order,'breakRun',allow_break_run,'overnight',allow_overnight,'fixed',is_fixed,'manualOverride',is_manual_override,'status',status,'actualStart',actual_start,'actualEnd',actual_end,'segments',coalesce((select jsonb_agg(jsonb_build_object('start',start_at,'end',end_at) order by start_at) from public.task_segments s where s.task_id=t.id),'[]'::jsonb))) from public.tasks t),'[]'::jsonb),
  'logs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'taskId',task_id,'workerId',worker_id,'start',start_at,'end',end_at,'calculatedMinutes',calculated_minutes,'overrideMinutes',override_minutes,'reason',override_reason,'breaks',calendar_snapshot,'editedBy',updated_by)) from public.work_logs where not is_deleted),'[]'::jsonb),
  'calendar',coalesce((select jsonb_object_agg(date::text,is_working) from public.calendar_days),'{}'::jsonb),
  'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'active',is_active) order by name,id) from public.bom_categories),'[]'::jsonb),
  'bomNames',coalesce((select jsonb_agg(jsonb_build_object('id',id,'categoryId',category_id,'name',name,'active',is_active) order by name,id) from public.bom_names),'[]'::jsonb),
  'today',(now() at time zone 'Asia/Tokyo')::date,'revision',revision,'needsRecalculation',needs_recalculation
 ) into result from public.schedule_state where id=true;
 if to_regclass('public.process_definitions') is not null then
  execute 'select coalesce(jsonb_agg(jsonb_build_object(''code'',code,''name'',name,''order'',sort_order,''active'',is_active,''color'',color,''tint'',tint) order by sort_order,code),''[]''::jsonb) from public.process_definitions' into catalog;
  result:=result||jsonb_build_object('processes',catalog);
 end if;
 return result;
end $$;
revoke all on function public.read_planning() from public,anon;
grant execute on function public.read_planning() to authenticated;
commit;
