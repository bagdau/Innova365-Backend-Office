import { api } from './api';

export type TipoImpresora = 'RED' | 'AGENTE' | 'NAVEGADOR';
export type UsoImpresora = 'RECIBO' | 'CUENTA' | 'COCINA' | 'REPORTE';

export interface Impresora {
  id: string;
  nombre: string;
  tipo: TipoImpresora;
  host: string | null;
  puerto: number | null;
  nombreSistema: string | null;
  tieneToken: boolean;
  ancho: number;
  codepage: 'cp866' | 'cp1251' | 'ascii';
  usos: UsoImpresora[];
  corte: boolean;
  cajon: boolean;
  copias: number;
  auto: boolean;
  activa: boolean;
}

export type ImpresoraInput = Partial<Omit<Impresora, 'id' | 'tieneToken'>> & { token?: string | null };

export interface ResultadoImpresion { impresoraId: string; impresora: string; ok: boolean; ms: number; error?: string; detalle?: string }
export interface RespuestaImpresion { resultados: ResultadoImpresion[]; fallback: boolean; ancho: number }

export interface EstadoImpresora { id: string; nombre: string; tipo: TipoImpresora; ancho: number; usos: UsoImpresora[]; auto: boolean; online: boolean; ms: number; papel: 'ok' | 'poco' | 'sin' | null; detalle: string | null }
export interface TrabajoImpresion { id: string; tipo: string; referencia: string | null; ok: boolean; error: string | null; ms: number | null; creadoEn: string; impresora: string | null }
export interface EstadoPrinter { escpos: boolean; enLinea?: boolean; papel?: 'ok' | 'poco' | 'sin' }
export interface HostEncontrado { ip: string; puerto: number; estado: EstadoPrinter; web: string | null }
export interface PrinterWindows { name: string; port: string; driver: string; isDefault: boolean; offline: boolean }

export const impresionService = {
  imprimir: (d: { tipo: 'recibo' | 'cuenta' | 'cocina' | 'cierre'; pedidoId?: string; impresoraId?: string; periodo?: 'hoy' | 'semana' | 'mes'; lang: 'ru' | 'en' }) =>
    api.post<RespuestaImpresion>('/imprimir', d, { timeout: 15000 }).then((r) => r.data),
  estado: () => api.get<EstadoImpresora[]>('/imprimir/estado', { timeout: 8000 }).then((r) => r.data),
  list: () => api.get<Impresora[]>('/impresoras').then((r) => r.data),
  disponibles: () => api.get<{ id: string; nombre: string; tipo: TipoImpresora; ancho: number; usos: UsoImpresora[] }[]>('/imprimir/impresoras').then((r) => r.data),
  create: (d: ImpresoraInput) => api.post<Impresora>('/impresoras', d).then((r) => r.data),
  update: (id: string, d: ImpresoraInput) => api.put<Impresora>(`/impresoras/${id}`, d).then((r) => r.data),
  remove: (id: string) => api.delete(`/impresoras/${id}`),
  prueba: (id: string, lang: 'ru' | 'en') => api.post<ResultadoImpresion>(`/impresoras/${id}/prueba`, { lang }, { timeout: 15000 }).then((r) => r.data),
  trabajos: () => api.get<TrabajoImpresion[]>('/impresoras/trabajos').then((r) => r.data),
  descubrir: (subred: string, puerto = 9100) =>
    api.get<{ subred: string; hosts: HostEncontrado[]; ms: number }>('/impresoras/descubrir', { params: { subred, puerto }, timeout: 30000 }).then((r) => r.data),
  comprobar: (host: string, puerto = 9100) =>
    api.post<{ host: string; puerto: number; alcanzable: boolean; estado: EstadoPrinter; ms: number }>('/impresoras/comprobar', { host, puerto }, { timeout: 15000 }).then((r) => r.data),
  agente: (host: string, token?: string) => api.get<PrinterWindows[]>('/impresoras/agente', { params: { host, token }, timeout: 12000 }).then((r) => r.data),
};
