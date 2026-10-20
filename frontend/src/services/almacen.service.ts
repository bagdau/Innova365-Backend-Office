import axios from 'axios';
import { api } from './api';
import type { Compra, Movimiento, Proveedor } from '../types';

/** UUID, который работает и в небезопасном контексте (http://IP в локальной сети: crypto.randomUUID там недоступен). */
export function uid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST с автоматическими повторами при обрыве сети / 502-504 / таймауте.
 * Безопасно: тело содержит `clave` (ключ идемпотентности), сервер не выполнит операцию дважды.
 */
async function postRetry<T>(url: string, body: Record<string, unknown> & { clave: string }, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await api.post<T>(url, body, { timeout: 8000 });
      return r.data;
    } catch (e) {
      last = e;
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      const retriable = status === undefined || [408, 429, 502, 503, 504].includes(status);
      if (!retriable || i === tries - 1) break;
      await sleep(250 * 2 ** i);
    }
  }
  throw last;
}

export interface CompraInput {
  clave: string;
  proveedorId: string;
  fechaEsperada?: string | null;
  notas?: string | null;
  items: { insumoId: string; cantidad: number; costoUnitario: number }[];
}

export interface RecepcionInput {
  clave: string;
  cerrarPendientes?: boolean;
  notas?: string | null;
  items: { compraItemId: string; cantidad: number; costoUnitario?: number }[];
}

export const almacenService = {
  // proveedores
  getProveedores: (todos = false) => api.get<Proveedor[]>('/proveedores', { params: todos ? { todos: 1 } : {} }).then((r) => r.data),
  createProveedor: (d: Partial<Proveedor>) => api.post<Proveedor>('/proveedores', d).then((r) => r.data),
  updateProveedor: (id: string, d: Partial<Proveedor>) => api.put<Proveedor>(`/proveedores/${id}`, d).then((r) => r.data),

  // compras
  getCompras: (params?: Record<string, string | number>) =>
    api.get<{ data: Compra[]; total: number }>('/compras', { params }).then((r) => r.data),
  createCompra: (d: CompraInput) => postRetry<Compra>('/compras', d as unknown as Record<string, unknown> & { clave: string }),
  recibirCompra: (id: string, d: RecepcionInput) => postRetry<Compra>(`/compras/${id}/recepcion`, d as unknown as Record<string, unknown> & { clave: string }),
  cancelarCompra: (id: string) => api.post<Compra>(`/compras/${id}/cancelar`).then((r) => r.data),

  // movimientos, ajuste, revisión
  getMovimientos: (params?: Record<string, string | number>) => api.get<Movimiento[]>('/inventario/movimientos', { params }).then((r) => r.data),
  ajustar: (insumoId: string, d: { clave: string; tipo: 'AJUSTE' | 'MERMA'; cantidad: number; motivo?: string }) =>
    postRetry<{ insumoId: string; saldo: number }>(`/inventario/${insumoId}/ajuste`, d),
  revision: (d: { clave: string; notas?: string; conteos: { insumoId: string; contado: number }[] }) =>
    postRetry<{ revisados: number; conDiferencia: number; detalle: { insumoId: string; antes: number; contado: number; diferencia: number; costo: number | null }[] }>('/inventario/revision', d),
};
