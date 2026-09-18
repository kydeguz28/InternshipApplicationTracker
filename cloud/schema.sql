-- Private tracker RPCs; browser roles cannot access backing tables.
-- Only explicitly enrolled users may access this private tracker.
begin;
create schema if not exists private_tracker;
revoke all on schema private_tracker from public,anon,authenticated;
grant usage on schema private_tracker to authenticated;
create table if not exists private_tracker.tracker_members (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists private_tracker.tracker_snapshots (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null check (revision > 0),
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 updated_at timestamptz not null default now()
);
create table if not exists private_tracker.tracker_recovery (
 user_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null,
 payload jsonb not null,
 saved_at timestamptz not null default now(),
 primary key(user_id,revision)
);
alter table private_tracker.tracker_members enable row level security;
alter table private_tracker.tracker_snapshots enable row level security;
alter table private_tracker.tracker_recovery enable row level security;
revoke all on private_tracker.tracker_members,private_tracker.tracker_snapshots,private_tracker.tracker_recovery from public,anon,authenticated;

create table if not exists private_tracker.tracker_invites (
 email text primary key,
 initial_payload jsonb not null
);
alter table private_tracker.tracker_invites enable row level security;
revoke all on private_tracker.tracker_invites from public,anon,authenticated;

create or replace function private_tracker.ensure_member()
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); verified_email text; seed jsonb;
begin
 if uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select lower(email) into verified_email from auth.users where id=uid and email_confirmed_at is not null;
 select initial_payload into seed from private_tracker.tracker_invites where email=verified_email;
 if seed is null then raise exception 'This account is not enrolled for the tracker' using errcode='42501'; end if;
 insert into private_tracker.tracker_members(user_id) values(uid) on conflict do nothing;
 insert into private_tracker.tracker_snapshots(user_id,revision,payload) values(uid,1,seed) on conflict do nothing;
 return uid;
end $$;
revoke all on function private_tracker.ensure_member() from public,anon,authenticated;

create or replace function private_tracker.tracker_read()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private_tracker.ensure_member(); result jsonb;
begin
 if uid is null or not exists(select 1 from private_tracker.tracker_members where user_id=uid) then
  raise exception 'Tracker access denied' using errcode='42501';
 end if;
 select jsonb_build_object('revision',revision,'payload',payload) into result
 from private_tracker.tracker_snapshots where user_id=uid;
 return coalesce(result,jsonb_build_object('revision',0,'payload',null));
end $$;

create or replace function private_tracker.tracker_write(expected_revision bigint, new_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private_tracker.ensure_member(); current_revision bigint; next_revision bigint;
begin
 if uid is null or not exists(select 1 from private_tracker.tracker_members where user_id=uid) then
  raise exception 'Tracker access denied' using errcode='42501';
 end if;
 if new_payload is null or (new_payload->>'schemaVersion') is distinct from '1'
    or jsonb_typeof(new_payload->'applications') is distinct from 'array'
    or pg_column_size(new_payload)>1048576 then
  raise exception 'Invalid snapshot' using errcode='22023';
 end if;
 if jsonb_array_length(new_payload->'applications')>10000 then
  raise exception 'Too many roles' using errcode='22023';
 end if;
 -- Locks the enrolled user even before their first snapshot exists.
 perform 1 from private_tracker.tracker_members where user_id=uid for update;
 select revision into current_revision from private_tracker.tracker_snapshots where user_id=uid;
 current_revision:=coalesce(current_revision,0);
 if expected_revision is distinct from current_revision then
  raise exception 'Cloud changed; fetch and merge again' using errcode='40001';
 end if;
 next_revision:=current_revision+1;
 insert into private_tracker.tracker_recovery(user_id,revision,payload)
 select user_id,revision,payload from private_tracker.tracker_snapshots where user_id=uid;
 insert into private_tracker.tracker_snapshots(user_id,revision,payload)
 values(uid,next_revision,new_payload)
 on conflict(user_id) do update set revision=excluded.revision,payload=excluded.payload,updated_at=now();
 delete from private_tracker.tracker_recovery where user_id=uid and revision<=next_revision-20;
 return jsonb_build_object('revision',next_revision);
end $$;
revoke all on function private_tracker.tracker_read() from public,anon,authenticated;
revoke all on function private_tracker.tracker_write(bigint,jsonb) from public,anon,authenticated;
grant execute on function private_tracker.tracker_read() to authenticated;
grant execute on function private_tracker.tracker_write(bigint,jsonb) to authenticated;
create or replace function public.tracker_read()
returns jsonb language sql security invoker set search_path = '' as $$
 select private_tracker.tracker_read();
$$;
create or replace function public.tracker_write(expected_revision bigint,new_payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
 select private_tracker.tracker_write(expected_revision,new_payload);
$$;
revoke all on function public.tracker_read() from public,anon,authenticated;
revoke all on function public.tracker_write(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.tracker_read() to authenticated;
grant execute on function public.tracker_write(bigint,jsonb) to authenticated;
commit;
