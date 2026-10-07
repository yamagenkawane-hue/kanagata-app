-- Apply after 202610050005_press_no.sql. Preserve the existing save validation.
begin;
alter function public.commit_plan(jsonb,bigint,boolean) rename to commit_plan_before_trial_next_day;
revoke all on function public.commit_plan_before_trial_next_day(jsonb,bigint,boolean) from public,anon,authenticated;
create function public.commit_plan(payload jsonb,expected bigint,accept_overlap boolean default false)
returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 result:=public.commit_plan_before_trial_next_day(payload,expected,accept_overlap);
 if exists(
  select 1 from public.tasks trial
  join public.parts tp on tp.id=trial.part_id
  join public.products product on product.id=tp.product_id
  join public.parts ap on ap.product_id=tp.product_id and ap.scope='mold' and not ap.is_archived
  join public.tasks assembly on assembly.part_id=ap.id and assembly.process_code='assembly'
  where tp.scope='mold' and not tp.is_archived and not product.is_archived
   and trial.process_code='trial' and trial.status='pending'
   and trial.planned_start < (((assembly.planned_end at time zone 'Asia/Tokyo')::date + 1 + time '08:50') at time zone 'Asia/Tokyo')
 ) then raise exception 'トライは型組の予定終了日の翌日以降に開始してください'; end if;
 return result;
end $$;
revoke all on function public.commit_plan(jsonb,bigint,boolean) from public,anon;
grant execute on function public.commit_plan(jsonb,bigint,boolean) to authenticated;
update public.schedule_state set needs_recalculation=true,revision=revision+1 where id=true;
commit;
