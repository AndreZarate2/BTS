-- Pruebas en la base REAL, dentro de una transacción que se revierte completamente.
begin;
select set_config('bts.test_user',gen_random_uuid()::text,true);
select set_config('bts.test_other',gen_random_uuid()::text,true);
select set_config('bts.test_admin',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,raw_app_meta_data,raw_user_meta_data,is_anonymous,created_at,updated_at)
select current_setting('bts.test_user')::uuid,'authenticated','authenticated','{}'::jsonb,'{}'::jsonb,true,now(),now()
union all select current_setting('bts.test_other')::uuid,'authenticated','authenticated','{}'::jsonb,'{}'::jsonb,true,now(),now()
union all select current_setting('bts.test_admin')::uuid,'authenticated','authenticated','{"bts_admin":true}'::jsonb,'{}'::jsonb,false,now(),now();
set local role service_role;
do $$
declare u uuid=current_setting('bts.test_user')::uuid;
 o uuid=current_setting('bts.test_other')::uuid;
 a uuid=current_setting('bts.test_admin')::uuid;
 artist uuid; template uuid; s jsonb; sid uuid; chosen uuid; result jsonb;
begin
 perform public.bts_register_admin(a);
 perform public.bts_request_access(u,'QA Fan','qa-key-user');
 perform public.bts_request_access(o,'QA Other','qa-key-other');
 assert (select status='pending' from public.user_access where user_id=u),'pending request';
 result=public.bts_request_access(u,'New Name','qa-key-user');
 assert result->>'existing'='true','idempotent request';
 begin
  perform public.bts_admin_transition(o,u,'approve');
  raise exception 'Unauthorized approval unexpectedly succeeded';
 exception when raise_exception then
  if sqlerrm<>'FORBIDDEN' then raise; end if;
 end;
 perform public.bts_admin_transition(a,u,'approve');
 assert (select count(*)=1 from public.photo_sessions where user_id=u),'one approved session';
 select id into artist from public.artists where slug='jungkook';
 begin
  perform public.bts_choose_artist(u,artist);
  raise exception 'Empty catalog unexpectedly allowed';
 exception when raise_exception then
  if sqlerrm<>'NO_TEMPLATES' then raise; end if;
 end;
 insert into public.templates(artist_id,label,storage_path) values(artist,'QA Template','qa/'||gen_random_uuid()||'.jpg') returning id into template;
 s=public.bts_choose_artist(u,artist);sid=(s->>'id')::uuid;chosen=(s->>'template_id')::uuid;
 assert chosen=template,'assigned eligible template';
 s=public.bts_choose_artist(u,artist);
 assert (s->>'template_id')::uuid=chosen,'no reroll on duplicate';
 assert (select count(*)=1 from public.photo_sessions where user_id=u),'no duplicate cycle';
 begin
  perform public.bts_attach_selfie(o,sid,'other/path.jpg');
  raise exception 'Cross-user attach unexpectedly allowed';
 exception when raise_exception then
  if sqlerrm not in ('ACCESS_REQUIRED','INVALID_TRANSITION') then raise; end if;
 end;
 perform public.bts_attach_selfie(u,sid,u||'/'||sid||'/source.jpg');
 result=public.bts_claim_generation(u,sid);
 assert (result->>'claimed')::boolean,'first generation claimed';
 result=public.bts_claim_generation(u,sid);
 assert not (result->>'claimed')::boolean,'duplicate generation not claimed';
 assert (select attempts=1 from public.photo_sessions where id=sid),'one provider invocation';
 update public.templates set active=false,deleted_at=now() where id=template;
 assert public.bts_complete_generation(sid,u||'/'||sid||'/result.jpg'),'assigned history survives template removal';
 perform public.bts_redeem_download(u,sid);
 assert (select status='consumed' from public.user_access where user_id=u),'consumed access';
 begin
  perform public.bts_redeem_download(u,sid);
  raise exception 'Second redemption unexpectedly succeeded';
 exception when raise_exception then
  if sqlerrm<>'DOWNLOAD_USED' then raise; end if;
 end;
 perform public.bts_request_access(u,'Bypass','qa-key-user');
 assert (select status='consumed' from public.user_access where user_id=u),'request cannot bypass consumed';
 perform public.bts_admin_transition(a,u,'reactivate');
 assert (select count(*)=2 from public.photo_sessions where user_id=u),'history preserved';
 assert (select count(*)=1 from public.photo_sessions where user_id=u and status='approved' and template_id is null),'fresh choice on reactivation';
 perform public.bts_admin_transition(a,u,'block');
 assert (select status='blocked' from public.user_access where user_id=u),'block';
 assert (select count(*)=0 from public.photo_sessions where user_id=u and status not in ('cancelled','consumed')),'blocked cycle cancelled';
 assert not public.bts_complete_generation(sid,'bad.jpg'),'late job cannot restore blocked cycle';
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bts.test_user'),'role','authenticated','is_anonymous',true)::text,true);
set local role authenticated;
do $$
begin
 assert (select count(*)=1 from public.profiles),'RLS own profile';
 assert (select count(*)=1 from public.user_access),'RLS own access';
 assert (select count(*)=2 from public.photo_sessions),'RLS own history';
 assert not has_table_privilege(current_user,'public.user_access','UPDATE'),'no self approval grant';
 assert not has_function_privilege(current_user,'public.bts_choose_artist(uuid,uuid)','EXECUTE'),'no trusted RPC access';
 assert not has_table_privilege(current_user,'public.templates','SELECT'),'no raw template listing';
 assert not has_function_privilege(current_user,'public.bts_register_admin(uuid)','EXECUTE'),'no admin self elevation';
 assert (select count(*)=0 from storage.objects where bucket_id in ('user-selfies','generated-images','artist-templates')),'no private storage listing';
end $$;
reset role;
select 'PASS: approval, assignment idempotency, generation claim, one-time redemption, reactivation, block, RLS, grants and admin authorization' as result;
rollback;
