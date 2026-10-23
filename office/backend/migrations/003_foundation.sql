-- Фундамент расширения Office: новые роли, настраиваемые права, вложения.

-- ───────── Роли: добавляются «кладовщик» и «арендатор» (менеджер точки фудкорта; видит только свою точку)
alter table office.staff drop constraint if exists staff_role_check;
alter table office.staff add constraint staff_role_check check (role in ('accountant', 'technologist', 'foodcourt', 'storekeeper', 'tenant'));
alter table office.staff add column if not exists outlet_id text references office.outlet(id) on delete set null;

-- ───────── Права по ролям: хранятся только отличия от набора по умолчанию
create table if not exists office.role_perm (
  restaurante_id text not null,
  role           text not null,
  perm           text not null,
  granted        boolean not null,
  updated_at     timestamptz not null default now(),
  primary key (restaurante_id, role, perm)
);
drop trigger if exists innova_notify on office.role_perm;
create trigger innova_notify after insert or update or delete on office.role_perm for each row execute function office.innova_notify();

-- ───────── Вложения: сканы накладных, договоры, акты (файлы лежат на диске, здесь — описание)
create table if not exists office.attachment (
  id             text primary key default gen_random_uuid()::text,
  restaurante_id text not null,
  entity         text not null,
  entity_id      text not null,
  name           text not null,
  mime           text not null,
  size           integer not null,
  storage_name   text not null,
  uploaded_by    text,
  uploaded_by_name text,
  created_at     timestamptz not null default now()
);
create index if not exists attachment_entity_idx on office.attachment (restaurante_id, entity, entity_id);
