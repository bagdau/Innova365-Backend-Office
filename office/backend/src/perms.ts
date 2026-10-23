import { q } from './db';

/**
 * Роли и права Office.
 *  owner / admin — учётные записи основной системы (SUPERADMIN / ADMIN);
 *  остальные — сотрудники офиса (office.staff).
 * Набор прав каждой роли можно менять (страница «Права доступа»): в БД хранятся только отличия от набора по умолчанию.
 */
export type Role = 'owner' | 'admin' | 'accountant' | 'technologist' | 'foodcourt' | 'storekeeper' | 'tenant';

export const ROLES: Role[] = ['owner', 'admin', 'accountant', 'technologist', 'foodcourt', 'storekeeper', 'tenant'];
export const STAFF_ROLES = ['accountant', 'technologist', 'foodcourt', 'storekeeper', 'tenant'] as const;

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Владелец', admin: 'Администратор', accountant: 'Бухгалтер', technologist: 'Технолог', foodcourt: 'Менеджер фудкорта',
  storekeeper: 'Кладовщик', tenant: 'Арендатор (точка)',
};

export const ROLE_NOTE: Record<Role, string> = {
  owner: 'полный доступ; права не ограничиваются',
  admin: 'почти полный доступ; управление сотрудниками, настройками и правами защищено от случайной блокировки',
  accountant: 'выручка, расходы, закупки и долги, деньги, зарплата, отчёты, расчёты с точками',
  technologist: 'техкарты, справочник сырья, меню (без денег и цен продажи)',
  foodcourt: 'точки, договоры, счета и акты, выручка и взаиморасчёты',
  storekeeper: 'склад: приёмка, инвентаризация, списания, поставщики',
  tenant: 'только своя точка: выручка, расчёты, счета и акты',
};

export interface PermInfo { id: string; group: string; label: string }
export const PERM_LIST: PermInfo[] = [
  { id: 'dashboard', group: 'Обзор', label: 'Панель показателей' },
  { id: 'fc.view', group: 'Фудкорт', label: 'Просмотр точек, выручки, расчётов' },
  { id: 'fc.edit', group: 'Фудкорт', label: 'Изменение точек, договоров' },
  { id: 'fc.settle', group: 'Фудкорт', label: 'Взаиморасчёты, счета и акты' },
  { id: 'tc.view', group: 'Технологи', label: 'Просмотр техкарт и сырья' },
  { id: 'tc.edit', group: 'Технологи', label: 'Изменение техкарт' },
  { id: 'tc.approve', group: 'Технологи', label: 'Согласование техкарт' },
  { id: 'ing.edit', group: 'Технологи', label: 'Справочник сырья' },
  { id: 'ing.cost', group: 'Технологи', label: 'Цены сырья' },
  { id: 'acc.view', group: 'Бухгалтерия', label: 'Просмотр выручки, расходов, закупок' },
  { id: 'acc.write', group: 'Бухгалтерия', label: 'Ввод расходов, закупок, оплат' },
  { id: 'inv.view', group: 'Склад', label: 'Просмотр остатков и движения' },
  { id: 'inv.edit', group: 'Склад', label: 'Инвентаризация и списания' },
  { id: 'inv.approve', group: 'Склад', label: 'Утверждение инвентаризации и списаний' },
  { id: 'sup.view', group: 'Поставщики', label: 'Просмотр поставщиков' },
  { id: 'sup.edit', group: 'Поставщики', label: 'Изменение поставщиков' },
  { id: 'menu.view', group: 'Меню', label: 'Просмотр меню, цен, маржи' },
  { id: 'menu.edit', group: 'Меню', label: 'Изменение меню и цен' },
  { id: 'ctl.view', group: 'Контроль', label: 'Отчёты по сотрудникам, отмены' },
  { id: 'fin.view', group: 'Финансы', label: 'Просмотр счетов, движения денег, бюджета' },
  { id: 'fin.write', group: 'Финансы', label: 'Ввод операций и бюджета' },
  { id: 'hr.view', group: 'Персонал', label: 'Просмотр табеля и ведомостей' },
  { id: 'hr.write', group: 'Персонал', label: 'Табель и расчёт зарплаты' },
  { id: 'rep.view', group: 'Отчёты', label: 'Расширенные отчёты' },
  { id: 'rep.schedule', group: 'Отчёты', label: 'Рассылки по расписанию' },
  { id: 'notify', group: 'Система', label: 'Уведомления (Telegram, почта)' },
  { id: 'files', group: 'Система', label: 'Загрузка и удаление вложений' },
  { id: 'sys.view', group: 'Система', label: 'Состояние системы' },
  { id: 'sys.backup', group: 'Система', label: 'Резервные копии' },
  { id: 'staff', group: 'Администрирование', label: 'Сотрудники' },
  { id: 'audit', group: 'Администрирование', label: 'Журнал действий и входов' },
  { id: 'settings', group: 'Администрирование', label: 'Настройки' },
  { id: 'roles', group: 'Администрирование', label: 'Права доступа ролей' },
  { id: 'tenant', group: 'Арендатор', label: 'Кабинет арендатора (своя точка)' },
];
export type Perm = 'dashboard' | 'fc.view' | 'fc.edit' | 'fc.settle' | 'tc.view' | 'tc.edit' | 'tc.approve' | 'ing.edit' | 'ing.cost' | 'acc.view' | 'acc.write'
  | 'inv.view' | 'inv.edit' | 'inv.approve' | 'sup.view' | 'sup.edit' | 'menu.view' | 'menu.edit' | 'ctl.view' | 'fin.view' | 'fin.write' | 'hr.view' | 'hr.write'
  | 'rep.view' | 'rep.schedule' | 'notify' | 'files' | 'sys.view' | 'sys.backup' | 'staff' | 'audit' | 'settings' | 'roles' | 'tenant';

const ALL = PERM_LIST.map((p) => p.id as Perm);
const ADMIN_PERMS = ALL.filter((p) => p !== 'tenant');

export const DEFAULT_PERMS: Record<Role, Perm[]> = {
  owner: ADMIN_PERMS,
  admin: ADMIN_PERMS.filter((p) => p !== 'roles'),
  accountant: ['dashboard', 'fc.view', 'fc.settle', 'tc.view', 'ing.cost', 'acc.view', 'acc.write', 'inv.view', 'sup.view', 'sup.edit', 'menu.view', 'ctl.view', 'fin.view', 'fin.write', 'hr.view', 'hr.write', 'rep.view', 'rep.schedule', 'files'],
  technologist: ['dashboard', 'tc.view', 'tc.edit', 'ing.edit', 'inv.view', 'menu.view'],
  foodcourt: ['dashboard', 'fc.view', 'fc.edit', 'fc.settle', 'rep.view', 'files'],
  storekeeper: ['dashboard', 'tc.view', 'inv.view', 'inv.edit', 'sup.view', 'files'],
  tenant: ['tenant'],
};

/** Эти права нельзя забрать у роли — иначе можно заблокировать управление системой. */
export const LOCKED: Partial<Record<Role, Perm[]>> = {
  owner: ADMIN_PERMS,
  admin: ['staff', 'settings', 'audit'],
  tenant: ['tenant'],
};
/** Права, которые нельзя выдать роли (кабинет арендатора — только роли «арендатор»; «роли» — только владельцу). */
const FORBIDDEN: Partial<Record<Role, Perm[]>> = {
  owner: ['tenant'], admin: ['tenant', 'roles'],
  accountant: ['tenant', 'roles'], technologist: ['tenant', 'roles'], foodcourt: ['tenant', 'roles'], storekeeper: ['tenant', 'roles'],
  tenant: ALL.filter((p) => p !== 'tenant'),
};

/* ───────── Кэш: набор прав каждой роли по ресторанам ───────── */
const cache = new Map<string, Map<Role, Set<Perm>>>();
export const resetPerms = (): void => { cache.clear(); };

export async function loadPerms(rid: string): Promise<Map<Role, Set<Perm>>> {
  const hit = cache.get(rid);
  if (hit) return hit;
  const rows = await q<{ role: Role; perm: Perm; granted: boolean }>('select role, perm, granted from office.role_perm where restaurante_id = $1', [rid]);
  const m = new Map<Role, Set<Perm>>();
  for (const r of ROLES) {
    const set = new Set<Perm>(DEFAULT_PERMS[r]);
    for (const o of rows) if (o.role === r && !(LOCKED[r] ?? []).includes(o.perm) && !(FORBIDDEN[r] ?? []).includes(o.perm)) { if (o.granted) set.add(o.perm); else set.delete(o.perm); }
    for (const l of LOCKED[r] ?? []) set.add(l);
    m.set(r, set);
  }
  cache.set(rid, m);
  return m;
}

/** Права роли в данном ресторане. Кэш заполняется в auth (перед обработчиками); без него — набор по умолчанию. */
export function permsOf(me: { role: Role; rid: string }): Perm[] {
  const set = cache.get(me.rid)?.get(me.role);
  return set ? [...set] : DEFAULT_PERMS[me.role] ?? [];
}
export const hasPerm = (me: { role: Role; rid: string }, p: Perm): boolean => {
  const set = cache.get(me.rid)?.get(me.role);
  return set ? set.has(p) : (DEFAULT_PERMS[me.role] ?? []).includes(p);
};

export function isLocked(role: Role, p: Perm): boolean { return (LOCKED[role] ?? []).includes(p) || (FORBIDDEN[role] ?? []).includes(p); }

/** Сохранить набор прав роли (записываются только отличия от набора по умолчанию). */
export async function savePerms(rid: string, role: Role, perms: Perm[]): Promise<void> {
  const want = new Set<Perm>(perms.filter((p) => ALL.includes(p)));
  for (const l of LOCKED[role] ?? []) want.add(l);
  for (const f of FORBIDDEN[role] ?? []) want.delete(f);
  const def = new Set(DEFAULT_PERMS[role]);
  await q('delete from office.role_perm where restaurante_id = $1 and role = $2', [rid, role]);
  for (const p of ALL) {
    if (want.has(p) !== def.has(p) && !isLocked(role, p)) await q('insert into office.role_perm (restaurante_id, role, perm, granted) values ($1,$2,$3,$4)', [rid, role, p, want.has(p)]);
  }
  resetPerms();
}
