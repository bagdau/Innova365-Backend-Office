ALTER TABLE "Pedido" ADD COLUMN "cocineroId" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "cocineroNombre" TEXT;
CREATE INDEX "Pedido_cocineroId_idx" ON "Pedido"("cocineroId");

-- Recover the employee who last marked an older order ready, when audit data exists.
UPDATE "Pedido" AS p
SET "cocineroId" = a."usuarioId", "cocineroNombre" = a."usuarioNombre"
FROM (
  SELECT DISTINCT ON ("restauranteId", "ref")
    "restauranteId", "ref", "usuarioId", "usuarioNombre"
  FROM "RegistroActividad"
  WHERE "accion" = 'pedido.estado' AND "detalle" = 'estado=LISTO'
    AND "estado" BETWEEN 200 AND 299 AND "ref" IS NOT NULL AND "usuarioId" IS NOT NULL
  ORDER BY "restauranteId", "ref", "creadoEn" DESC
) AS a
WHERE p."restauranteId" = a."restauranteId" AND p."id" = a."ref";
