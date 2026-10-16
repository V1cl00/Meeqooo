alter table profiles add column if not exists traits text not null default '[]';
alter table profiles add column if not exists require_traits text not null default '[]';
alter table activities add column if not exists traits text not null default '[]';
alter table communities add column if not exists traits text not null default '[]';
alter table posts add column if not exists require_traits text not null default '[]';

create table if not exists classifieds (
  id text primary key,
  author_id text not null,
  title text not null,
  body text not null default '',
  category text not null,
  city text not null default '',
  price text not null default '',
  traits text not null default '[]',
  created_at timestamptz not null default now()
);

update profiles set traits = '["Draußen"]' where user_id = 'seed:mira';
update profiles set traits = '["Vegan","Queerfreundlich"]' where user_id = 'seed:nora';
update profiles set traits = '["Queerfreundlich"]' where user_id = 'seed:leonie';
update activities set traits = '["Draußen"]' where id in ('act-jog', 'act-garden', 'act-bike');
update activities set traits = '["Vegan","Alkoholfrei"]' where id = 'act-cook';
update activities set traits = '["Queerfreundlich"]' where id = 'act-games';
update communities set traits = '["Queerfreundlich"]' where id = 'com-games';

insert into custom_categories (id, user_id, name, parent) values
  ('cc-boulder-mira', 'seed:mira', 'Bouldern', 'Sport'),
  ('cc-boulder-amir', 'seed:amir', 'Bouldern', 'Sport'),
  ('cc-boulder-jonas', 'seed:jonas', 'Bouldern', 'Sport')
on conflict (id) do nothing;

insert into classifieds (id, author_id, title, body, category, city, price, traits) values
  ('ad-lamp', 'seed:mira', 'Fahrradlampe, kaum benutzt', 'Ich fahre abends ohne, die Lampe liegt nur rum. Abholung in der Oststadt.', 'Verkaufen', 'Karlsruhe', '12 €', '[]'),
  ('ad-ride', 'seed:jonas', 'Mitfahrt Samstag nach Heidelberg', 'Zwei Plätze, Abfahrt 10 Uhr am Hauptbahnhof. Benzin teilen wir.', 'Mitfahrgelegenheit', 'Karlsruhe', '', '["Alkoholfrei"]')
on conflict (id) do nothing;
