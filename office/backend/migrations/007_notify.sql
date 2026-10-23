-- Этап 4: рассылки отчётов и уведомления (Telegram, почта).

-- Подписки: кто, что и когда получает. Секреты каналов (токен бота, пароль почты) хранятся зашифрованными в office.setting.
create table if not exists office.subscription (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  kind            text not null check (kind in ('daily', 'weekly', 'monthly', 'reminders', 'alerts')),
  channel         text not null check (channel in ('telegram', 'email')),
  target          text not null,                 -- chat id Telegram или адрес почты
  label           text,                          -- подпись («Владелец», «Бухгалтер»)
  send_time       text not null default '09:00' check (send_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  enabled         boolean not null default true,
  last_sent_at    timestamptz,
  created_by_name text,
  created_at      timestamptz not null default now(),
  unique (restaurante_id, kind, channel, target)
);

-- Журнал отправок
create table if not exists office.notify_log (
  id              bigserial primary key,
  restaurante_id  text not null,
  subscription_id text,
  kind            text not null,
  channel         text not null,
  target          text not null,
  ok              boolean not null,
  error           text,
  at              timestamptz not null default now()
);
create index if not exists notify_log_idx on office.notify_log (restaurante_id, at desc);

-- Какие предупреждения уже отправлены (чтобы не повторять одно и то же)
create table if not exists office.notify_sent (
  restaurante_id text not null,
  key            text not null,
  sent_at        timestamptz not null default now(),
  primary key (restaurante_id, key)
);

do $$
declare t text;
begin
  foreach t in array array['subscription', 'notify_log']
  loop
    execute format('drop trigger if exists innova_notify on office.%I', t);
    execute format('create trigger innova_notify after insert or update or delete on office.%I for each row execute function office.innova_notify()', t);
  end loop;
end $$;
