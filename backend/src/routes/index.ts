import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleMiddleware, ownerOnly } from '../middleware/role.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { asyncHandler } from '../middleware/async.middleware';
import {
  loginSchema, createPedidoSchema, updateEstadoSchema, registrarPagoSchema,
  createMesaSchema, updateMesaSchema, updateEstadoMesaSchema,
  createUsuarioSchema, updateUsuarioSchema, updatePerfilSchema, changePasswordSchema,
  addItemsSchema, recetaSchema, impresoraSchema, updateImpresoraSchema, imprimirSchema, proveedorSchema, updateProveedorSchema, createCompraSchema, recepcionSchema, ajusteSchema, revisionSchema,
  createProductoSchema, updateProductoSchema, categoriaSchema, createInsumoSchema, updateInsumoSchema, updateRestauranteSchema,
} from '../schemas';
import { login, refresh, logout } from '../controllers/auth.controller';
import { activateDesktop, verifyDesktop, activationStatus, rotateActivationCode, revokeDesktop } from '../controllers/desktop.controller';
import { getBillingStatus } from '../controllers/billing.controller';
import { getMesas, createMesa, updateMesa, updateEstadoMesa, deleteMesa } from '../controllers/mesas.controller';
import { getPedidos, getPedidosActivos, getPedidoById, createPedido, updateEstadoPedido, registrarPago, addItemsToPedido, getActiveWaiters } from '../controllers/pedidos.controller';
import { getProductos, createProducto, updateProducto, deleteProducto, getCategorias, createCategoria, updateCategoria, deleteCategoria, uploadImagen, upload } from '../controllers/menu.controller';
import { getInventario, getAlertas, createInsumo, updateInsumo, deleteInsumo } from '../controllers/inventario.controller';
import { getVentas, getTopProductos, getProductividad, getCashReport, getWaiterEarnings } from '../controllers/reportes.controller';
import { getCompras, getCompra, createCompra, recibirCompra, cancelarCompra } from '../controllers/compras.controller';
import { getProveedores, createProveedor, updateProveedor, getMovimientos, ajustarInsumo, aplicarRevision } from '../controllers/almacen.controller';
import { getRecetas, getReceta, getRecetaStock, putReceta, getConsumo } from '../controllers/recetas.controller';
import { getImpresoras, createImpresora, updateImpresora, deleteImpresora, pruebaImpresora, agentePrinters, imprimirDocumento, getTrabajos, getDisponibles, descubrirImpresoras, comprobarImpresora, getEstado, getBytes, imprimirIp } from '../controllers/impresion.controller';
import { getEnLinea, getAuditoria } from '../controllers/monitor.controller';
import { notifyOnWrite, eventsHandler } from '../middleware/realtime.middleware';
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario, getRestaurante, updateRestaurante, getDashboardStats, getPerfil, updatePerfil, changePassword } from '../controllers/usuarios.controller';

export const router = Router();

// ─── Auth ──────────────────────────────────────────
router.post('/auth/login',   validateBody(loginSchema), asyncHandler(login));
router.post('/auth/refresh', asyncHandler(refresh));
router.post('/auth/logout',  asyncHandler(logout));
router.post('/desktop/activate', asyncHandler(activateDesktop));
router.post('/desktop/verify', asyncHandler(verifyDesktop));

router.use(authMiddleware);
router.get('/events', eventsHandler);
router.use(notifyOnWrite);
router.get('/billing/status', ownerOnly, asyncHandler(getBillingStatus));
router.get('/desktop/activation', roleMiddleware('ADMIN'), asyncHandler(activationStatus));
router.post('/desktop/activation', roleMiddleware('ADMIN'), asyncHandler(rotateActivationCode));
router.delete('/desktop/devices/:id', roleMiddleware('ADMIN'), asyncHandler(revokeDesktop));

// ─── Dashboard ─────────────────────────────────────
router.get('/dashboard', asyncHandler(getDashboardStats));

// ─── Mesas ────────────────────────────────────────
router.get('/mesas',              asyncHandler(getMesas));
router.post('/mesas',             roleMiddleware('ADMIN'), validateBody(createMesaSchema), asyncHandler(createMesa));
router.patch('/mesas/:id',        roleMiddleware('ADMIN'), validateBody(updateMesaSchema), asyncHandler(updateMesa));
router.patch('/mesas/:id/estado', roleMiddleware('ADMIN'), validateBody(updateEstadoMesaSchema), asyncHandler(updateEstadoMesa));
router.delete('/mesas/:id',       roleMiddleware('ADMIN'), asyncHandler(deleteMesa));

// ─── Pedidos ──────────────────────────────────────
router.get('/pedidos',                asyncHandler(getPedidos));
router.get('/pedidos/activos',        asyncHandler(getPedidosActivos));
router.get('/pedidos/meseros',        roleMiddleware('ADMIN', 'CAJERO'), asyncHandler(getActiveWaiters));
router.get('/pedidos/:id',            asyncHandler(getPedidoById));
router.post('/pedidos',               roleMiddleware('ADMIN', 'MESERO', 'CAJERO'), validateBody(createPedidoSchema), asyncHandler(createPedido));
router.patch('/pedidos/:id/estado',   validateBody(updateEstadoSchema), asyncHandler(updateEstadoPedido));
router.patch('/pedidos/:id/pago',     roleMiddleware('ADMIN', 'CAJERO'), validateBody(registrarPagoSchema), asyncHandler(registrarPago));
router.post('/pedidos/:id/items',     roleMiddleware('ADMIN', 'MESERO', 'CAJERO'), validateBody(addItemsSchema), asyncHandler(addItemsToPedido));

// ─── Тех-карты (технологические карты блюд) ───────
router.get('/recetas',                 roleMiddleware('ADMIN', 'CAJERO'), asyncHandler(getRecetas));
router.get('/recetas/consumo',         roleMiddleware('ADMIN'), asyncHandler(getConsumo));
router.get('/recetas/:productoId',     roleMiddleware('ADMIN'), asyncHandler(getReceta));
router.get('/recetas/:productoId/stock', roleMiddleware('ADMIN', 'CAJERO'), asyncHandler(getRecetaStock));
router.put('/recetas/:productoId',     roleMiddleware('ADMIN'), validateBody(recetaSchema), asyncHandler(putReceta));

// ─── Menú ─────────────────────────────────────────
router.get('/menu/productos',             asyncHandler(getProductos));
router.post('/menu/productos',            roleMiddleware('ADMIN'), validateBody(createProductoSchema), asyncHandler(createProducto));
router.put('/menu/productos/:id',         roleMiddleware('ADMIN'), validateBody(updateProductoSchema), asyncHandler(updateProducto));
router.delete('/menu/productos/:id',      roleMiddleware('ADMIN'), asyncHandler(deleteProducto));
router.get('/menu/categorias',            asyncHandler(getCategorias));
router.post('/menu/categorias',           roleMiddleware('ADMIN'), validateBody(categoriaSchema), asyncHandler(createCategoria));
router.put('/menu/categorias/:id',        roleMiddleware('ADMIN'), validateBody(categoriaSchema), asyncHandler(updateCategoria));
router.delete('/menu/categorias/:id',     roleMiddleware('ADMIN'), asyncHandler(deleteCategoria));
router.post('/menu/upload-imagen',        roleMiddleware('ADMIN'), upload.single('imagen'), asyncHandler(uploadImagen));

// ─── Inventario ───────────────────────────────────
router.get('/inventario',         asyncHandler(getInventario));
router.get('/inventario/alertas', asyncHandler(getAlertas));
router.get('/inventario/movimientos', roleMiddleware('ADMIN'), asyncHandler(getMovimientos));
router.post('/inventario/revision',   roleMiddleware('ADMIN'), validateBody(revisionSchema), asyncHandler(aplicarRevision));
router.post('/inventario/:id/ajuste', roleMiddleware('ADMIN'), validateBody(ajusteSchema), asyncHandler(ajustarInsumo));
router.post('/inventario',        roleMiddleware('ADMIN'), validateBody(createInsumoSchema), asyncHandler(createInsumo));
router.put('/inventario/:id',     roleMiddleware('ADMIN'), validateBody(updateInsumoSchema), asyncHandler(updateInsumo));
router.delete('/inventario/:id',  roleMiddleware('ADMIN'), asyncHandler(deleteInsumo));

// ─── Proveedores y compras (solo dueño/administrador) ──
router.get('/proveedores',        roleMiddleware('ADMIN'), asyncHandler(getProveedores));
router.post('/proveedores',       roleMiddleware('ADMIN'), validateBody(proveedorSchema), asyncHandler(createProveedor));
router.put('/proveedores/:id',    roleMiddleware('ADMIN'), validateBody(updateProveedorSchema), asyncHandler(updateProveedor));
router.get('/compras',            roleMiddleware('ADMIN'), asyncHandler(getCompras));
router.post('/compras',           roleMiddleware('ADMIN'), validateBody(createCompraSchema), asyncHandler(createCompra));
router.get('/compras/:id',        roleMiddleware('ADMIN'), asyncHandler(getCompra));
router.post('/compras/:id/recepcion', roleMiddleware('ADMIN'), validateBody(recepcionSchema), asyncHandler(recibirCompra));
router.post('/compras/:id/cancelar',  roleMiddleware('ADMIN'), asyncHandler(cancelarCompra));

// ─── Мониторинг (администратор и владелец) / журнал действий (только владелец) ──
router.get('/en-linea',   roleMiddleware('ADMIN'), asyncHandler(getEnLinea));
router.get('/auditoria',  ownerOnly, asyncHandler(getAuditoria));

// ─── Impresión ──
router.post('/imprimir',              roleMiddleware('ADMIN', 'CAJERO', 'MESERO'), validateBody(imprimirSchema), asyncHandler(imprimirDocumento));
router.post('/imprimir/ip',           roleMiddleware('ADMIN', 'CAJERO', 'MESERO'), asyncHandler(imprimirIp));
router.post('/imprimir/bytes',        roleMiddleware('ADMIN', 'CAJERO', 'MESERO'), asyncHandler(getBytes));
router.get('/imprimir/estado',       roleMiddleware('ADMIN', 'CAJERO', 'MESERO'), asyncHandler(getEstado));
router.get('/imprimir/impresoras',   roleMiddleware('ADMIN', 'CAJERO', 'MESERO'), asyncHandler(getDisponibles));
router.get('/impresoras',             roleMiddleware('ADMIN'), asyncHandler(getImpresoras));
router.post('/impresoras',            roleMiddleware('ADMIN'), validateBody(impresoraSchema), asyncHandler(createImpresora));
router.get('/impresoras/agente',      roleMiddleware('ADMIN'), asyncHandler(agentePrinters));
router.get('/impresoras/trabajos',    roleMiddleware('ADMIN'), asyncHandler(getTrabajos));
router.get('/impresoras/descubrir',   roleMiddleware('ADMIN'), asyncHandler(descubrirImpresoras));
router.post('/impresoras/comprobar',  roleMiddleware('ADMIN'), asyncHandler(comprobarImpresora));
router.put('/impresoras/:id',         roleMiddleware('ADMIN'), validateBody(updateImpresoraSchema), asyncHandler(updateImpresora));
router.delete('/impresoras/:id',      roleMiddleware('ADMIN'), asyncHandler(deleteImpresora));
router.post('/impresoras/:id/prueba', roleMiddleware('ADMIN'), asyncHandler(pruebaImpresora));

// ─── Reportes ─────────────────────────────────────
router.get('/reportes/ventas',    roleMiddleware('ADMIN', 'CAJERO'), asyncHandler(getVentas));
router.get('/reportes/caja',      roleMiddleware('ADMIN', 'CAJERO'), asyncHandler(getCashReport));
router.get('/reportes/productos', roleMiddleware('ADMIN', 'CAJERO'), asyncHandler(getTopProductos));
router.get('/reportes/cocineros', roleMiddleware('ADMIN'),           asyncHandler(getProductividad));
router.get('/reportes/meseros', roleMiddleware('ADMIN'),             asyncHandler(getWaiterEarnings));

// ─── Perfil ────────────────────────────────────────
router.get('/perfil',          asyncHandler(getPerfil));
router.put('/perfil',          validateBody(updatePerfilSchema),   asyncHandler(updatePerfil));
router.put('/perfil/password', validateBody(changePasswordSchema), asyncHandler(changePassword));

// ─── Usuarios ─────────────────────────────────────
router.get('/usuarios',        roleMiddleware('ADMIN'), asyncHandler(getUsuarios));
router.post('/usuarios',       roleMiddleware('ADMIN'), validateBody(createUsuarioSchema), asyncHandler(createUsuario));
router.put('/usuarios/:id',    roleMiddleware('ADMIN'), validateBody(updateUsuarioSchema), asyncHandler(updateUsuario));
router.delete('/usuarios/:id', roleMiddleware('ADMIN'), asyncHandler(deleteUsuario));

// ─── Restaurante ──────────────────────────────────
router.get('/restaurante', asyncHandler(getRestaurante));
router.put('/restaurante', roleMiddleware('ADMIN'), validateBody(updateRestauranteSchema), asyncHandler(updateRestaurante));
