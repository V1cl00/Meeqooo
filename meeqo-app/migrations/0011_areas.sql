alter table profiles add column if not exists areas text not null default '[]';

update profiles set areas = '["dating","friends"]' where open_to = 'both' and areas = '[]';
update profiles set areas = '["dating"]' where open_to = 'dating' and areas = '[]';
update profiles set areas = '["friends"]' where open_to = 'friends' and areas = '[]';
