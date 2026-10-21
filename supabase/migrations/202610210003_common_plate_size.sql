begin;
alter table public.products add column plate_width_mm numeric check(plate_width_mm>0 and plate_width_mm<=10000),add column plate_length_mm numeric check(plate_length_mm>0 and plate_length_mm<=10000);
alter table public.bom_items add column individual_width boolean not null default false,add column individual_length boolean not null default false;

-- Use the first regular plate as the initial common size. Preserve different
-- existing dimensions as explicit overrides, including SB and die sets.
update public.products p set plate_width_mm=b.width_mm,plate_length_mm=b.length_mm
from (select distinct on(product_id) product_id,width_mm,length_mm from public.bom_items where kind='plate' and not is_archived and width_mm is not null and length_mm is not null and name !~ '^(SB|DS1|DS2)' and name not like '%ストリッパーバッキング%' order by product_id,case when name like 'PP%' then 0 else 1 end,name,id) b where b.product_id=p.id;
update public.bom_items b set individual_width=(b.width_mm is not null and b.width_mm is distinct from p.plate_width_mm),individual_length=(b.length_mm is not null and b.length_mm is distinct from p.plate_length_mm) from public.products p where b.product_id=p.id and b.kind='plate';
update public.bom_items b set width_mm=case when b.individual_width then b.width_mm else coalesce(p.plate_width_mm,b.width_mm) end,length_mm=case when b.individual_length then b.length_mm else coalesce(p.plate_length_mm,b.length_mm) end from public.products p where b.product_id=p.id and b.kind='plate' and not b.is_archived;

update public.schedule_state set revision=revision+1 where id=true;
alter function public.manage_entity(text,jsonb,bigint) rename to manage_entity_before_common_size;
revoke all on function public.manage_entity_before_common_size(text,jsonb,bigint) from public,anon,authenticated;
create function public.manage_entity(entity text,payload jsonb,expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare r bigint;target uuid;owner_id uuid;own_width boolean;own_length boolean;previous jsonb;kind_value text;
begin
 if entity<>'bom' then return public.manage_entity_before_common_size(entity,payload,expected);end if;
 target:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 payload:=payload||jsonb_build_object('id',target);
 r:=public.manage_entity_before_common_size(entity,payload,expected);
 select product_id,kind,individual_width,individual_length into owner_id,kind_value,own_width,own_length from public.bom_items where id=target;
 if kind_value<>'plate' then return r;end if;
 own_width:=coalesce((payload->>'individualWidth')::boolean,own_width);
 own_length:=coalesce((payload->>'individualLength')::boolean,own_length);
 if exists(select 1 from public.bom_items where id=target and ((own_width and width_mm is null) or (own_length and length_mm is null))) then raise exception '個別指定した寸法を入力してください';end if;
 select jsonb_build_object('widthMm',plate_width_mm,'lengthMm',plate_length_mm) into previous from public.products where id=owner_id;
 update public.products set plate_width_mm=case when not own_width then coalesce((payload->>'widthMm')::numeric,plate_width_mm) else plate_width_mm end,plate_length_mm=case when not own_length then coalesce((payload->>'lengthMm')::numeric,plate_length_mm) else plate_length_mm end where id=owner_id;
 update public.bom_items set individual_width=own_width,individual_length=own_length where id=target;
 update public.bom_items b set width_mm=case when b.individual_width then b.width_mm else coalesce(p.plate_width_mm,b.width_mm) end,length_mm=case when b.individual_length then b.length_mm else coalesce(p.plate_length_mm,b.length_mm) end from public.products p where b.product_id=owner_id and p.id=owner_id and b.kind='plate' and not b.is_archived;
 perform app_private.audit('common_plate_size',owner_id,previous,(select jsonb_build_object('widthMm',plate_width_mm,'lengthMm',plate_length_mm,'bomId',target,'individualWidth',own_width,'individualLength',own_length) from public.products where id=owner_id));
 return r;
end $$;
revoke all on function public.manage_entity(text,jsonb,bigint) from public,anon;
grant execute on function public.manage_entity(text,jsonb,bigint) to authenticated;

alter function public.read_planning() rename to read_planning_before_common_size;
revoke all on function public.read_planning_before_common_size() from public,anon,authenticated;
create function public.read_planning() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.read_planning_before_common_size();
 return result||jsonb_build_object('products',coalesce((select jsonb_agg(item||jsonb_build_object('plateWidthMm',p.plate_width_mm,'plateLengthMm',p.plate_length_mm)) from jsonb_array_elements(result->'products') item join public.products p on p.id=(item->>'id')::uuid),'[]'::jsonb),'bom',coalesce((select jsonb_agg(item||jsonb_build_object('individualWidth',b.individual_width,'individualLength',b.individual_length)) from jsonb_array_elements(result->'bom') item join public.bom_items b on b.id=(item->>'id')::uuid),'[]'::jsonb));
end $$;
revoke all on function public.read_planning() from public,anon;
grant execute on function public.read_planning() to authenticated;
commit;
