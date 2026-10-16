alter table custom_categories add column if not exists parent text not null default '';

update activities set category = 'Sport · Calisthenics' where id = 'act-cali';
update activities set category = 'Outdoor · Laufen' where id = 'act-jog';
update activities set category = 'Essen · Brunch' where id = 'act-brunch';
update activities set category = 'Outdoor · Spaziergang' where id = 'act-garden';
update activities set category = 'Sport · Klettern' where id = 'act-climb';
update activities set category = 'Essen · Kochen' where id = 'act-cook';
update activities set category = 'Outdoor · Radtour' where id = 'act-bike';
update activities set category = 'Spiele · Brettspiele' where id = 'act-games';
update activities set category = 'Wellness · Therme' where id = 'act-spa';
update activities set category = 'Outdoor · Spaziergang' where id = 'act-past';

update communities set topic = 'Outdoor · Laufen' where id = 'com-joggen';
update communities set topic = 'Sport · Calisthenics' where id = 'com-cali';
update communities set topic = 'Spiele · Brettspiele' where id = 'com-games';
update communities set topic = 'Wellness · Sauna' where id = 'com-sauna';
