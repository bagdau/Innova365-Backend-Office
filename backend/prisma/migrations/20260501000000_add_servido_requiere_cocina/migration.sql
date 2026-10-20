-- AlterTable
ALTER TABLE "ItemPedido" ADD COLUMN     "servido" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "requiereCocina" BOOLEAN NOT NULL DEFAULT true;
