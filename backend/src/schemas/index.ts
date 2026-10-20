import { z } from 'zod';

/* ──────── Auth ──────── */
export const loginSchema = z.object({
  email:    z.string().email('Email inválido').max(120),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(120),
});

/* ──────── Pedidos ──────── */
export const itemPedidoSchema = z.object({
  productoId: z.string().min(1),
  cantidad:   z.number().int().positive().max(99),
});

export const createPedidoSchema = z.object({
  tipo:   z.enum(['EN_MESA', 'PARA_LLEVAR']),
  mesaId: z.string().optional().nullable(),
  items:  z.array(itemPedidoSchema).min(1, 'Mínimo 1 item'),
});

export const updateEstadoSchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_COCINA', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'PAGADO', 'CANCELADO']),
});

export const registrarPagoSchema = z.object({
  metodoPago: z.enum(['Efectivo', 'Tarjeta', 'QR', 'Transferencia']),
});

/* ──────── Mesas ──────── */
export const createMesaSchema = z.object({
  numero:    z.number().int().positive().max(999),
  capacidad: z.number().int().positive().max(50).default(4),
});

export const updateMesaSchema = z.object({
  numero:    z.number().int().positive().max(999).optional(),
  capacidad: z.number().int().positive().max(50).optional(),
});

export const updateEstadoMesaSchema = z.object({
  estado: z.enum(['LIBRE', 'OCUPADA', 'EN_ESPERA']),
});

/* ──────── Usuarios ──────── */
export const createUsuarioSchema = z.object({
  nombre:   z.string().min(2).max(80),
  email:    z.string().email().max(120),
  password: z.string().min(6).max(120),
  rol:      z.enum(['SUPERADMIN', 'ADMIN', 'MESERO', 'COCINERO', 'CAJERO']),
});

export const updateUsuarioSchema = z.object({
  nombre:   z.string().min(2).max(80).optional(),
  email:    z.string().email().max(120).optional(),
  password: z.string().min(6).max(120).optional(),
  rol:      z.enum(['SUPERADMIN', 'ADMIN', 'MESERO', 'COCINERO', 'CAJERO']).optional(),
  activo:   z.boolean().optional(),
});

export const updatePerfilSchema = z.object({
  nombre: z.string().min(2).max(80).optional(),
  email:  z.string().email().max(120).optional(),
});

export const changePasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNuevo:  z.string().min(6).max(120),
});

export const addItemsSchema = z.object({
  items: z.array(itemPedidoSchema).min(1, 'Mínimo 1 item'),
});

/* ──────── Almacén / compras ──────── */
const clave = z.string().min(8).max(80).optional();
const cantidadPos = z.number().positive().max(10_000_000);
const costo = z.number().min(0).max(100_000_000);

export const proveedorSchema = z.object({
  nombre:   z.string().min(2).max(120),
  contacto: z.string().max(120).optional().nullable(),
  telefono: z.string().max(40).optional().nullable(),
  email:    z.string().email().max(120).optional().nullable().or(z.literal('')),
  notas:    z.string().max(500).optional().nullable(),
});
export const updateProveedorSchema = proveedorSchema.partial().extend({ activo: z.boolean().optional() });

export const createCompraSchema = z.object({
  clave,
  proveedorId:   z.string().min(1),
  fechaEsperada: z.string().optional().nullable(),
  notas:         z.string().max(500).optional().nullable(),
  items: z.array(z.object({ insumoId: z.string().min(1), cantidad: cantidadPos, costoUnitario: costo })).min(1, 'Mínimo 1 item').max(200),
});

export const recepcionSchema = z.object({
  clave,
  cerrarPendientes: z.boolean().optional(),
  notas: z.string().max(500).optional().nullable(),
  items: z.array(z.object({ compraItemId: z.string().min(1), cantidad: z.number().min(0).max(10_000_000), costoUnitario: costo.optional() })).max(200),
});

export const ajusteSchema = z.object({
  clave,
  tipo: z.enum(['AJUSTE', 'MERMA']),
  cantidad: z.number().refine((n) => n !== 0, 'Cantidad no puede ser 0').refine((n) => Math.abs(n) <= 10_000_000),
  motivo: z.string().max(200).optional().nullable(),
});

export const revisionSchema = z.object({
  clave,
  notas: z.string().max(200).optional().nullable(),
  conteos: z.array(z.object({ insumoId: z.string().min(1), contado: z.number().min(0).max(10_000_000) })).min(1).max(1000),
});

/* ──────── Impresión ──────── */
export const recetaSchema = z.object({
  rendimiento: z.number().min(0).max(100000).optional().nullable(),
  tecnologia: z.string().max(4000).optional().nullable(),
  items: z.array(z.object({
    insumoId: z.string().min(1).optional().nullable(),
    componenteId: z.string().min(1).optional().nullable(),
    cantidad: z.number().positive().max(1_000_000),
    neto: z.number().min(0).max(1_000_000).optional().nullable(),
  })).max(60),
});

export const impresoraSchema = z.object({
  nombre: z.string().min(2).max(60),
  tipo: z.enum(['RED', 'AGENTE', 'NAVEGADOR']),
  host: z.string().max(200).optional().nullable(),
  puerto: z.number().int().min(1).max(65535).optional().nullable(),
  nombreSistema: z.string().max(200).optional().nullable(),
  token: z.string().max(200).optional().nullable(),
  ancho: z.number().int().min(40).max(120).default(80),
  codepage: z.enum(['cp866', 'cp1251', 'ascii']).default('cp866'),
  usos: z.array(z.enum(['RECIBO', 'CUENTA', 'COCINA', 'REPORTE'])).max(4),
  corte: z.boolean().default(true),
  cajon: z.boolean().default(false),
  copias: z.number().int().min(1).max(5).default(1),
  auto: z.boolean().default(false),
  activa: z.boolean().default(true),
}).refine((d) => d.tipo === 'NAVEGADOR' || !!d.host, { message: 'Dirección de impresora inválida', path: ['host'] })
  .refine((d) => d.tipo !== 'AGENTE' || !!d.nombreSistema, { message: 'Indica el nombre de la impresora en Windows', path: ['nombreSistema'] });
export const updateImpresoraSchema = z.object({
  nombre: z.string().min(2).max(60).optional(),
  tipo: z.enum(['RED', 'AGENTE', 'NAVEGADOR']).optional(),
  host: z.string().max(200).optional().nullable(),
  puerto: z.number().int().min(1).max(65535).optional().nullable(),
  nombreSistema: z.string().max(200).optional().nullable(),
  token: z.string().max(200).optional().nullable(),
  ancho: z.number().int().min(40).max(120).optional(),
  codepage: z.enum(['cp866', 'cp1251', 'ascii']).optional(),
  usos: z.array(z.enum(['RECIBO', 'CUENTA', 'COCINA', 'REPORTE'])).max(4).optional(),
  corte: z.boolean().optional(),
  cajon: z.boolean().optional(),
  copias: z.number().int().min(1).max(5).optional(),
  auto: z.boolean().optional(),
  activa: z.boolean().optional(),
});
export const imprimirSchema = z.object({
  tipo: z.enum(['recibo', 'cuenta', 'cocina', 'cierre']),
  pedidoId: z.string().optional(),
  impresoraId: z.string().optional(),
  lang: z.enum(['ru', 'en']).optional(),
}).refine((d) => d.tipo === 'cierre' || !!d.pedidoId, { message: 'Datos inválidos', path: ['pedidoId'] });

/* ──────── Меню ──────── */
const imagenUrl = z.string().max(500)
  .refine((v) => v === '' || v.startsWith('/uploads/') || v.startsWith('/dishes/') || /^https?:\/\//i.test(v), 'Некорректная ссылка на изображение')
  .nullable();

export const createProductoSchema = z.object({
  nombre:         z.string().trim().min(1, 'Укажите название').max(120),
  descripcion:    z.string().trim().max(500).nullable().optional(),
  precio:         z.number({ error: 'Цена должна быть числом' }).min(0, 'Цена не может быть отрицательной').max(99_999_999),
  imagen:         imagenUrl.optional(),
  disponible:     z.boolean().optional(),
  requiereCocina: z.boolean().optional(),
  categoriaId:    z.string().min(1, 'Выберите категорию'),
});

export const updateProductoSchema = createProductoSchema.partial();

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, 'Укажите название').max(60),
});

/* ──────── Склад: ингредиенты ──────── */
const cant = z.number({ error: 'Должно быть числом' }).min(0, 'Не может быть отрицательным').max(1_000_000_000)
  .nullable().optional().transform((v) => v ?? undefined);
const txt = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || undefined);

export const createInsumoSchema = z.object({
  nombre: z.string().trim().min(1, 'Укажите название').max(120),
  categoria: txt(60),
  unidad: z.string().trim().min(1, 'Укажите единицу измерения').max(20),
  stockActual: cant,
  stockMinimo: cant,
  proveedor: txt(120),
});

export const updateInsumoSchema = z.object({
  nombre: z.string().trim().min(1, 'Укажите название').max(120).optional(),
  categoria: z.string().trim().max(60).nullable().optional(),
  unidad: z.string().trim().min(1, 'Укажите единицу измерения').max(20).optional(),
  stockActual: cant,
  stockMinimo: cant,
  proveedor: z.string().trim().max(120).nullable().optional(),
});

/* ──────── Настройки ресторана ──────── */
const optTxt = (max: number) => z.string().trim().max(max).nullable().optional();
export const updateRestauranteSchema = z.object({
  nombre: z.string().trim().min(1, 'Укажите название').max(80).optional(),
  direccion: optTxt(200),
  telefono: optTxt(40),
  timerMesa: z.number({ error: 'Должно быть числом' }).int().min(1).max(1440).optional(),
  pieTicket: optTxt(500),
  qrTicket: optTxt(1000),
  moneda: z.string().max(5).optional(),
  qrPago: optTxt(1000),
});
