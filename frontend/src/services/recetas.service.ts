import { api } from './api';

export type StockStatus = 'none' | 'low' | 'normal' | 'surplus';
export interface RecetaResumen { productoId: string; tieneReceta: boolean; items: number; costo: number; incompleto: boolean; porciones: number | null; stockStatus: StockStatus; margen: number | null }

export interface RecetaLinea {
  id: string; tipo: 'insumo' | 'plato'; insumoId: string | null; componenteId: string | null;
  nombre: string; unidad: string; cantidad: number; neto: number | null; coldLossPct: number | null; hotLossPct: number | null; costo: number | null; stock: number;
}
export interface Receta {
  productoId: string; nombre: string; precio: number; tieneReceta: boolean; rendimiento: number | null; tecnologia: string;
  items: RecetaLinea[]; costo: number; incompleto: boolean; porciones: number | null; margen: number | null; actualizadoEn: string | null;
}
export interface RecetaInput { rendimiento: number | null; tecnologia: string | null; items: { insumoId?: string; componenteId?: string; cantidad: number; neto?: number | null; coldLossPct?: number | null; hotLossPct?: number | null }[] }
export interface RecetaStock {
  productoId: string; nombre: string; status: StockStatus; porciones: number | null;
  ingredients: { insumoId: string; nombre: string; unidad: string; porcion: number; stock: number; minimo: number; porciones: number; status: Exclude<StockStatus, 'none'> }[];
  movements: { id: string; insumoId: string; tipo: string; cantidad: number; saldo: number; motivo: string | null; creadoEn: string }[];
}

export interface Consumo {
  periodo: string; desde: string;
  ingredientes: { insumoId: string; nombre: string; unidad: string; consumo: number; costo: number | null; stock: number; diasRestantes: number | null }[];
  platos: { productoId: string; nombre: string; vendidos: number; ingresos: number; costo: number | null; sinReceta: boolean }[];
}

export const recetasService = {
  list: () => api.get<RecetaResumen[]>('/recetas').then((r) => r.data),
  get: (productoId: string) => api.get<Receta>(`/recetas/${productoId}`).then((r) => r.data),
  stock: (productoId: string) => api.get<RecetaStock>(`/recetas/${productoId}/stock`).then((r) => r.data),
  save: (productoId: string, d: RecetaInput) => api.put<Receta>(`/recetas/${productoId}`, d).then((r) => r.data),
  consumo: (periodo: string) => api.get<Consumo>('/recetas/consumo', { params: { periodo } }).then((r) => r.data),
};
