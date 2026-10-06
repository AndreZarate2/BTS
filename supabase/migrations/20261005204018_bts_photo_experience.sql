-- BTS Photo Experience. Todas las mutaciones críticas se ejecutan desde la Edge Function.
create schema if not exists bts_private;
revoke all on schema bts_private from public, anon, authenticated;
grant usage on schema bts_private to service_role;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(display_name) between 2 and 60),
 created_at timestamptz not null default now()
);
create table public.user_access (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','approved','rejected','blocked','consumed')),
 requested_at timestamptz not null default now(), approved_at timestamptz,
 rejected_at timestamptz, blocked_at timestamptz, consumed_at timestamptz,
 reactivation_count integer not null default 0,
 updated_at timestamptz not null default now()
);
create table public.artists (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 name text not null, enabled boolean not null default true,
 display_order integer not null, created_at timestamptz not null default now()
);
create table public.templates (
 id uuid primary key default gen_random_uuid(), artist_id uuid not null references public.artists(id),
 label text not null default '', storage_path text not null unique,
 active boolean not null default true, placement jsonb not null default '{}',
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.photo_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 artist_id uuid references public.artists(id), template_id uuid references public.templates(id),
 status text not null default 'approved' check (status in ('approved','artist_selected','selfie_uploaded','processing','ready','consumed','failed','cancelled')),
 selfie_path text, result_path text,
 attempts integer not null default 0 check (attempts between 0 and 2),
 created_at timestamptz not null default now(), artist_selected_at timestamptz,
 processing_started_at timestamptz, ready_at timestamptz, downloaded_at timestamptz,
 consent_at timestamptz, purged_at timestamptz, error_code text, error_message text
);
create unique index one_live_cycle on public.photo_sessions(user_id) where status not in ('consumed','cancelled');
create index access_status_requested on public.user_access(status, requested_at);
create index sessions_user_created on public.photo_sessions(user_id,created_at desc);
create index sessions_status_created on public.photo_sessions(status,created_at);
create index sessions_artist on public.photo_sessions(artist_id);
create index sessions_template on public.photo_sessions(template_id);
create index templates_artist_active on public.templates(artist_id,active) where deleted_at is null;
create index templates_created_by on public.templates(created_by);
create table public.audit_logs (
 id bigint generated always as identity primary key,
 actor_user_id uuid references auth.users(id) on delete set null,
 action text not null, target_user_id uuid references public.profiles(id) on delete set null,
 entity_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index audit_created on public.audit_logs(created_at desc);
create index audit_target on public.audit_logs(target_user_id);
create index audit_actor on public.audit_logs(actor_user_id);
create table bts_private.rate_limits (
 key text primary key, window_start timestamptz not null, hits integer not null
);
alter table bts_private.rate_limits enable row level security;
grant all on bts_private.rate_limits to service_role;

alter table public.profiles enable row level security;
alter table public.user_access enable row level security;
alter table public.artists enable row level security;
alter table public.templates enable row level security;
alter table public.photo_sessions enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.profiles, public.user_access, public.artists, public.templates, public.photo_sessions, public.audit_logs from anon, authenticated;
grant select on public.profiles, public.user_access, public.photo_sessions to authenticated;
grant all on public.profiles, public.user_access, public.artists, public.templates, public.photo_sessions, public.audit_logs to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;
create policy own_profile on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy own_access on public.user_access for select to authenticated using ((select auth.uid()) = user_id);
create policy own_sessions on public.photo_sessions for select to authenticated using ((select auth.uid()) = user_id);
-- El panel también usa endpoints autorizados. No hay permisos de escritura ni de archivos en el navegador.

insert into public.artists(slug,name,display_order) values
 ('jungkook','Jungkook',1),('v','V',2),('jimin','Jimin',3),('jin','Jin',4),
 ('rm','RM',5),('jhope','J-Hope',6),('suga','Suga',7),('bts','BTS Group',8);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('artist-templates','artist-templates',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('user-selfies','user-selfies',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('generated-images','generated-images',false,20971520,array['image/jpeg','image/png','image/webp']);

create function public.bts_request_access(p_user uuid,p_name text,p_rate_key text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from public.user_access where user_id=p_user) then
  return jsonb_build_object('existing',true);
 end if;
 if char_length(trim(p_name)) not between 2 and 60 then raise exception 'INVALID_NAME'; end if;
 insert into bts_private.rate_limits(key,window_start,hits) values (p_rate_key,now(),1)
 on conflict(key) do update set
 hits=case when bts_private.rate_limits.window_start < now()-interval '1 hour' then 1 else bts_private.rate_limits.hits+1 end,
 window_start=case when bts_private.rate_limits.window_start < now()-interval '1 hour' then now() else bts_private.rate_limits.window_start end
 returning hits into n;
 if n>20 then raise exception 'RATE_LIMIT'; end if;
 insert into public.profiles(id,display_name) values(p_user,trim(p_name));
 insert into public.user_access(user_id) values(p_user);
 insert into public.audit_logs(actor_user_id,action,target_user_id) values(p_user,'access_requested',p_user);
 return jsonb_build_object('existing',false);
end $$;

create function public.bts_admin_transition(p_actor uuid,p_user uuid,p_action text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a public.user_access; s uuid;
begin
 if not exists(select 1 from auth.users where id=p_actor and is_anonymous=false and raw_app_meta_data @> '{"bts_admin":true}') then raise exception 'FORBIDDEN'; end if;
 select * into a from public.user_access where user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if p_action='approve' and a.status='pending' then
  update public.user_access set status='approved',approved_at=now(),updated_at=now() where user_id=p_user;
  insert into public.photo_sessions(user_id) values(p_user) returning id into s;
 elsif p_action='reject' and a.status='pending' then
  update public.user_access set status='rejected',rejected_at=now(),updated_at=now() where user_id=p_user;
 elsif p_action='block' and a.status='approved' then
  update public.user_access set status='blocked',blocked_at=now(),updated_at=now() where user_id=p_user;
  update public.photo_sessions set status='cancelled' where user_id=p_user and status not in ('consumed','cancelled');
 elsif p_action='reactivate' and a.status in ('consumed','blocked','rejected') then
  update public.photo_sessions set status='cancelled' where user_id=p_user and status not in ('consumed','cancelled');
  update public.user_access set status='approved',approved_at=now(),consumed_at=null,blocked_at=null,rejected_at=null,
   reactivation_count=reactivation_count+1,updated_at=now() where user_id=p_user;
  insert into public.photo_sessions(user_id) values(p_user) returning id into s;
 else raise exception 'INVALID_TRANSITION'; end if;
 insert into public.audit_logs(actor_user_id,action,target_user_id,entity_id) values(p_actor,p_action,p_user,s);
 return jsonb_build_object('session_id',s);
end $$;

create function public.bts_choose_artist(p_user uuid,p_artist uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.photo_sessions; t uuid;
begin
 perform 1 from public.user_access where user_id=p_user and status='approved' for update;
 if not found then raise exception 'ACCESS_REQUIRED'; end if;
 select * into s from public.photo_sessions where user_id=p_user and status not in ('consumed','cancelled') for update;
 if not found then raise exception 'NO_SESSION'; end if;
 if s.template_id is not null then return to_jsonb(s); end if;
 select tp.id into t from public.templates tp join public.artists ar on ar.id=tp.artist_id
  where ar.id=p_artist and ar.enabled and tp.active and tp.deleted_at is null order by random() limit 1;
 if t is null then raise exception 'NO_TEMPLATES'; end if;
 update public.photo_sessions set artist_id=p_artist,template_id=t,status='artist_selected',artist_selected_at=now()
 where id=s.id returning * into s;
 insert into public.audit_logs(actor_user_id,action,target_user_id,entity_id) values(p_user,'artist_selected',p_user,s.id);
 return to_jsonb(s);
end $$;

create function public.bts_attach_selfie(p_user uuid,p_session uuid,p_path text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.photo_sessions;
begin
 perform 1 from public.user_access where user_id=p_user and status='approved' for update;
 if not found then raise exception 'ACCESS_REQUIRED'; end if;
 select * into s from public.photo_sessions where id=p_session and user_id=p_user for update;
 if not found or s.status not in ('artist_selected','selfie_uploaded','failed') or s.attempts>=2 then raise exception 'INVALID_TRANSITION'; end if;
 update public.photo_sessions set selfie_path=p_path,status='selfie_uploaded',consent_at=now(),error_code=null,error_message=null
 where id=s.id returning * into s;
 return to_jsonb(s);
end $$;

create function public.bts_claim_generation(p_user uuid,p_session uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.photo_sessions;
begin
 perform 1 from public.user_access where user_id=p_user and status='approved' for update;
 if not found then raise exception 'ACCESS_REQUIRED'; end if;
 select * into s from public.photo_sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if s.status in ('processing','ready') then return jsonb_build_object('claimed',false,'session',to_jsonb(s)); end if;
 if s.status not in ('selfie_uploaded','failed') or s.selfie_path is null or s.attempts>=2 then raise exception 'INVALID_TRANSITION'; end if;
 update public.photo_sessions set status='processing',attempts=attempts+1,processing_started_at=now(),error_code=null,error_message=null
 where id=s.id returning * into s;
 return jsonb_build_object('claimed',true,'session',to_jsonb(s));
end $$;

create function public.bts_complete_generation(p_session uuid,p_path text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare u uuid;
begin
 select user_id into u from public.photo_sessions where id=p_session;
 perform 1 from public.user_access where user_id=u and status='approved' for update;
 if not found then return false; end if;
 update public.photo_sessions set status='ready',result_path=p_path,ready_at=now()
 where id=p_session and status='processing';
 return found;
end $$;

create function public.bts_redeem_download(p_user uuid,p_session uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.photo_sessions;
begin
 perform 1 from public.user_access where user_id=p_user and status='approved' for update;
 if not found then raise exception 'DOWNLOAD_USED'; end if;
 select * into s from public.photo_sessions where id=p_session and user_id=p_user for update;
 if not found or s.status<>'ready' or s.downloaded_at is not null or s.result_path is null then raise exception 'DOWNLOAD_USED'; end if;
 update public.photo_sessions set status='consumed',downloaded_at=now() where id=s.id;
 update public.user_access set status='consumed',consumed_at=now(),updated_at=now() where user_id=p_user;
 insert into public.audit_logs(actor_user_id,action,target_user_id,entity_id) values(p_user,'download_redeemed',p_user,s.id);
 return to_jsonb(s);
end $$;

revoke execute on function public.bts_request_access(uuid,text,text),public.bts_admin_transition(uuid,uuid,text),
 public.bts_choose_artist(uuid,uuid),public.bts_attach_selfie(uuid,uuid,text),public.bts_claim_generation(uuid,uuid),
 public.bts_complete_generation(uuid,text),public.bts_redeem_download(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bts_request_access(uuid,text,text),public.bts_admin_transition(uuid,uuid,text),
 public.bts_choose_artist(uuid,uuid),public.bts_attach_selfie(uuid,uuid,text),public.bts_claim_generation(uuid,uuid),
 public.bts_complete_generation(uuid,text),public.bts_redeem_download(uuid,uuid) to service_role;

alter publication supabase_realtime add table public.user_access,public.photo_sessions;
