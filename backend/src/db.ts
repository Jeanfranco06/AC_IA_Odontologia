import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Asegurar que las variables de entorno se cargan antes de instanciar Prisma
dotenv.config({ path: path.join(__dirname, '../.env') });
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: path.join(__dirname, '../.env.test.local'), override: true });
}

export const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

/**
 * Helper con reintento automático para manejar desconexiones temporales o ráfagas
 * de sockets concurrentes a SQL Server (errores P1001, P1017, P2024).
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 120): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isConnectionError =
        err?.code === 'P1001' ||
        err?.code === 'P1017' ||
        err?.code === 'P2024' ||
        (err?.message && (
          err.message.includes("Can't reach database server") ||
          err.message.includes("Server has closed the connection") ||
          err.message.includes("Connection lost")
        ));

      if (isConnectionError && attempt < retries) {
        console.warn(`⚠️ [Prisma Retry] Intento ${attempt}/${retries} reintentando consulta tras reconexión a SQL Server...`);
        await new Promise(res => setTimeout(res, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
