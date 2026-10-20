-- Тех-карты блюд, расход склада по продажам
ALTER TYPE "TipoMovimiento" ADD VALUE IF NOT EXISTS 'DEVOLUCION';

ALTER TABLE "ItemPedido" ADD COLUMN IF NOT EXISTS "descontado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MovimientoInventario" ADD COLUMN IF NOT EXISTS "pedidoId" TEXT;
CREATE INDEX IF NOT EXISTS "MovimientoInventario_pedidoId_idx" ON "MovimientoInventario"("pedidoId");

CREATE TABLE IF NOT EXISTS "Receta" (
  "id" TEXT NOT NULL,
  "productoId" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "rendimiento" DECIMAL(14,3),
  "tecnologia" TEXT,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Receta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Receta_productoId_key" ON "Receta"("productoId");
CREATE INDEX IF NOT EXISTS "Receta_restauranteId_idx" ON "Receta"("restauranteId");

CREATE TABLE IF NOT EXISTS "RecetaItem" (
  "id" TEXT NOT NULL,
  "recetaId" TEXT NOT NULL,
  "insumoId" TEXT,
  "componenteId" TEXT,
  "cantidad" DECIMAL(14,4) NOT NULL,
  "neto" DECIMAL(14,4),
  CONSTRAINT "RecetaItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecetaItem_una_fuente" CHECK (("insumoId" IS NOT NULL) <> ("componenteId" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "RecetaItem_recetaId_idx" ON "RecetaItem"("recetaId");
CREATE INDEX IF NOT EXISTS "RecetaItem_insumoId_idx" ON "RecetaItem"("insumoId");
CREATE INDEX IF NOT EXISTS "RecetaItem_componenteId_idx" ON "RecetaItem"("componenteId");

ALTER TABLE "Receta" ADD CONSTRAINT "Receta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_componenteId_fkey" FOREIGN KEY ("componenteId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
