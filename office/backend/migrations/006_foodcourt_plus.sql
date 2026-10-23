-- Этап 3: фудкорт — договоры аренды, история арендной ставки, счета и акты арендаторам.

-- ───────── Договоры аренды (один действующий на точку)
create table if not exists office.lease (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  outlet_id       text not null references office.outlet(id) on delete cascade,
  number          text not null,
  signed_date     date,
  start_date      date not null,
  end_date        date,
  rent_monthly    numeric(14,2) not null default 0 check (rent_monthly >= 0),
  commission_pct  numeric(5,2)  not null default 0 check (commission_pct between 0 and 100),
  deposit         numeric(14,2) not null default 0 check (deposit >= 0),
  deposit_paid    boolean not null default false,
  payment_day     integer check (payment_day between 1 and 31),
  indexation_pct  numeric(5,2) not null default 0 check (indexation_pct between 0 and 100),
  indexation_month integer check (indexation_month between 1 and 12),
  notice_days     integer not null default 30 check (notice_days between 0 and 365),
  status          text not null default 'active' check (status in ('draft', 'active', 'ended', 'terminated')),
  notes           text,
  created_by_name text,
  created_at      timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create unique index if not exists lease_one_active on office.lease (outlet_id) where status = 'active';
create index if not exists lease_rest_idx on office.lease (restaurante_id);

-- ───────── История арендной ставки: расчёты за прошлые периоды считаются по ставке, действовавшей в каждый день
create table if not exists office.outlet_rent_history (
  id              bigserial primary key,
  restaurante_id  text not null,
  outlet_id       text not null references office.outlet(id) on delete cascade,
  effective_from  date not null,
  rent_monthly    numeric(14,2) not null check (rent_monthly >= 0),
  reason          text,
  created_by_name text,
  created_at      timestamptz not null default now(),
  unique (outlet_id, effective_from)
);

-- ───────── Счета на оплату и акты оказанных услуг арендаторам
create sequence if not exists office.invoice_seq;
create table if not exists office.invoice (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  number          integer not null default nextval('office.invoice_seq'),
  kind            text not null check (kind in ('invoice', 'act')),
  outlet_id       text not null references office.outlet(id) on delete restrict,
  date            date not null,
  due_date        date,
  period_from     date,
  period_to       date,
  title           text,
  status          text not null default 'draft' check (status in ('draft', 'issued', 'cancelled')),
  settlement_id   text,
  total           numeric(14,2) not null default 0,
  note            text,
  created_by_name text,
  created_at      timestamptz not null default now(),
  issued_at       timestamptz
);
create index if not exists invoice_rest_idx on office.invoice (restaurante_id, date desc);
create index if not exists invoice_outlet_idx on office.invoice (outlet_id);

create table if not exists office.invoice_line (
  id          text primary key default gen_random_uuid()::text,
  invoice_id  text not null references office.invoice(id) on delete cascade,
  position    integer not null default 0,
  description text not null,
  qty         numeric(12,3) not null default 1 check (qty > 0),
  price       numeric(14,2) not null,
  amount      numeric(14,2) not null
);
create index if not exists invoice_line_idx on office.invoice_line (invoice_id);

create table if not exists office.invoice_payment (
  id              text primary key default gen_random_uuid()::text,
  invoice_id      text not null references office.invoice(id) on delete cascade,
  restaurante_id  text not null,
  date            date not null,
  amount          numeric(14,2) not null check (amount > 0),
  method          text,
  note            text,
  created_by_name text,
  created_at      timestamptz not null default now()
);
create index if not exists invoice_payment_idx on office.invoice_payment (invoice_id);

do $$
declare t text;
begin
  foreach t in array array['lease', 'outlet_rent_history', 'invoice', 'invoice_line', 'invoice_payment']
  loop
    execute format('drop trigger if exists innova_notify on office.%I', t);
    execute format('create trigger innova_notify after insert or update or delete on office.%I for each row execute function office.innova_notify()', t);
  end loop;
end $$;
