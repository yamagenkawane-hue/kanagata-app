-- Purchase/outsourced BOM parts can have no internal manufacturing tasks.
-- Keep catalog validation, plate requirements, roles, revision locks and auditing.
begin;
alter table public.bom_items drop constraint if exists bom_items_processes_check;
alter table public.bom_items add constraint bom_items_processes_check
 check(not processes && array['assembly','trial']::text[]);
commit;
