-- アプリからのログインユーザー登録。サーバー専用キーだけが実行可能。
begin;
create function public.register_login_profile(new_user uuid, actor uuid, display_name text, new_role text, expected bigint default null)
returns void language plpgsql security definer set search_path='' as $$
declare current_revision bigint;
begin
 select revision into current_revision from public.schedule_state where id=true for update;
 if current_revision is null then raise exception '初期SQLを適用してください'; end if;
 if actor is null then
  if exists(select 1 from public.profiles) then raise exception '初回登録は完了しています' using errcode='42501'; end if;
  if new_role<>'admin' then raise exception '最初の利用者は管理者です'; end if;
 else
  if not exists(select 1 from public.profiles where user_id=actor and role='admin' and is_active) then raise exception '管理者のみ登録できます' using errcode='42501'; end if;
  if expected is null or expected<>current_revision then raise exception '他の利用者が更新しました。再読み込みしてください' using errcode='40001'; end if;
 end if;
 if length(btrim(display_name)) not between 1 and 120 or new_role not in ('admin','operator') then raise exception '登録内容が不正です'; end if;
 insert into public.profiles(user_id,display_name,role) values(new_user,btrim(display_name),new_role);
 insert into public.change_logs(actor_id,entity_type,entity_id,after_data) values(coalesce(actor,new_user),'login_user',new_user,jsonb_build_object('name',btrim(display_name),'role',new_role));
 update public.schedule_state set revision=revision+1 where id=true;
end;
$$;
revoke all on function public.register_login_profile(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.register_login_profile(uuid,uuid,text,text,bigint) to service_role;
commit;
