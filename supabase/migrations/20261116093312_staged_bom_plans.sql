-- Keep all required processes on each lot, but allow their plans to be added separately.
begin;
do $migration$
declare definition text; old_check text;
begin
 definition:=pg_get_functiondef('public.commit_plan_before_trial_next_day(jsonb,bigint,boolean)'::regprocedure);
 old_check:='if exists(select 1 from public.parts p join public.products x on x.id=p.product_id where not p.is_archived and not x.is_archived and (select count(*) from public.tasks t where t.part_id=p.id)<>cardinality(coalesce(p.required_processes,array[''machining'',''grinding'',''wire'',''assembly'',''trial'']))) then raise exception ''必要工程をすべて登録してください''; end if;';
 if position(old_check in definition)=0 then raise exception '予定RPCの全工程チェックを確認してください'; end if;
 definition:=replace(definition,old_check,'-- Required processes may be scheduled in separate submissions.');
 execute definition;
end $migration$;
commit;
