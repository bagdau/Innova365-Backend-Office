-- Граммовые нормы тех-карт в кг дают расход вида 0.0004: журнал склада и состав тех-карты хранят 6 знаков, чтобы возврат при отмене не накапливал дрейф.
ALTER TABLE "MovimientoInventario" ALTER COLUMN "cantidad" TYPE DECIMAL(18,6);
ALTER TABLE "MovimientoInventario" ALTER COLUMN "saldo" TYPE DECIMAL(18,6);
ALTER TABLE "RecetaItem" ALTER COLUMN "cantidad" TYPE DECIMAL(14,6);
ALTER TABLE "RecetaItem" ALTER COLUMN "neto" TYPE DECIMAL(14,6);
