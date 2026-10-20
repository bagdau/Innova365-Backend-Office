import { api } from './api';

export const inventarioService = {
  getAll: () => api.get('/inventario').then((r) => r.data),
  getAlertas: () => api.get('/inventario/alertas').then((r) => r.data),
  create: (data: any) => api.post('/inventario', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/inventario/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/inventario/${id}`),
};
