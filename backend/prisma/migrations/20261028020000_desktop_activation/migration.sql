ALTER TABLE "Restaurante" ADD COLUMN "activationCodeHash" TEXT;
CREATE UNIQUE INDEX "Restaurante_activationCodeHash_key" ON "Restaurante"("activationCodeHash");

CREATE TABLE "DesktopInstallation" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "restauranteId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "DesktopInstallation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesktopInstallation_installationId_key" ON "DesktopInstallation"("installationId");
CREATE UNIQUE INDEX "DesktopInstallation_tokenHash_key" ON "DesktopInstallation"("tokenHash");
CREATE INDEX "DesktopInstallation_restauranteId_revokedAt_idx" ON "DesktopInstallation"("restauranteId", "revokedAt");
ALTER TABLE "DesktopInstallation" ADD CONSTRAINT "DesktopInstallation_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
