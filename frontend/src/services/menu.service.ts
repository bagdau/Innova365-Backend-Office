import { api } from './api';

export const menuService = {
  getProductos: () => api.get('/menu/productos').then((r) => r.data),
  createProducto: (data: any) => api.post('/menu/productos', data).then((r) => r.data),
  updateProducto: (id: string, data: any) => api.put(`/menu/productos/${id}`, data).then((r) => r.data),
  deleteProducto: (id: string) => api.delete(`/menu/productos/${id}`),
  getCategorias: () => api.get('/menu/categorias').then((r) => r.data),
  createCategoria: (nombre: string, impresoraId?: string | null) => api.post('/menu/categorias', { nombre, impresoraId }).then((r) => r.data),
  updateCategoria: (id: string, nombre: string, impresoraId?: string | null) => api.put(`/menu/categorias/${id}`, { nombre, impresoraId }).then((r) => r.data),
  deleteCategoria: (id: string) => api.delete(`/menu/categorias/${id}`),
  uploadImagen: (file: File) => {
    const form = new FormData();
    form.append('imagen', file);
    return api.post('/menu/upload-imagen', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data as { url: string });
  },
};
