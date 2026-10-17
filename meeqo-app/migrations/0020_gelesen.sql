-- Wann jemand einen Chat zuletzt gelesen hat, fuer "ungelesen" in Liste und Navigation.
create table if not exists chat_reads (
  user_id text not null,
  thread_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
