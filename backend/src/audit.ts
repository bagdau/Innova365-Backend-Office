import { Request } from 'express';
import { prisma } from './prisma';
import { emitirCambio } from './events';

/**
 * Журнал действий: кто, когда и что сделал. Пишутся только действия-изменения (POST/PUT/PATCH/DELETE) и
 * отказы в доступе (403); тела запросов и пароли не сохраняются — только короткая безопасная пометка.
 */
interface Described { accion: string; detalle?: string; ref?: string }

export function describe(req: Request): Described | null {
  const m = req.method;
  const seg = req.path.split('/').filter(Boolean);
  const [a, id, c] = seg;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const put = m === 'PUT' || m === 'PATCH';

  switch (a) {
    case 'pedidos':
      if (!id) return m === 'POST' ? { accion: 'pedido.crear', detalle: `tipo=${b.tipo ?? ''}` } : null;
      if (c === 'estado') return { accion: 'pedido.estado', ref: id, detalle: `estado=${b.estado ?? ''}` };
      if (c === 'pago') return { accion: 'pedido.pago', ref: id, detalle: `metodo=${b.metodoPago ?? ''}` };
      if (c === 'items') return { accion: 'pedido.items', ref: id };
      return null;
    case 'mesas':
      if (!id) return { accion: 'mesa.crear' };
      if (c === 'estado') return { accion: 'mesa.estado', ref: id, detalle: `estado=${b.estado ?? ''}` };
      return { accion: m === 'DELETE' ? 'mesa.eliminar' : 'mesa.editar', ref: id };
    case 'menu':
      if (id === 'productos' || id === 'categorias') {
        const kind = id === 'productos' ? 'producto' : 'categoria';
        const ref = c;
        if (m === 'POST') return { accion: `${kind}.crear` };
        return { accion: m === 'DELETE' ? `${kind}.eliminar` : `${kind}.editar`, ref };
      }
      return id === 'upload-imagen' ? { accion: 'producto.imagen' } : null;
    case 'inventario':
      if (!id) return { accion: 'inventario.crear' };
      if (id === 'revision') return { accion: 'inventario.revision' };
      if (c === 'ajuste') return { accion: 'inventario.ajuste', ref: id, detalle: `tipo=${b.tipo ?? ''}` };
      return { accion: m === 'DELETE' ? 'inventario.eliminar' : 'inventario.editar', ref: id };
    case 'recetas':
      return put ? { accion: 'receta.editar', ref: id, detalle: Array.isArray(b.items) ? `ингредиентов=${b.items.length}` : undefined } : null;
    case 'proveedores':
      return { accion: m === 'POST' ? 'proveedor.crear' : 'proveedor.editar', ref: id };
    case 'compras':
      if (!id) return { accion: 'compra.crear' };
      if (c === 'recepcion') return { accion: 'compra.recepcion', ref: id, detalle: b.cerrarPendientes ? 'cerrada' : undefined };
      if (c === 'cancelar') return { accion: 'compra.cancelar', ref: id };
      return null;
    case 'impresoras':
      if (c === 'prueba') return { accion: 'impresora.prueba', ref: id };
      if (id === 'comprobar') return null;
      return { accion: m === 'POST' ? 'impresora.crear' : m === 'DELETE' ? 'impresora.eliminar' : 'impresora.editar', ref: id };
    case 'imprimir':
      return { accion: `impresion.${b.tipo ?? 'documento'}`, ref: typeof b.pedidoId === 'string' ? b.pedidoId : undefined };
    case 'usuarios':
      if (m === 'POST') return { accion: 'usuario.crear', detalle: `rol=${b.rol ?? ''}` };
      if (m === 'DELETE') return { accion: 'usuario.desactivar', ref: id };
      return { accion: 'usuario.editar', ref: id, detalle: [b.rol ? `rol=${b.rol}` : '', b.activo === false ? 'desactivado' : ''].filter(Boolean).join(' ') || undefined };
    case 'restaurante':
      return put ? { accion: 'restaurante.editar' } : null;
    case 'perfil':
      return put ? { accion: id === 'password' ? 'perfil.password' : 'perfil.editar' } : null;
    default:
      return null;
  }
}

const nombres = new Map<string, string>();
export async function nombreDe(userId: string): Promise<string> {
  const hit = nombres.get(userId);
  if (hit) return hit;
  const u = await prisma.usuario.findUnique({ where: { id: userId }, select: { nombre: true } });
  const n = u?.nombre ?? '—';
  nombres.set(userId, n);
  return n;
}
export function olvidarNombre(userId: string) { nombres.delete(userId); }

export async function registrar(e: {
  restauranteId: string; usuarioId?: string; usuarioNombre?: string; rol: string; accion: string; detalle?: string | null; ref?: string | null;
  metodo: string; ruta: string; estado: number;
}): Promise<void> {
  try {
    const usuarioNombre = e.usuarioNombre ?? (e.usuarioId ? await nombreDe(e.usuarioId) : '—');
    await prisma.registroActividad.create({
      data: {
        restauranteId: e.restauranteId, usuarioId: e.usuarioId ?? null, usuarioNombre, rol: e.rol, accion: e.accion,
        detalle: e.detalle?.slice(0, 200) ?? null, ref: e.ref ?? null, metodo: e.metodo, ruta: e.ruta.slice(0, 200), estado: e.estado,
      },
    });
    emitirCambio(e.restauranteId, ['auditoria']);
  } catch (err) {
    console.error('[audit]', err);
  }
}
