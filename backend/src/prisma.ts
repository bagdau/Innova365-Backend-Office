import { PrismaClient } from '@prisma/client';

/** Cliente único compartido: un solo pool de conexiones para toda la app. */
export const prisma = new PrismaClient();
