-- Этап 1: склад (инвентаризация, списания), поставщики, меню и цены, резервные копии.

-- ───────── Инвентаризация
create sequence if not exists office.stocktake_seq;
create table if not exists office.stocktake (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  number          integer not null default nextval('office.stocktake_seq'),
  title           text not null,
  note            text,
  status          text not null default 'draft' check (status in ('draft', 'closed', 'cancelled')),
  scope           text,                                  -- категория сырья, если считаем не весь склад
  created_by      text, created_by_name text,
  created_at      timestamptz not null default now(),
  closed_at       timestamptz, closed_by_name text,
  shortage_value  numeric(16,2), surplus_value numeric(16,2),   -- недостача / излишек в деньгах (заполняются при закрытии)
  lines_applied   integer
);
create index if not exists stocktake_rest_idx on office.stocktake (restaurante_id, created_at desc);

create table if not exists office.stocktake_line (
  stocktake_id text not null references office.stocktake(id) on delete cascade,
  insumo_id    text not null,
  nombre       text not null,
  unidad       text not null,
  categoria    text,
  book_qty     numeric(18,6) not null,                   -- учётный остаток на момент начала
  actual_qty   numeric(18,6),                            -- факт (null — ещё не пересчитано)
  cost         numeric(14,2),                            -- цена на момент начала
  applied_delta numeric(18,6),                           -- что применено к складу при закрытии
  primary key (stocktake_id, insumo_id)
);

-- ───────── Списания (порча, бой, угощение …)
create sequence if not exists office.writeoff_seq;
create table if not exists office.writeoff (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  number          integer not null default nextval('office.writeoff_seq'),
  date            date not null,
  reason          text not null check (reason in ('spoilage', 'expired', 'breakage', 'staff_meal', 'tasting', 'return', 'other')),
  note            text,
  status          text not null default 'draft' check (status in ('draft', 'approved', 'cancelled')),
  total_cost      numeric(16,2) not null default 0,
  created_by      text, created_by_name text,
  created_at      timestamptz not null default now(),
  approved_at     timestamptz, approved_by_name text
);
create index if not exists writeoff_rest_idx on office.writeoff (restaurante_id, date desc);
create table if not exists office.writeoff_line (
  id           text primary key default gen_random_uuid()::text,
  writeoff_id  text not null references office.writeoff(id) on delete cascade,
  insumo_id    text not null,
  nombre       text not null,
  unidad       text not null,
  qty          numeric(18,6) not null check (qty > 0),
  cost         numeric(14,2)
);
create index if not exists writeoff_line_idx on office.writeoff_line (writeoff_id);

-- ───────── Поставщики: дополнительные реквизиты (основа — таблица Proveedor кассы)
create table if not exists office.supplier_ext (
  proveedor_id    text primary key,
  restaurante_id  text not null,
  bin             text,
  address         text,
  bank            text,
  iban            text,
  payment_days    integer check (payment_days between 0 and 365),   -- отсрочка платежа, дней
  category        text,
  updated_at      timestamptz not null default now()
);

-- ───────── История цен меню
create table if not exists office.price_history (
  id             bigserial primary key,
  restaurante_id text not null,
  producto_id    text not null,
  producto_name  text not null,
  old_price      numeric(14,2),
  new_price      numeric(14,2) not null,
  reason         text,
  changed_by     text, changed_by_name text,
  at             timestamptz not null default now()
);
create index if not exists price_history_idx on office.price_history (restaurante_id, at desc);
create index if not exists price_history_prod_idx on office.price_history (producto_id, at desc);

-- ───────── Резервные копии
create table if not exists office.backup (
  id             text primary key default gen_random_uuid()::text,
  restaurante_id text not null,
  stamp          text not null,
  db_file        text,
  db_size        bigint,
  files_file     text,
  files_size     bigint,
  status         text not null check (status in ('ok', 'error', 'running')),
  error          text,
  auto           boolean not null default false,
  verified_at    timestamptz,
  verified_ok    boolean,
  created_by_name text,
  created_at     timestamptz not null default now()
);
create index if not exists backup_rest_idx on office.backup (restaurante_id, created_at desc);

-- ───────── Уведомления об изменениях (для живого обновления экранов)
do $$
declare t text;
begin
  foreach t in array array['stocktake', 'stocktake_line', 'writeoff', 'writeoff_line', 'supplier_ext', 'price_history', 'backup']
  loop
    execute format('drop trigger if exists innova_notify on office.%I', t);
    execute format('create trigger innova_notify after insert or update or delete on office.%I for each row execute function office.innova_notify()', t);
  end loop;
end $$;
