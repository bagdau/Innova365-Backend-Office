import { t } from '../i18n';

/** Человеческие названия действий из журнала (accion в базе → текст). */
const LABELS: Record<string, () => string> = {
  'sesion.entrada': () => t('Entró al sistema'),
  'pedido.crear': () => t('Creó un pedido'),
  'pedido.estado': () => t('Cambió el estado del pedido'),
  'pedido.pago': () => t('Cobró un pedido'),
  'pedido.items': () => t('Añadió productos al pedido'),
  'mesa.crear': () => t('Creó una mesa'),
  'mesa.editar': () => t('Editó una mesa'),
  'mesa.estado': () => t('Cambió el estado de la mesa'),
  'mesa.eliminar': () => t('Eliminó una mesa'),
  'producto.crear': () => t('Creó un producto'),
  'producto.editar': () => t('Editó un producto'),
  'producto.eliminar': () => t('Eliminó un producto'),
  'producto.imagen': () => t('Subió una imagen de producto'),
  'categoria.crear': () => t('Creó una categoría'),
  'inventario.crear': () => t('Creó un insumo'),
  'inventario.editar': () => t('Editó un insumo'),
  'inventario.eliminar': () => t('Eliminó un insumo'),
  'inventario.ajuste': () => t('Ajuste / merma de stock'),
  'inventario.revision': () => t('Aplicó una revisión de inventario'),
  'proveedor.crear': () => t('Creó un proveedor'),
  'proveedor.editar': () => t('Editó un proveedor'),
  'compra.crear': () => t('Creó una compra'),
  'compra.recepcion': () => t('Registró una recepción de compra'),
  'compra.cancelar': () => t('Canceló una compra'),
  'impresora.crear': () => t('Añadió una impresora'),
  'impresora.editar': () => t('Editó una impresora'),
  'impresora.eliminar': () => t('Eliminó una impresora'),
  'impresora.prueba': () => t('Prueba de impresora'),
  'impresion.recibo': () => t('Imprimió un recibo'),
  'impresion.cuenta': () => t('Imprimió una cuenta previa'),
  'impresion.cocina': () => t('Imprimió un ticket de cocina'),
  'impresion.cierre': () => t('Imprimió el resumen del día'),
  'usuario.crear': () => t('Creó un usuario'),
  'usuario.editar': () => t('Editó un usuario'),
  'usuario.desactivar': () => t('Desactivó un usuario'),
  'restaurante.editar': () => t('Cambió los datos del restaurante'),
  'perfil.editar': () => t('Editó su perfil'),
  'perfil.password': () => t('Cambió su contraseña'),
};

export function actionLabel(accion: string): string {
  const denied = accion.endsWith('.denegado');
  const base = denied ? accion.slice(0, -'.denegado'.length) : accion;
  const text = LABELS[base]?.() ?? base;
  return denied ? `${text} — ${t('acceso denegado')}` : text;
}

export const ACTION_GROUPS: Array<{ prefix: string; label: () => string }> = [
  { prefix: 'sesion', label: () => t('Sesiones') },
  { prefix: 'pedido', label: () => t('Pedidos') },
  { prefix: 'mesa', label: () => t('Mesas') },
  { prefix: 'inventario', label: () => t('Inventario') },
  { prefix: 'compra', label: () => t('Compras') },
  { prefix: 'impres', label: () => t('Impresión') },
  { prefix: 'usuario', label: () => t('Usuarios') },
  { prefix: 'producto', label: () => t('Menú') },
];
