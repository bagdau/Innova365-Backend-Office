ALTER TABLE "Usuario" ADD COLUMN "pinKey" TEXT;
CREATE UNIQUE INDEX "Usuario_pinKey_key" ON "Usuario"("pinKey");
