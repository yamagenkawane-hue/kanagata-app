begin;
alter table public.bom_items add column width_mm numeric check(width_mm>0 and width_mm<=10000),add column length_mm numeric check(length_mm>0 and length_mm<=10000);
-- Keep the dimensions used at registration for future actual-time estimation.
alter table public.parts add column plate_width_mm numeric,add column plate_length_mm numeric;
create function app_private.snapshot_plate_dimensions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select width_mm,length_mm into new.plate_width_mm,new.plate_length_mm from public.bom_items where id=new.bom_id and kind='plate';
 return new;
end $$;
revoke all on function app_private.snapshot_plate_dimensions() from public,anon,authenticated;
create trigger snapshot_plate_dimensions before insert on public.parts for each row execute function app_private.snapshot_plate_dimensions();
create table public.estimate_settings(id boolean primary key default true check(id),value jsonb not null,
 check(jsonb_typeof(value->'machiningMinutes')='number' and jsonb_typeof(value->'grindingMinutes')='number' and jsonb_typeof(value->'largeGrindingMinutes')='number' and jsonb_typeof(value->'wireMinutes')='number' and jsonb_typeof(value->'largeThresholdMm')='number'),
 check((value->>'largeThresholdMm')::numeric>0 and (value->>'largeThresholdMm')::numeric<=10000),
 check((value->>'machiningMinutes')::numeric between 30 and 10080 and (value->>'machiningMinutes')::numeric%30=0),
 check((value->>'grindingMinutes')::numeric between 30 and 10080 and (value->>'grindingMinutes')::numeric%30=0),
 check((value->>'largeGrindingMinutes')::numeric between 30 and 10080 and (value->>'largeGrindingMinutes')::numeric%30=0),
 check((value->>'wireMinutes')::numeric between 30 and 10080 and (value->>'wireMinutes')::numeric%30=0),
 check(value ?& array['largeThresholdMm','machiningMinutes','grindingMinutes','largeGrindingMinutes','wireMinutes']));
insert into public.estimate_settings(value) values('{"largeThresholdMm":300,"machiningMinutes":240,"grindingMinutes":240,"largeGrindingMinutes":480,"wireMinutes":480}');
alter table public.estimate_settings enable row level security;
grant select on public.estimate_settings to authenticated;
create policy member_read on public.estimate_settings for select to authenticated using ((select app_private.member_role()) is not null);

alter function public.manage_entity(text,jsonb,bigint) rename to manage_entity_before_estimates;
revoke all on function public.manage_entity_before_estimates(text,jsonb,bigint) from public,anon,authenticated;
create function public.manage_entity(entity text,payload jsonb,expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare r bigint;target uuid;previous jsonb;
begin
 if entity='estimates' then
  perform app_private.lock_revision(expected);
  if app_private.member_role()<>'admin' then raise exception '管理者のみ操作できます' using errcode='42501';end if;
  select value into previous from public.estimate_settings where id=true;
  update public.estimate_settings set value=payload where id=true;
  perform app_private.audit('estimates','00000000-0000-4000-8000-000000000010'::uuid,previous,payload);
  update public.schedule_state set revision=revision+1 where id=true returning revision into r;
  return r;
 end if;
 if entity='bom' then
  target:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
  payload:=payload||jsonb_build_object('id',target);
 end if;
 r:=public.manage_entity_before_estimates(entity,payload,expected);
 if entity='bom' then
  select jsonb_build_object('widthMm',width_mm,'lengthMm',length_mm) into previous from public.bom_items where id=target;
  update public.bom_items set width_mm=case when payload ? 'widthMm' then (payload->>'widthMm')::numeric else width_mm end,length_mm=case when payload ? 'lengthMm' then (payload->>'lengthMm')::numeric else length_mm end where id=target;
  perform app_private.audit('bom_dimensions',target,previous,jsonb_build_object('widthMm',payload->'widthMm','lengthMm',payload->'lengthMm'));
 end if;
 return r;
end $$;
revoke all on function public.manage_entity(text,jsonb,bigint) from public,anon;
grant execute on function public.manage_entity(text,jsonb,bigint) to authenticated;

alter function public.read_planning() rename to read_planning_before_estimates;
revoke all on function public.read_planning_before_estimates() from public,anon,authenticated;
create function public.read_planning() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.read_planning_before_estimates();
 return result||jsonb_build_object('estimates',(select value from public.estimate_settings where id=true),'bom',coalesce((select jsonb_agg(item||jsonb_build_object('widthMm',b.width_mm,'lengthMm',b.length_mm)) from jsonb_array_elements(result->'bom') item join public.bom_items b on b.id=(item->>'id')::uuid),'[]'::jsonb),'parts',coalesce((select jsonb_agg(item||jsonb_build_object('plateWidthMm',p.plate_width_mm,'plateLengthMm',p.plate_length_mm)) from jsonb_array_elements(result->'parts') item join public.parts p on p.id=(item->>'id')::uuid),'[]'::jsonb));
end $$;
revoke all on function public.read_planning() from public,anon;
grant execute on function public.read_planning() to authenticated;
commit;
