CREATE TABLE "BillingSubscription" (
    "restauranteId" TEXT NOT NULL,
    "paidUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("restauranteId")
);
CREATE TABLE "BillingGrant" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "previousUntil" TIMESTAMP(3),
    "paidUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingGrant_reference_key" ON "BillingGrant"("reference");
CREATE INDEX "BillingGrant_restauranteId_createdAt_idx" ON "BillingGrant"("restauranteId", "createdAt");
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingGrant" ADD CONSTRAINT "BillingGrant_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
