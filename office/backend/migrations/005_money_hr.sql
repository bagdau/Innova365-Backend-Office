-- Этап 2: деньги (счета, движение денег, бюджет) и персонал (штат, табель, зарплата).

-- ───────── Счета: касса, банк, карта. methods — способы оплаты, которые попадают на этот счёт
create table if not exists office.fin_account (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  name            text not null,
  kind            text not null check (kind in ('cash', 'bank', 'card', 'other')),
  opening_balance numeric(16,2) not null default 0,
  opening_date    date not null default current_date,
  methods         text[] not null default '{}',
  active          boolean not null default true,
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists fin_account_rest_idx on office.fin_account (restaurante_id);

-- ───────── Ручные операции по счетам (поступления, расходы, переводы между счетами)
create table if not exists office.fin_tx (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  account_id      text not null references office.fin_account(id) on delete restrict,
  date            date not null,
  direction       text not null check (direction in ('in', 'out')),
  amount          numeric(16,2) not null check (amount > 0),
  category        text,
  counterparty    text,
  description     text,
  doc_number      text,
  transfer_id     text,
  created_by_name text,
  created_at      timestamptz not null default now()
);
create index if not exists fin_tx_idx on office.fin_tx (restaurante_id, date);
create index if not exists fin_tx_acc_idx on office.fin_tx (account_id, date);
create index if not exists fin_tx_transfer_idx on office.fin_tx (transfer_id) where transfer_id is not null;

-- ───────── Бюджет по месяцам. key: revenue | purchases | cat:<id категории расходов>
create table if not exists office.budget (
  restaurante_id text not null,
  month          text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  key            text not null,
  amount         numeric(16,2) not null check (amount >= 0),
  updated_at     timestamptz not null default now(),
  primary key (restaurante_id, month, key)
);

-- ───────── Расходы, созданные автоматически (из зарплатной ведомости, авансов), нельзя править вручную
alter table office.expense add column if not exists source text;
alter table office.expense add column if not exists source_id text;
create index if not exists expense_source_idx on office.expense (source, source_id) where source is not null;

-- ───────── Персонал
create table if not exists office.hr_employee (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  name            text not null,
  position        text,
  pay_kind        text not null default 'salary' check (pay_kind in ('salary', 'hourly', 'daily')),
  rate            numeric(14,2) not null default 0 check (rate >= 0),
  phone           text,
  hire_date       date,
  fire_date       date,
  pos_user_id     text,                       -- связь с пользователем кассы (необязательно)
  active          boolean not null default true,
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists hr_employee_rest_idx on office.hr_employee (restaurante_id);

-- табель: статус дня и часы
create table if not exists office.hr_timesheet (
  employee_id text not null references office.hr_employee(id) on delete cascade,
  date        date not null,
  status      text not null check (status in ('work', 'off', 'sick', 'vacation', 'absent')),
  hours       numeric(5,2) check (hours between 0 and 24),
  primary key (employee_id, date)
);

-- авансы: каждый аванс создаёт расход в бухгалтерии
create table if not exists office.hr_advance (
  id             text primary key default gen_random_uuid()::text,
  restaurante_id text not null,
  employee_id    text not null references office.hr_employee(id) on delete cascade,
  date           date not null,
  amount         numeric(14,2) not null check (amount > 0),
  method         text,
  note           text,
  expense_id     text,
  created_by_name text,
  created_at     timestamptz not null default now()
);
create index if not exists hr_advance_idx on office.hr_advance (restaurante_id, date);

-- зарплатные ведомости за месяц
create table if not exists office.hr_payroll (
  id              text primary key default gen_random_uuid()::text,
  restaurante_id  text not null,
  period          text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status          text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  norm_days       integer not null default 22,
  deduction_pct   numeric(5,2) not null default 0,     -- удержания с сотрудника, % (ставку задаёт бухгалтер)
  employer_pct    numeric(5,2) not null default 0,     -- взносы и налоги работодателя, % (ставку задаёт бухгалтер)
  note            text,
  paid_date       date,
  account_id      text,
  expense_id      text,
  created_by_name text,
  created_at      timestamptz not null default now(),
  unique (restaurante_id, period)
);
create table if not exists office.hr_payroll_line (
  payroll_id   text not null references office.hr_payroll(id) on delete cascade,
  employee_id  text not null,
  name         text not null,
  position     text,
  pay_kind     text not null,
  rate         numeric(14,2) not null,
  worked_days  numeric(6,2) not null default 0,
  worked_hours numeric(8,2) not null default 0,
  base         numeric(14,2) not null default 0,       -- начислено по ставке и табелю
  bonus        numeric(14,2) not null default 0,
  penalty      numeric(14,2) not null default 0,
  advance      numeric(14,2) not null default 0,       -- уже выплачено авансами
  deduction    numeric(14,2) not null default 0,
  note         text,
  primary key (payroll_id, employee_id)
);

-- ───────── Уведомления об изменениях (живое обновление экранов)
do $$
declare t text;
begin
  foreach t in array array['fin_account', 'fin_tx', 'budget', 'hr_employee', 'hr_timesheet', 'hr_advance', 'hr_payroll', 'hr_payroll_line']
  loop
    execute format('drop trigger if exists innova_notify on office.%I', t);
    execute format('create trigger innova_notify after insert or update or delete on office.%I for each row execute function office.innova_notify()', t);
  end loop;
end $$;
