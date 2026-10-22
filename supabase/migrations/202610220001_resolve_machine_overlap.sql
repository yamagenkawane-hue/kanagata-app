-- Explicit administrator choice. Log edits and downstream plans commit atomically.
begin;
create function public.resolve_machine_overlap(payload jsonb,expected bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare winner public.tasks;loser public.tasks;entry record;previous jsonb;item jsonb;r bigint:=expected;offset_value interval;winner_end timestamptz;loser_start timestamptz;winner_start timestamptz;loser_end timestamptz;
begin
 perform app_private.lock_revision(expected);
 if app_private.member_role() is distinct from 'admin' then raise exception '重複解消は管理者のみです' using errcode='42501';end if;
 select * into winner from public.tasks where id=(payload->>'winnerId')::uuid;
 select * into loser from public.tasks where id=(payload->>'loserId')::uuid;
 if winner.id is null or loser.id is null or winner.id=loser.id or winner.equipment_id is null or winner.equipment_id is distinct from loser.equipment_id then raise exception '同じ機械の工程を選択してください';end if;
 if exists(select 1 from public.parts p join public.products x on x.id=p.product_id where p.id in (winner.part_id,loser.part_id) and (p.is_archived or x.is_archived)) then raise exception '有効な工程を選択してください';end if;
 winner_start:=case when winner.status='completed' then coalesce(winner.actual_start,winner.planned_start) else winner.planned_start end;
 winner_end:=case when winner.status='completed' then coalesce(winner.actual_end,winner.planned_end) else winner.planned_end end;
 loser_start:=case when loser.status='completed' then coalesce(loser.actual_start,loser.planned_start) else loser.planned_start end;
 loser_end:=case when loser.status='completed' then coalesce(loser.actual_end,loser.planned_end) else loser.planned_end end;
 if winner_start>=loser_end or loser_start>=winner_end then raise exception '設備の時間は重複していません';end if;
 offset_value:=winner_end-loser_start;
 if extract(epoch from offset_value)*1000 is distinct from (payload->>'delta')::numeric then raise exception '実績の移動量が一致しません';end if;
 select value into item from jsonb_array_elements(payload->'tasks') where value->>'id'=loser.id::text;
 if item is null then raise exception '変更対象の工程がありません';end if;
 -- Existing protected tasks may only be translated; no reassignment or duration change.
 if loser.status<>'pending' or loser.is_fixed then
  if (item->>'plannedStart')::timestamptz is distinct from loser.planned_start+offset_value or (item->>'plannedEnd')::timestamptz is distinct from loser.planned_end+offset_value then raise exception '保護された工程の時間幅を維持してください';end if;
  previous:=to_jsonb(loser);
  for entry in select * from public.work_logs where task_id=loser.id and not is_deleted order by start_at,id loop
   r:=public.save_actual(jsonb_build_object('id',entry.id,'taskId',loser.id,'workerId',entry.worker_id,'start',entry.start_at+offset_value,'end',entry.end_at+offset_value,'status',loser.status,'overrideMinutes',entry.override_minutes,'reason',entry.override_reason,'acceptOverlap',true),r,false);
  end loop;
  update public.tasks set requested_start=requested_start+offset_value,planned_start=planned_start+offset_value,planned_end=planned_end+offset_value where id=loser.id;
  update public.task_segments set start_at=start_at+offset_value,end_at=end_at+offset_value where task_id=loser.id;
  perform app_private.audit('overlap_resolution',loser.id,previous,jsonb_build_object('winnerId',winner.id,'task',(select to_jsonb(t) from public.tasks t where id=loser.id)));
 end if;
 -- Normal plan validation preserves every other protected task and checks dependencies.
 r:=public.commit_plan(payload,r,true);
 perform app_private.audit('overlap_priority',winner.id,null,jsonb_build_object('winnerId',winner.id,'loserId',loser.id,'offsetSeconds',extract(epoch from offset_value)));
 return r;
end $$;
revoke all on function public.resolve_machine_overlap(jsonb,bigint) from public,anon;
grant execute on function public.resolve_machine_overlap(jsonb,bigint) to authenticated;
commit;
