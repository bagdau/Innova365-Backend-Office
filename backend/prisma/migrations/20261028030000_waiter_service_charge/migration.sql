ALTER TABLE "Usuario" ADD COLUMN "waiterPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ADD COLUMN "servicePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ADD COLUMN "serviceAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ADD COLUMN "serviceDecimals" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Pedido" ADD COLUMN "pagadoEn" TIMESTAMP(3);
CREATE INDEX "Pedido_restauranteId_pagadoEn_idx" ON "Pedido"("restauranteId", "pagadoEn");
