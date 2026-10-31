ALTER TABLE "RecetaItem" ADD COLUMN "coldLossPct" DECIMAL(5,2);
ALTER TABLE "RecetaItem" ADD COLUMN "hotLossPct" DECIMAL(5,2);
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_coldLossPct_range" CHECK ("coldLossPct" BETWEEN 0 AND 100);
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_hotLossPct_range" CHECK ("hotLossPct" BETWEEN 0 AND 100);
