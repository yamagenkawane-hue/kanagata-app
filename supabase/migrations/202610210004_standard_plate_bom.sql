begin;
alter function public.manage_entity(text,jsonb,bigint) rename to manage_entity_before_standard_plates;
revoke all on function public.manage_entity_before_standard_plates(text,jsonb,bigint) from public,anon,authenticated;
create function public.manage_entity(entity text,payload jsonb,expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare r bigint:=expected;owner_id uuid;category uuid;plate_name text;w numeric;l numeric;
begin
 if entity<>'standardPlates' then return public.manage_entity_before_standard_plates(entity,payload,expected);end if;
 perform app_private.lock_revision(expected);
 if app_private.member_role() is distinct from 'admin' then raise exception '管理者のみ操作できます' using errcode='42501';end if;
 owner_id:=(payload->>'productId')::uuid;category:=(payload->>'categoryId')::uuid;
 w:=(payload->>'widthMm')::numeric;l:=(payload->>'lengthMm')::numeric;
 if w is null or l is null or w<=0 or l<=0 or w>10000 or l>10000 then raise exception '幅と長さは0より大きく10000mm以下で入力してください';end if;
 if not exists(select 1 from public.products where id=owner_id and not is_archived) then raise exception '有効な金型を選択してください';end if;
 if not exists(select 1 from public.bom_categories where id=category and kind='plate' and is_active) then raise exception '有効なプレート区分を選択してください';end if;
 foreach plate_name in array array['PBパンチバッキング','PPパンチプレート','SBストリッパーバッキング','SPストリッパープレート','DB1ダイバッキング','DPダイプレート'] loop
  if exists(select 1 from public.bom_items where product_id=owner_id and kind='plate' and name=plate_name and not is_archived) then continue;end if;
  r:=public.manage_entity_before_standard_plates('bom',jsonb_build_object('productId',owner_id,'categoryId',category,'name',plate_name,'kind','plate','quantity',1,'notes','','processes',jsonb_build_array('machining','grinding','wire'),'archived',false,'widthMm',w,'lengthMm',l,'individualWidth',false,'individualLength',false),r);
 end loop;
 return r;
end $$;
revoke all on function public.manage_entity(text,jsonb,bigint) from public,anon;
grant execute on function public.manage_entity(text,jsonb,bigint) to authenticated;
commit;
