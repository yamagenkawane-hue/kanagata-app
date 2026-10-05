-- 型組・トライは1日470分で登録。既存の30分単位の予定は維持する。
begin;
alter table public.tasks drop constraint tasks_duration_minutes_check;
alter table public.tasks add constraint tasks_duration_minutes_check check(
 duration_minutes>0 and (duration_minutes%30=0 or (process_code in ('assembly','trial') and duration_minutes%470=0))
);
commit;
