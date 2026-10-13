-- Read-only diagnostics. Run in Supabase SQL Editor while CPU is high.
-- Keep results private; query text may contain business information.
select pid,usename,application_name,state,wait_event_type,wait_event,
 now()-query_start as elapsed,left(query,300) as query
from pg_stat_activity
where pid<>pg_backend_pid() and state='active'
order by query_start limit 15;

select state,wait_event_type,count(*) as connections
from pg_stat_activity group by state,wait_event_type order by connections desc;

-- Locate pg_stat_statements before opening its view (installation schema varies).
select n.nspname as schema_name,c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relname='pg_stat_statements';

-- Confirm the deployed reader still contains nested reads or has been optimized.
select pg_get_functiondef('public.read_planning()'::regprocedure);
