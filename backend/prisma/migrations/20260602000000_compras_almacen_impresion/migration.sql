-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('PEDIDA', 'PARCIAL', 'RECIBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INICIAL', 'COMPRA', 'AJUSTE', 'MERMA', 'REVISION', 'CONSUMO');

-- CreateEnum
CREATE TYPE "TipoImpresora" AS ENUM ('RED', 'AGENTE', 'NAVEGADOR');

-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN     "costoUnitario" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Restaurante" ADD COLUMN     "pieTicket" TEXT;

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "restauranteId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'PEDIDA',
    "proveedorId" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "fechaEsperada" TIMESTAMP(3),
    "notas" TEXT,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraItem" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "costoUnitario" DECIMAL(14,2) NOT NULL,
    "cantidadRecibida" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "CompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recepcion" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "notas" TEXT,
    "cerrada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionItem" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "compraItemId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "costoUnitario" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "RecepcionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "saldo" DECIMAL(14,3) NOT NULL,
    "costoUnitario" DECIMAL(14,2),
    "motivo" TEXT,
    "compraId" TEXT,
    "recepcionId" TEXT,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacionIdem" (
    "clave" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "resultado" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperacionIdem_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "Impresora" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoImpresora" NOT NULL,
    "host" TEXT,
    "puerto" INTEGER DEFAULT 9100,
    "nombreSistema" TEXT,
    "token" TEXT,
    "ancho" INTEGER NOT NULL DEFAULT 80,
    "codepage" TEXT NOT NULL DEFAULT 'cp866',
    "usos" TEXT[],
    "corte" BOOLEAN NOT NULL DEFAULT true,
    "cajon" BOOLEAN NOT NULL DEFAULT false,
    "copias" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Impresora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrabajoImpresion" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "impresoraId" TEXT,
    "tipo" TEXT NOT NULL,
    "referencia" TEXT,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "ms" INTEGER,
    "usuarioId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrabajoImpresion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Proveedor_restauranteId_idx" ON "Proveedor"("restauranteId");

-- CreateIndex
CREATE INDEX "Compra_restauranteId_estado_idx" ON "Compra"("restauranteId", "estado");

-- CreateIndex
CREATE INDEX "Compra_restauranteId_creadoEn_idx" ON "Compra"("restauranteId", "creadoEn");

-- CreateIndex
CREATE INDEX "Compra_proveedorId_idx" ON "Compra"("proveedorId");

-- CreateIndex
CREATE INDEX "CompraItem_compraId_idx" ON "CompraItem"("compraId");

-- CreateIndex
CREATE INDEX "CompraItem_insumoId_idx" ON "CompraItem"("insumoId");

-- CreateIndex
CREATE INDEX "Recepcion_compraId_idx" ON "Recepcion"("compraId");

-- CreateIndex
CREATE INDEX "Recepcion_restauranteId_creadoEn_idx" ON "Recepcion"("restauranteId", "creadoEn");

-- CreateIndex
CREATE INDEX "RecepcionItem_recepcionId_idx" ON "RecepcionItem"("recepcionId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_insumoId_creadoEn_idx" ON "MovimientoInventario"("insumoId", "creadoEn");

-- CreateIndex
CREATE INDEX "MovimientoInventario_restauranteId_creadoEn_idx" ON "MovimientoInventario"("restauranteId", "creadoEn");

-- CreateIndex
CREATE INDEX "MovimientoInventario_compraId_idx" ON "MovimientoInventario"("compraId");

-- CreateIndex
CREATE INDEX "OperacionIdem_creadoEn_idx" ON "OperacionIdem"("creadoEn");

-- CreateIndex
CREATE INDEX "Impresora_restauranteId_idx" ON "Impresora"("restauranteId");

-- CreateIndex
CREATE INDEX "TrabajoImpresion_restauranteId_creadoEn_idx" ON "TrabajoImpresion"("restauranteId", "creadoEn");

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraItem" ADD CONSTRAINT "CompraItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recepcion" ADD CONSTRAINT "Recepcion_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecepcionItem" ADD CONSTRAINT "RecepcionItem_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "Recepcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Impresora" ADD CONSTRAINT "Impresora_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrabajoImpresion" ADD CONSTRAINT "TrabajoImpresion_impresoraId_fkey" FOREIGN KEY ("impresoraId") REFERENCES "Impresora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

