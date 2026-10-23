-- Этап 5: безопасность — сессии (список устройств, отзыв), журнал входов, двухфакторная защита.

-- ───────── Сессии: каждый вход — отдельная запись; токен содержит её идентификатор, отозванная сессия перестаёт работать сразу
create table if not exists office.session (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  user_key        text not null,          -- 'usuario:<id>' (владелец, админ) или 'staff:<id>'
  user_name       text,
  role            text,
  ip              text,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  revoked_by      text
);
create index if not exists session_user_idx on office.session (user_key, created_at desc);
create index if not exists session_rest_idx on office.session (restaurante_id, created_at desc);

-- ───────── Журнал входов (успешных и неудачных попыток)
create table if not exists office.login_log (
  id              bigserial primary key,
  restaurante_id  text not null,
  user_key        text,
  email           text,
  ok              boolean not null,
  reason          text,
  ip              text,
  user_agent      text,
  at              timestamptz not null default now()
);
create index if not exists login_log_idx on office.login_log (restaurante_id, at desc);

-- ───────── Двухфакторная защита (TOTP): секрет хранится зашифрованным, коды восстановления — только хэши
create table if not exists office.user_security (
  user_key        text primary key,
  restaurante_id  text not null,
  totp_secret     text,
  totp_enabled    boolean not null default false,
  last_counter    bigint not null default 0,
  recovery_hashes text[] not null default '{}',
  enabled_at      timestamptz,
  updated_at      timestamptz not null default now()
);

-- (триггеров уведомлений здесь нет намеренно: сессии обновляются каждую минуту и не должны перезагружать экраны)
