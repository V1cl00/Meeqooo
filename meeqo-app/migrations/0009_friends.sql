alter table profiles add column if not exists birth_year integer;
alter table posts add column if not exists visibility text not null default 'all';
alter table activities add column if not exists visibility text not null default 'all';
alter table classifieds add column if not exists visibility text not null default 'all';

create table if not exists friendships (
  id text primary key,
  requester_id text not null,
  addressee_id text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

create index if not exists friendships_addressee_idx on friendships (addressee_id, status);

update profiles set birth_year = 1994 where user_id = 'seed:nora' and birth_year is null;
update profiles set birth_year = 1991 where user_id = 'seed:mira' and birth_year is null;
update profiles set birth_year = 1996 where user_id = 'seed:jonas' and birth_year is null;
update profiles set birth_year = 1988 where user_id = 'seed:leonie' and birth_year is null;
