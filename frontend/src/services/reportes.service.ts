import { api } from './api';
import type { CashReport, CashReportPeriod } from '../types/cashReport';

export const reportesService = {
  getCashReport: (periodo: CashReportPeriod) => api.get<CashReport>('/reportes/caja', { params: { periodo } }).then((r) => r.data),
  getVentas: (periodo: string) => api.get('/reportes/ventas', { params: { periodo } }).then((r) => r.data),
  getTopProductos: (periodo: CashReportPeriod) => api.get('/reportes/productos', { params: { periodo } }).then((r) => r.data),
  getProductividad: (periodo: CashReportPeriod) => api.get('/reportes/cocineros', { params: { periodo } }).then((r) => r.data),
  getWaiterEarnings: (periodo: CashReportPeriod) => api.get('/reportes/meseros', { params: { periodo } }).then((r) => r.data),
  getDashboard: () => api.get('/dashboard').then((r) => r.data),
  getRestaurante: () => api.get('/restaurante').then((r) => r.data),
  updateRestaurante: (data: any) => api.put('/restaurante', data).then((r) => r.data),
  getUsuarios: () => api.get('/usuarios').then((r) => r.data),
  createUsuario: (data: any) => api.post('/usuarios', data).then((r) => r.data),
  updateUsuario: (id: string, data: any) => api.put(`/usuarios/${id}`, data).then((r) => r.data),
  deleteUsuario: (id: string) => api.delete(`/usuarios/${id}`),
  getPerfil: () => api.get('/perfil').then((r) => r.data),
  updatePerfil: (data: { nombre: string; email: string }) => api.put('/perfil', data).then((r) => r.data),
  changePassword: (data: { passwordActual: string; passwordNuevo: string }) => api.put('/perfil/password', data).then((r) => r.data),
};
