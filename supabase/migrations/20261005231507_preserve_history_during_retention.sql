create or replace function public.bts_expire_sessions(p_cutoff timestamptz) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 -- Leases never auto-reissue a paid generation. Unknown outcome requires an explicit retry.
 update public.generation_jobs set status='failed',stage='failed',error_code='WORKER_TIMEOUT',finished_at=now() where status='processing' and lease_until<now();
 update public.photo_sessions s set status='failed',error_code='WORKER_TIMEOUT',error_message='La generación tardó demasiado. Puedes reintentar.' where status='processing' and not exists(select 1 from public.generation_jobs j where j.session_id=s.id and j.status='processing');
 update public.generation_jobs j set status='cancelled',finished_at=now() where status in ('queued','processing') and exists(select 1 from public.photo_sessions s where s.id=j.session_id and s.status='cancelled');
 update public.user_access a set status='consumed',consumed_at=now(),updated_at=now() where status='approved' and exists(select 1 from public.photo_sessions s where s.user_id=a.user_id and s.created_at<p_cutoff and s.status not in ('consumed','cancelled','queued','processing'));
 update public.photo_sessions set status=case when status in ('consumed','failed','cancelled') then status else 'cancelled' end,selfie_path=null,result_path=null,purged_at=now() where created_at<p_cutoff and purged_at is null and status not in ('queued','processing');
 get diagnostics n=row_count;
 delete from bts_private.rate_limits where window_start<now()-interval '2 days';
 return n;
end $$;

-- Backfill existing references; replacement objects remain tracked until deletion succeeds.
insert into bts_private.media_objects(path,bucket,session_id,created_at) select selfie_path,'user-selfies',id,created_at from public.photo_sessions where selfie_path is not null on conflict(path) do nothing;
insert into bts_private.media_objects(path,bucket,session_id,created_at) select result_path,'generated-images',id,coalesce(ready_at,created_at) from public.photo_sessions where result_path is not null on conflict(path) do nothing;
