-- Apply to stop PostgREST 14 retrying an application revision conflict forever.
-- Only changes the error code. Keeps authentication, locking and business data intact.
begin;
create or replace function app_private.lock_revision(expected bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 if app_private.member_role() is null then raise exception '有効な利用者ではありません' using errcode='42501'; end if;
 perform 1 from public.schedule_state where id=true and revision=expected for update;
 if not found then raise exception '他の利用者が更新しました。再読み込みしてください' using errcode='PT409'; end if;
end $$;
revoke all on function app_private.lock_revision(bigint) from public,anon,authenticated;
-- Optional user-registration RPC has the same application-conflict error.
do $$ declare definition text;
begin
 if to_regprocedure('public.register_login_profile(uuid,uuid,text,text,bigint)') is not null then
  definition:=pg_get_functiondef('public.register_login_profile(uuid,uuid,text,text,bigint)'::regprocedure);
  definition:=replace(definition,'''40001''','''PT409''');
  execute definition;
 end if;
end $$;
commit;
