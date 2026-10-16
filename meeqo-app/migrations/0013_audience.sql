alter table profiles add column if not exists audience_ids text not null default '[]';
alter table activities add column if not exists audience_ids text not null default '[]';
alter table posts add column if not exists audience_ids text not null default '[]';
alter table classifieds add column if not exists audience_ids text not null default '[]';
