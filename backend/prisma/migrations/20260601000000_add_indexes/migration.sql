-- Índices para consultas por restaurante, estado y fecha
CREATE INDEX "Usuario_restauranteId_idx" ON "Usuario"("restauranteId");
CREATE INDEX "Mesa_restauranteId_idx" ON "Mesa"("restauranteId");
CREATE INDEX "Categoria_restauranteId_idx" ON "Categoria"("restauranteId");
CREATE INDEX "Producto_restauranteId_idx" ON "Producto"("restauranteId");
CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");
CREATE INDEX "Insumo_restauranteId_idx" ON "Insumo"("restauranteId");
CREATE INDEX "Pedido_restauranteId_estado_idx" ON "Pedido"("restauranteId", "estado");
CREATE INDEX "Pedido_restauranteId_creadoEn_idx" ON "Pedido"("restauranteId", "creadoEn");
CREATE INDEX "Pedido_mesaId_idx" ON "Pedido"("mesaId");
CREATE INDEX "Pedido_meseroId_idx" ON "Pedido"("meseroId");
CREATE INDEX "ItemPedido_pedidoId_idx" ON "ItemPedido"("pedidoId");
CREATE INDEX "ItemPedido_productoId_idx" ON "ItemPedido"("productoId");
