-- Журнал действий пользователей (виден владельцу)
CREATE TABLE "RegistroActividad" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "ref" TEXT,
    "metodo" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "estado" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroActividad_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistroActividad_restauranteId_creadoEn_idx" ON "RegistroActividad"("restauranteId", "creadoEn");
CREATE INDEX "RegistroActividad_usuarioId_creadoEn_idx" ON "RegistroActividad"("usuarioId", "creadoEn");
