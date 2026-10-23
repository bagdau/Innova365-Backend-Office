-- Innova Office: собственные таблицы бэкенд-офиса. Живут в отдельной схеме office и не пересекаются с миграциями основной системы (Prisma, схема public).

-- ───────── Сотрудники офиса (технологи, бухгалтеры, менеджеры фудкорта). Администраторы и владелец входят по своим учётным записям основной системы.
create table if not exists office.staff (
  id            text primary key default gen_random_uuid()::text,
  restaurante_id text not null,
  nombre        text not null,
  email         text not null,
  password_hash text not null,
  role          text not null check (role in ('accountant', 'technologist', 'foodcourt')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login    timestamptz
);
create unique index if not exists staff_email_uq on office.staff (lower(email));
create index if not exists staff_rest_idx on office.staff (restaurante_id);

-- ───────── Настройки (ключ → JSON)
create table if not exists office.setting (
  restaurante_id text not null,
  key            text not null,
  value          jsonb not null,
  updated_at     timestamptz not null default now(),
  primary key (restaurante_id, key)
);

-- ───────── Журнал действий
create table if not exists office.audit (
  id             bigserial primary key,
  restaurante_id text not null,
  user_id        text,
  user_name      text,
  role           text,
  action         text not null,
  entity         text,
  entity_id      text,
  detail         jsonb,
  at             timestamptz not null default now()
);
create index if not exists audit_rest_at_idx on office.audit (restaurante_id, at desc);

-- ───────── Фудкорт: точки (арендаторы)
create table if not exists office.outlet (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  name            text not null,
  legal_name      text,
  bin             text,
  contact         text,
  phone           text,
  email           text,
  rent_monthly    numeric(14,2) not null default 0,
  commission_pct  numeric(5,2)  not null default 0 check (commission_pct between 0 and 100),
  status          text not null default 'active' check (status in ('active', 'paused', 'closed')),
  start_date      date,
  end_date        date,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists outlet_rest_idx on office.outlet (restaurante_id);

-- Какие категории меню принадлежат какой точке (выручка делится по позициям заказов)
create table if not exists office.outlet_category (
  restaurante_id text not null,
  categoria_id   text not null,
  outlet_id      text not null references office.outlet(id) on delete cascade,
  primary key (restaurante_id, categoria_id)
);
create index if not exists outlet_category_outlet_idx on office.outlet_category (outlet_id);

-- Взаиморасчёты с точками за период
create sequence if not exists office.settlement_seq;
create table if not exists office.settlement (
  id             text primary key default gen_random_uuid()::text,
  restaurante_id text not null,
  number         int  not null default nextval('office.settlement_seq'),
  outlet_id      text not null references office.outlet(id) on delete restrict,
  period_from    date not null,
  period_to      date not null,
  orders         int  not null default 0,
  revenue        numeric(14,2) not null default 0,
  commission_pct numeric(5,2)  not null default 0,
  commission     numeric(14,2) not null default 0,
  rent           numeric(14,2) not null default 0,
  payable        numeric(14,2) not null default 0,
  status         text not null default 'draft' check (status in ('draft', 'issued', 'paid')),
  issued_at      timestamptz,
  paid_at        timestamptz,
  paid_method    text,
  notes          text,
  created_by     text,
  created_at     timestamptz not null default now()
);
create index if not exists settlement_rest_idx on office.settlement (restaurante_id, period_from desc);

-- ───────── Техкарты: статус согласования и история версий
create table if not exists office.tc_state (
  producto_id    text primary key,
  restaurante_id text not null,
  status         text not null default 'draft' check (status in ('draft', 'review', 'approved', 'rejected')),
  version        int  not null default 1,
  comment        text,
  updated_by     text,
  updated_at     timestamptz not null default now(),
  approved_by    text,
  approved_at    timestamptz
);
create index if not exists tc_state_rest_idx on office.tc_state (restaurante_id);

create table if not exists office.tc_version (
  id             bigserial primary key,
  producto_id    text not null,
  restaurante_id text not null,
  version        int  not null,
  action         text not null,
  comment        text,
  user_name      text,
  snapshot       jsonb not null,
  created_at     timestamptz not null default now()
);
create index if not exists tc_version_prod_idx on office.tc_version (producto_id, version desc);

-- ───────── Бухгалтерия: расходы
create table if not exists office.expense_category (
  id             text primary key default gen_random_uuid()::text,
  restaurante_id text not null,
  name           text not null,
  kind           text not null default 'opex' check (kind in ('opex', 'payroll', 'tax', 'rent', 'other')),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create unique index if not exists expense_category_uq on office.expense_category (restaurante_id, lower(name));

create table if not exists office.expense (
  id             text primary key default gen_random_uuid()::text,
  restaurante_id text not null,
  date           date not null,
  category_id    text not null references office.expense_category(id) on delete restrict,
  amount         numeric(14,2) not null check (amount > 0),
  description    text,
  doc_number     text,
  counterparty   text,
  method         text,
  status         text not null default 'paid' check (status in ('paid', 'pending')),
  created_by     text,
  created_at     timestamptz not null default now()
);
create index if not exists expense_rest_date_idx on office.expense (restaurante_id, date desc);

-- Оплаты поставщикам по закупкам основной системы
create table if not exists office.purchase_payment (
  id             text primary key default gen_random_uuid()::text,
  restaurante_id text not null,
  compra_id      text not null,
  date           date not null,
  amount         numeric(14,2) not null check (amount > 0),
  method         text,
  note           text,
  created_by     text,
  created_at     timestamptz not null default now()
);
create index if not exists purchase_payment_compra_idx on office.purchase_payment (compra_id);

-- ───────── Начальные данные
-- категории расходов по умолчанию для каждого ресторана
insert into office.expense_category (restaurante_id, name, kind)
select r.id, c.name, c.kind from public."Restaurante" r
cross join (values ('Аренда', 'rent'), ('Зарплата и взносы', 'payroll'), ('Коммунальные услуги', 'opex'), ('Налоги', 'tax'),
                   ('Маркетинг и реклама', 'opex'), ('Обслуживание и ремонт', 'opex'), ('Банковские комиссии', 'opex'), ('Прочее', 'other')) as c(name, kind)
on conflict do nothing;

-- уже существующие тех-карты (импорт из документа ред. 1.0) получают статус «черновик», версия 1
insert into office.tc_state (producto_id, restaurante_id, status, version, comment, updated_by)
select r."productoId", r."restauranteId", 'draft', 1, 'Импорт из «Технологические паспорта блюд и напитков», ред. 1.0', 'система'
from public."Receta" r on conflict do nothing;

insert into office.tc_version (producto_id, restaurante_id, version, action, comment, user_name, snapshot)
select r."productoId", r."restauranteId", 1, 'import', 'Импорт из документа ред. 1.0', 'система',
  jsonb_build_object('rendimiento', r.rendimiento, 'tecnologia', r.tecnologia,
    'items', coalesce((select jsonb_agg(jsonb_build_object('insumoId', i."insumoId", 'componenteId', i."componenteId", 'cantidad', i.cantidad, 'neto', i.neto) order by i.id)
                       from public."RecetaItem" i where i."recetaId" = r.id), '[]'::jsonb))
from public."Receta" r
where not exists (select 1 from office.tc_version v where v.producto_id = r."productoId");
