import { api } from './api';

export const pedidosService = {
  getAll: (params?: Record<string, string>) => api.get('/pedidos', { params }).then((r) => r.data),
  getActivos: () => api.get('/pedidos/activos').then((r) => r.data),
  getWaiters: () => api.get<{ id: string; nombre: string; waiterPercent: number }[]>('/pedidos/meseros').then((r) => r.data),
  getById: (id: string) => api.get(`/pedidos/${id}`).then((r) => r.data),
  create: (data: { tipo: string; mesaId?: string; meseroId?: string; items: { productoId: string; cantidad: number }[] }) =>
    api.post('/pedidos', data).then((r) => r.data),
  updateEstado: (id: string, estado: string) => api.patch(`/pedidos/${id}/estado`, { estado }).then((r) => r.data),
  registrarPago: (id: string, metodoPago: string, expectedTotal?: number) => api.patch(`/pedidos/${id}/pago`, { metodoPago, expectedTotal }).then((r) => r.data),
  addItems: (id: string, items: { productoId: string; cantidad: number }[]) =>
    api.post(`/pedidos/${id}/items`, { items }).then((r) => r.data),
};
