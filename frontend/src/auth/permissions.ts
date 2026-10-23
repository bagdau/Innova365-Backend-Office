import type { Rol } from '../types';

/**
 * Иерархия ролей:  SUPERADMIN («Владелец»)  >  ADMIN («Администратор»)  >  CAJERO / MESERO / COCINERO / REPARTIDOR.
 * Владелец и администратор открывают любой раздел и могут делать всё, что другие роли.
 * Только владелец: «Журнал действий» и управление учётными записями администраторов.
 * (Сервер проверяет каждую операцию заново: backend/src/routes/index.ts.)
 */
const ALL: Rol[] = ['SUPERADMIN', 'ADMIN', 'MESERO', 'COCINERO', 'CAJERO', 'REPARTIDOR'];

export const ROUTE_ROLES = {
  dashboard:     ['ADMIN', 'MESERO', 'CAJERO'],
  mesas:         ['ADMIN', 'MESERO', 'CAJERO'],
  pedidos:       ['ADMIN', 'MESERO', 'CAJERO', 'COCINERO'],
  pedidosNuevo:  ['ADMIN', 'MESERO', 'CAJERO'],
  cocina:        ['ADMIN', 'COCINERO'],
  entregas:      ['ADMIN', 'REPARTIDOR'],
  mesero:        ['ADMIN', 'MESERO'],
  menu:          ['ADMIN'],
  inventario:    ['ADMIN'],
  reportes:      ['ADMIN', 'CAJERO'],
  caja:          ['ADMIN', 'CAJERO'],
  usuarios:      ['ADMIN'],
  configuracion: ['ADMIN'],
  monitor:       ['ADMIN'],
  auditoria:     ['SUPERADMIN'],
  perfil:        ALL,
  notificaciones: ALL,
} satisfies Record<string, Rol[]>;

export type RouteKey = keyof typeof ROUTE_ROLES;

const OWNER_ONLY = new Set<RouteKey>(['auditoria']);

export const isOwner = (rol: Rol | undefined): boolean => rol === 'SUPERADMIN';
/** Владелец или администратор */
export const isAdminLike = (rol: Rol | undefined): boolean => rol === 'ADMIN' || rol === 'SUPERADMIN';

export function can(rol: Rol | undefined, route: RouteKey): boolean {
  if (!rol) return false;
  if (OWNER_ONLY.has(route)) return rol === 'SUPERADMIN';
  if (isAdminLike(rol)) return true;
  return (ROUTE_ROLES[route] as Rol[]).includes(rol);
}

/** Пантеон ролей, которые текущий пользователь может назначать при создании/редактировании сотрудников. */
export function assignableRoles(actor: Rol | undefined): Rol[] {
  if (actor === 'SUPERADMIN') return ['SUPERADMIN', 'ADMIN', 'CAJERO', 'MESERO', 'COCINERO', 'REPARTIDOR'];
  if (actor === 'ADMIN') return ['CAJERO', 'MESERO', 'COCINERO', 'REPARTIDOR'];
  return [];
}

/** Можно ли менять учётную запись `target` (администратор не трогает чужих администраторов и владельца). */
export function canManageUser(actor: Rol | undefined, actorId: string | undefined, target: { id: string; rol: Rol }): boolean {
  if (actor === 'SUPERADMIN') return true;
  if (actor === 'ADMIN') return !isAdminLike(target.rol) || target.id === actorId;
  return false;
}

/** Стартовая страница роли (чтобы не отправлять на раздел без доступа). */
export function homeFor(rol: Rol | undefined): string {
  switch (rol) {
    case 'COCINERO': return '/cocina';
    case 'CAJERO':   return '/caja';
    case 'REPARTIDOR': return '/entregas';
    case undefined:  return '/login';
    default:         return '/dashboard';
  }
}
