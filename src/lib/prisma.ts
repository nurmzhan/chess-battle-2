// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  
  // Во время билда DATABASE_URL может быть undefined
  if (!url) {
    return new PrismaClient();
  }
  
  const separator = url.includes('?') ? '&' : '?';
  return new PrismaClient({
    datasources: {
      db: {
        url: url + separator + 'pgbouncer=true&prepared_statements=false',
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;