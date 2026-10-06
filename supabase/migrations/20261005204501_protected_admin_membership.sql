-- Segunda barrera de autorización, protegida de todos los clientes.
create table bts_private.admin_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table bts_private.admin_members enable row level security;
grant all on bts_private.admin_members to service_role;
create function public.bts_admin_allowed(p_user uuid) returns boolean language sql security invoker set search_path='' as $$
 select exists(select 1 from bts_private.admin_members where user_id=p_user)
$$;
create function public.bts_register_admin(p_user uuid) returns void language sql security invoker set search_path='' as $$
 insert into bts_private.admin_members(user_id) values(p_user) on conflict(user_id) do nothing
$$;
revoke execute on function public.bts_admin_allowed(uuid),public.bts_register_admin(uuid) from public,anon,authenticated;
grant execute on function public.bts_admin_allowed(uuid),public.bts_register_admin(uuid) to service_role;

create or replace function public.bts_admin_transition(p_actor uuid,p_user uuid,p_action text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a public.user_access; s uuid;
begin
 if not public.bts_admin_allowed(p_actor) then raise exception 'FORBIDDEN'; end if;
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
