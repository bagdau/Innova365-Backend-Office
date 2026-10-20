/**
 * Иерархия ролей:
 *   SUPERADMIN («Владелец»)  >  ADMIN («Администратор»)  >  CAJERO / MESERO / COCINERO
 *
 * Владелец и администратор проходят любые проверки ролей на маршрутах (видят и могут делать всё, что остальные роли).
 * Только владелец: журнал действий, управление учётными записями администраторов и владельцев.
 */
export type Rol = 'SUPERADMIN' | 'ADMIN' | 'MESERO' | 'COCINERO' | 'CAJERO';

export const isOwner = (rol: string | undefined): boolean => rol === 'SUPERADMIN';
export const isAdminRole = (rol: string | undefined): boolean => rol === 'ADMIN' || rol === 'SUPERADMIN';
export const isPrivilegedRol = (rol: string | undefined): boolean => isAdminRole(rol);
