ALTER TABLE "Categoria" ADD COLUMN "impresoraId" TEXT;
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_impresoraId_fkey" FOREIGN KEY ("impresoraId") REFERENCES "Impresora"("id") ON DELETE SET NULL ON UPDATE CASCADE;
