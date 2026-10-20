-- Валюта ресторана и содержимое QR для оплаты; способ оплаты «Yape / Plin» → «QR»
ALTER TABLE "Restaurante" ADD COLUMN IF NOT EXISTS "moneda" TEXT NOT NULL DEFAULT 'KZT';
ALTER TABLE "Restaurante" ADD COLUMN IF NOT EXISTS "qrPago" TEXT;
UPDATE "Pedido" SET "metodoPago" = 'QR' WHERE "metodoPago" IN ('Yape / Plin', 'Yape/Plin');
