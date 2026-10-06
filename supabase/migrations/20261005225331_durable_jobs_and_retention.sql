-- Durable jobs, bounded operations, tracked images, and atomic upload replacement.
alter table public.photo_sessions drop constraint photo_sessions_status_check;
alter table public.photo_sessions add constraint photo_sessions_status_check check (status in ('approved','artist_selected','selfie_uploaded','queued','processing','ready','consumed','failed','cancelled'));
alter table public.photo_sessions add column provider text, add column fallback_used boolean not null default false, add column duration_ms integer;
alter table public.templates add column thumbnail_path text;
create table public.generation_jobs (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.photo_sessions(id),
 user_id uuid not null references public.profiles(id), attempt integer not null check(attempt between 1 and 2),
 status text not null default 'queued' check(status in ('queued','processing','ready','failed','cancelled')),
 stage text not null default 'queued',provider text,fallback_used boolean not null default false,
 lock_token uuid,lease_until timestamptz,created_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz,duration_ms integer,error_code text,
 unique(session_id,attempt)
);
create unique index one_active_generation_job on public.generation_jobs(session_id) where status in ('queued','processing');
create index jobs_user_created on public.generation_jobs(user_id,created_at desc);
create index jobs_queue on public.generation_jobs(status,created_at);
create table public.download_events (
 id uuid primary key default gen_random_uuid(),session_id uuid not null unique references public.photo_sessions(id),
 user_id uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create index downloads_user on public.download_events(user_id);
create table bts_private.media_objects (
 path text primary key,bucket text not null check(bucket in ('user-selfies','generated-images')),
 session_id uuid not null references public.photo_sessions(id),created_at timestamptz not null default now()
);
create index media_session on bts_private.media_objects(session_id);
create index media_created on bts_private.media_objects(created_at);
alter table public.generation_jobs enable row level security;
alter table public.download_events enable row level security;
alter table bts_private.media_objects enable row level security;
revoke all on public.generation_jobs,public.download_events,bts_private.media_objects from public,anon,authenticated;
grant all on public.generation_jobs,public.download_events,bts_private.media_objects to service_role;
grant select on public.generation_jobs,public.download_events to authenticated;
create policy own_jobs on public.generation_jobs for select to authenticated using ((select auth.uid())=user_id);
create policy own_downloads on public.download_events for select to authenticated using ((select auth.uid())=user_id);
alter publication supabase_realtime add table public.generation_jobs;

create function public.bts_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare hits integer;
begin
 if length(p_key)>180 or p_limit<1 or p_limit>10000 or p_seconds<1 then raise exception 'INVALID_INPUT'; end if;
 insert into bts_private.rate_limits as r(key,window_start,hits) values(p_key,now(),1)
 on conflict(key) do update set hits=case when r.window_start<now()-make_interval(secs=>p_seconds) then 1 else r.hits+1 end,
 window_start=case when r.window_start<now()-make_interval(secs=>p_seconds) then now() else r.window_start end returning r.hits into hits;
 return hits<=p_limit;
end $$;
create function public.bts_track_media(p_session uuid,p_bucket text,p_path text) returns void language sql security invoker set search_path='' as $$
 insert into bts_private.media_objects(session_id,bucket,path) values(p_session,p_bucket,p_path) on conflict(path) do nothing
$$;
create function public.bts_forget_media(p_path text) returns void language sql security invoker set search_path='' as $$
 delete from bts_private.media_objects where path=p_path
$$;
create function public.bts_expired_media(p_cutoff timestamptz) returns setof bts_private.media_objects language sql security invoker set search_path='' as $$
 select m.* from bts_private.media_objects m join public.photo_sessions s on s.id=m.session_id
 where m.created_at<p_cutoff and s.status not in ('queued','processing') order by m.created_at limit 200
$$;
-- Return the previous path while holding the lock; stale HTTP snapshots cannot orphan replacements.
create or replace function public.bts_attach_selfie(p_user uuid,p_session uuid,p_path text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.photo_sessions; old_path text;
begin
 perform 1 from public.user_access where user_id=p_user and status='approved' for update;
 if not found then raise exception 'ACCESS_REQUIRED'; end if;
 select * into s from public.photo_sessions where id=p_session and user_id=p_user for update;
 if not found or s.status not in ('artist_selected','selfie_uploaded','failed') or s.attempts>=2 or s.purged_at is not null then raise exception 'INVALID_TRANSITION'; end if;
 old_path:=s.selfie_path;
 update public.photo_sessions set selfie_path=p_path,status='selfie_uploaded',consent_at=now(),error_code=null,error_message=null where id=s.id returning * into s;
 return to_jsonb(s)||jsonb_build_object('previous_selfie_path',old_path);
end $$;
create function public.bts_enqueue_generation(p_user uuid,p_session uuid,p_max_attempts integer default 2) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.photo_sessions;j public.generation_jobs;
begin
 perform 1 from public.user_access where user_id=p_user and status='approved' for update;
 if not found then raise exception 'ACCESS_REQUIRED'; end if;
 select * into s from public.photo_sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if s.status in ('queued','processing','ready') then
  select * into j from public.generation_jobs where session_id=s.id order by created_at desc limit 1;
  return jsonb_build_object('created',false,'job',to_jsonb(j));
 end if;
 if s.status not in ('selfie_uploaded','failed') or s.selfie_path is null or s.consent_at is null or s.purged_at is not null or s.attempts>=least(2,greatest(1,p_max_attempts)) then raise exception 'INVALID_TRANSITION';end if;
 insert into public.generation_jobs(session_id,user_id,attempt) values(s.id,p_user,s.attempts+1) returning * into j;
 update public.photo_sessions set status='queued',attempts=attempts+1,error_code=null,error_message=null where id=s.id;
 insert into public.audit_logs(actor_user_id,action,target_user_id,entity_id) values(p_user,'generation_queued',p_user,j.id);
 return jsonb_build_object('created',true,'job',to_jsonb(j));
end $$;
create function public.bts_claim_job(p_job uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.generation_jobs;s public.photo_sessions;
begin
 select * into j from public.generation_jobs where id=p_job and status='queued' for update skip locked;
 if not found then return null;end if;
 select * into s from public.photo_sessions where id=j.session_id;
 if s.status<>'queued' or not exists(select 1 from public.user_access where user_id=j.user_id and status='approved') then
  update public.generation_jobs set status='cancelled',finished_at=now() where id=j.id;return null;
 end if;
 update public.generation_jobs set status='processing',stage='starting',lock_token=gen_random_uuid(),started_at=now(),lease_until=now()+interval '5 minutes' where id=j.id returning * into j;
 update public.photo_sessions set status='processing',processing_started_at=now() where id=s.id and status='queued';
 return jsonb_build_object('job',to_jsonb(j),'session',to_jsonb(s));
end $$;
create function public.bts_finish_job(p_job uuid,p_lock uuid,p_path text,p_provider text,p_fallback boolean,p_duration integer,p_error text default null) returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.generation_jobs;s public.photo_sessions;a public.user_access;
begin
 select * into j from public.generation_jobs where id=p_job;
 if not found then return false;end if;
 select * into a from public.user_access where user_id=j.user_id for update;
 select * into s from public.photo_sessions where id=j.session_id for update;
 select * into j from public.generation_jobs where id=p_job for update;
 if j.status<>'processing' or j.lock_token is distinct from p_lock then return false;end if;
 if a.status<>'approved' or s.status<>'processing' then
  update public.generation_jobs set status='cancelled',finished_at=now() where id=j.id;return false;
 end if;
 update public.generation_jobs set status=case when p_error is null then 'ready' else 'failed' end,stage=case when p_error is null then 'ready' else 'failed' end,
 provider=p_provider,fallback_used=p_fallback,duration_ms=p_duration,error_code=p_error,finished_at=now(),lease_until=null where id=j.id;
 update public.photo_sessions set status=case when p_error is null then 'ready' else 'failed' end,result_path=p_path,provider=p_provider,fallback_used=p_fallback,duration_ms=p_duration,
 ready_at=case when p_error is null then now() else null end,error_code=p_error,error_message=case when p_error is null then null else 'No pudimos crear tu foto. Contacta al organizador o vuelve a intentarlo.' end where id=s.id;
 insert into public.audit_logs(actor_user_id,action,target_user_id,entity_id,metadata) values(j.user_id,case when p_error is null then 'generation_ready' else 'generation_failed' end,j.user_id,j.id,jsonb_build_object('provider',p_provider,'fallback',p_fallback));
 return true;
end $$;
create function public.bts_expire_sessions(p_cutoff timestamptz) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 -- Leases never auto-reissue a paid generation. Unknown outcome requires an explicit retry.
 update public.generation_jobs set status='failed',stage='failed',error_code='WORKER_TIMEOUT',finished_at=now() where status='processing' and lease_until<now();
 update public.photo_sessions s set status='failed',error_code='WORKER_TIMEOUT',error_message='La generación tardó demasiado. Puedes reintentar.' where status='processing' and not exists(select 1 from public.generation_jobs j where j.session_id=s.id and j.status='processing');
 update public.generation_jobs j set status='cancelled',finished_at=now() where status in ('queued','processing') and exists(select 1 from public.photo_sessions s where s.id=j.session_id and s.status='cancelled');
 update public.user_access a set status='consumed',consumed_at=now(),updated_at=now() where status='approved' and exists(select 1 from public.photo_sessions s where s.user_id=a.user_id and s.created_at<p_cutoff and s.status not in ('consumed','cancelled','queued','processing'));
 update public.photo_sessions set status='cancelled',selfie_path=null,result_path=null,purged_at=now() where created_at<p_cutoff and purged_at is null and status not in ('queued','processing');
 get diagnostics n=row_count;
 delete from bts_private.rate_limits where window_start<now()-interval '2 days';
 return n;
end $$;
create or replace function public.bts_redeem_download(p_user uuid,p_session uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.photo_sessions;
begin
 perform 1 from public.user_access where user_id=p_user and status='approved' for update;
 if not found then raise exception 'DOWNLOAD_USED';end if;
 select * into s from public.photo_sessions where id=p_session and user_id=p_user for update;
 if not found or s.status<>'ready' or s.downloaded_at is not null or s.result_path is null then raise exception 'DOWNLOAD_USED';end if;
 insert into public.download_events(session_id,user_id) values(s.id,p_user);
 update public.photo_sessions set status='consumed',downloaded_at=now() where id=s.id;
 update public.user_access set status='consumed',consumed_at=now(),updated_at=now() where user_id=p_user;
 insert into public.audit_logs(actor_user_id,action,target_user_id,entity_id) values(p_user,'download_redeemed',p_user,s.id);
 return to_jsonb(s);
end $$;
revoke all on function public.bts_rate_limit(text,integer,integer),public.bts_track_media(uuid,text,text),public.bts_forget_media(text),public.bts_expired_media(timestamptz),public.bts_enqueue_generation(uuid,uuid,integer),public.bts_claim_job(uuid),public.bts_finish_job(uuid,uuid,text,text,boolean,integer,text),public.bts_expire_sessions(timestamptz) from public,anon,authenticated;
grant execute on function public.bts_rate_limit(text,integer,integer),public.bts_track_media(uuid,text,text),public.bts_forget_media(text),public.bts_expired_media(timestamptz),public.bts_enqueue_generation(uuid,uuid,integer),public.bts_claim_job(uuid),public.bts_finish_job(uuid,uuid,text,text,boolean,integer,text),public.bts_expire_sessions(timestamptz) to service_role;
