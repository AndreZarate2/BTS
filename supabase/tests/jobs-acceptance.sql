-- Synthetic identities and metadata only. All writes are rolled back.
begin;
select set_config('bts.test_user',gen_random_uuid()::text,true);
select set_config('bts.test_other',gen_random_uuid()::text,true);
select set_config('bts.test_admin',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,raw_app_meta_data,is_anonymous,created_at,updated_at)
select current_setting('bts.test_user')::uuid,'authenticated','authenticated','{}'::jsonb,true,now(),now()
union all select current_setting('bts.test_other')::uuid,'authenticated','authenticated','{}'::jsonb,true,now(),now()
union all select current_setting('bts.test_admin')::uuid,'authenticated','authenticated','{"bts_admin":true}'::jsonb,false,now(),now();
set local role service_role;
do $$
declare u uuid=current_setting('bts.test_user')::uuid;o uuid=current_setting('bts.test_other')::uuid;a uuid=current_setting('bts.test_admin')::uuid;
 artist uuid;template uuid;sid uuid;second uuid;jid uuid;tok uuid;value jsonb;previous text;claimed jsonb;
begin
 perform public.bts_register_admin(a);
 perform public.bts_request_access(u,'QA Fan',u::text);
 perform public.bts_request_access(o,'QA Fan',o::text);
 assert u<>o,'same names have separate UUIDs';
 perform public.bts_admin_transition(a,u,'approve');
 perform public.bts_admin_transition(a,o,'approve');
 insert into public.artists(name,slug,display_order,enabled) values('QA ephemeral','qa-'||gen_random_uuid(),99,true) returning id into artist;
 insert into public.templates(artist_id,label,storage_path) values(artist,'QA','qa/'||gen_random_uuid()) returning id into template;
 value=public.bts_choose_artist(u,artist);sid=(value->>'id')::uuid;
 assert (public.bts_choose_artist(u,artist)->>'template_id')::uuid=template,'stable assignment';
 perform public.bts_track_media(sid,'user-selfies','qa/'||sid||'/first.jpg');
 value=public.bts_attach_selfie(u,sid,'qa/'||sid||'/first.jpg');
 assert value->>'previous_selfie_path' is null,'first attachment';
 perform public.bts_track_media(sid,'user-selfies','qa/'||sid||'/second.jpg');
 value=public.bts_attach_selfie(u,sid,'qa/'||sid||'/second.jpg');
 assert value->>'previous_selfie_path'='qa/'||sid||'/first.jpg','locked replacement returns actual previous path';
 assert (select count(*)=2 from bts_private.media_objects where session_id=sid),'all objects tracked for failed cleanup';
 begin
  perform public.bts_attach_selfie(o,sid,'wrong.jpg');raise exception 'cross-user upload succeeded';
 exception when raise_exception then if sqlerrm<>'INVALID_TRANSITION' then raise;end if;end;
 value=public.bts_enqueue_generation(u,sid);jid=(value->'job'->>'id')::uuid;
 assert (value->>'created')::boolean,'first enqueue';
 value=public.bts_enqueue_generation(u,sid);
 assert not (value->>'created')::boolean and (value->'job'->>'id')::uuid=jid,'duplicate request returns same job';
 assert (select attempts=1 from public.photo_sessions where id=sid),'no duplicate charge attempt';
 claimed=public.bts_claim_job(jid);tok=(claimed->'job'->>'lock_token')::uuid;
 assert tok is not null,'worker lease';
 assert public.bts_claim_job(jid) is null,'second worker cannot claim';
 assert not public.bts_finish_job(jid,gen_random_uuid(),'bad.jpg','mock',false,1,null),'wrong lock rejected';
 assert public.bts_finish_job(jid,tok,'qa/result.jpg','mock',false,7,null),'worker completes once';
 assert not public.bts_finish_job(jid,tok,'bad.jpg','mock',false,1,null),'duplicate completion rejected';
 begin
  perform public.bts_redeem_download(o,sid);raise exception 'cross-user download succeeded';
 exception when raise_exception then if sqlerrm<>'DOWNLOAD_USED' then raise;end if;end;
 perform public.bts_redeem_download(u,sid);
 assert (select count(*)=1 from public.download_events where session_id=sid),'one download event';
 begin
  perform public.bts_redeem_download(u,sid);raise exception 'second download succeeded';
 exception when raise_exception then if sqlerrm<>'DOWNLOAD_USED' then raise;end if;end;
 update public.photo_sessions set created_at=now()-interval '3 days' where id=sid;
 update bts_private.media_objects set created_at=now()-interval '3 days' where session_id=sid;
 perform public.bts_expire_sessions(now()-interval '1 day');
 assert (select status='consumed' and purged_at is not null and selfie_path is null and result_path is null from public.photo_sessions where id=sid),'retention preserves consumed history';
 assert (select count(*)=2 from public.bts_expired_media(now()-interval '1 day') where session_id=sid),'orphan replacement remains removable';
 perform public.bts_admin_transition(a,u,'reactivate');
 value=public.bts_choose_artist(u,artist);second=(value->>'id')::uuid;
 assert second<>sid,'reactivation new session';
 perform public.bts_attach_selfie(u,second,'qa/abandoned.jpg');
 update public.photo_sessions set created_at=now()-interval '3 days' where id=second;
 perform public.bts_expire_sessions(now()-interval '1 day');
 assert (select status='cancelled' and purged_at is not null from public.photo_sessions where id=second),'abandoned selfie expires';
 assert public.bts_rate_limit('qa-'||u,1,60),'first rate hit';
 assert not public.bts_rate_limit('qa-'||u,1,60),'rate cap';
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('bts.test_user'),'role','authenticated','is_anonymous',true)::text,true);
set local role authenticated;
do $$ begin
 assert (select count(*)=1 from public.profiles),'own profile RLS';
 assert (select count(*)=2 from public.photo_sessions),'own sessions RLS';
 assert (select count(*)=1 from public.generation_jobs),'own jobs RLS';
 assert (select count(*)=1 from public.download_events),'own downloads RLS';
 assert not has_table_privilege(current_user,'public.user_access','UPDATE'),'cannot self approve';
 assert not has_table_privilege(current_user,'public.photo_sessions','UPDATE'),'cannot assign templates';
 assert not has_table_privilege(current_user,'public.generation_jobs','INSERT'),'cannot forge job';
 assert not has_function_privilege(current_user,'public.bts_enqueue_generation(uuid,uuid,integer)','EXECUTE'),'cannot invoke trusted enqueue';
 assert not has_function_privilege(current_user,'public.bts_claim_job(uuid)','EXECUTE'),'cannot invoke worker';
 assert not has_function_privilege(current_user,'public.bts_register_admin(uuid)','EXECUTE'),'cannot elevate admin';
 assert (select count(*)=0 from storage.objects where bucket_id in ('user-selfies','generated-images','artist-templates')),'no direct private object access';
end $$;
reset role;
select 'PASS: jobs, idempotency, lock tokens, ownership, download events, retention, orphan tracking, rate limit, RLS and grants' as result;
rollback;
