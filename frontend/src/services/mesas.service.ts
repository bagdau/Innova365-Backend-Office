import { api } from './api';

export const mesasService = {
  getAll: () => api.get('/mesas').then((r) => r.data),
  create: (data: { numero: number; capacidad: number }) => api.post('/mesas', data).then((r) => r.data),
  update: (id: string, data: { numero: number; capacidad: number }) => api.patch(`/mesas/${id}`, data).then((r) => r.data),
  updateEstado: (id: string, estado: string) => api.patch(`/mesas/${id}/estado`, { estado }).then((r) => r.data),
  delete: (id: string) => api.delete(`/mesas/${id}`),
};
