ALTER TABLE "Pedido" ADD COLUMN "cajeroNombre" TEXT;
ALTER TABLE "Pedido" ADD COLUMN "cajeroRol" TEXT;

-- Preserve the actual payment operator on older receipts when the audit entry exists.
UPDATE "Pedido" AS p
SET "cajeroNombre" = a."usuarioNombre", "cajeroRol" = a."rol"
FROM (
  SELECT DISTINCT ON ("restauranteId", "ref")
    "restauranteId", "ref", "usuarioNombre", "rol"
  FROM "RegistroActividad"
  WHERE "accion" = 'pedido.pago' AND "estado" BETWEEN 200 AND 299 AND "ref" IS NOT NULL
  ORDER BY "restauranteId", "ref", "creadoEn" ASC
) AS a
WHERE p."restauranteId" = a."restauranteId" AND p."id" = a."ref" AND p."pagado" = true;
