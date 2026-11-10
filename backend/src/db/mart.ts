import sqlDefault, { ConnectionPool } from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

// Asegurar carga de .env desde backend/.env independientemente del cwd
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

let sql: typeof sqlDefault = sqlDefault;

// Solo recurrir a msnodesqlv8 en win32 si se solicita explícitamente ODBC sin credenciales
const isOdbcExplicit = Boolean(
  (process.env.MART_CONNECTION_STRING && process.env.MART_CONNECTION_STRING.includes('Driver=')) ||
  (process.env.OLTP_CONNECTION_STRING && process.env.OLTP_CONNECTION_STRING.includes('Driver='))
);

if (process.platform === 'win32' && isOdbcExplicit && !process.env.DB_USER) {
  try {
    // Permite autenticación de Windows en entornos locales con ODBC.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sql = require('mssql/msnodesqlv8');
  } catch {
    // La dependencia nativa es opcional; mssql estándar sigue disponible.
  }
}

function getMartConfig(): any {
  if (process.env.MART_CONNECTION_STRING) {
    return { connectionString: process.env.MART_CONNECTION_STRING };
  }
  if (process.env.DB_USER) {
    return {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 1433,
      database: process.env.MART_DATABASE || 'NexoSalud_Mart',
      options: {
        trustServerCertificate: true,
        encrypt: false,
      },
    };
  }
  return {
    connectionString:
      'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSalud_Mart;Trusted_Connection=yes;TrustServerCertificate=yes;',
  };
}

let poolPromise: Promise<ConnectionPool> | null = null;

export async function getMartPool(): Promise<ConnectionPool> {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(getMartConfig());

    poolPromise = pool.connect().then((connectedPool) => {
      console.log('✅ [NexoSalud_Mart] Conexión establecida exitosamente al DataMart (sin Prisma).');
      return connectedPool;
    }).catch((err) => {
      console.error('❌ [NexoSalud_Mart] Error conectando a NexoSalud_Mart:', err.message);
      poolPromise = null;
      throw err;
    });
  }

  return poolPromise;
}

export async function queryMart<T = any>(queryText: string, params?: Record<string, any>): Promise<T[]> {
  const pool = await getMartPool();
  const request = pool.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }
  const result = await request.query(queryText);
  return result.recordset as T[];
}

function getOltpConfig(): any {
  if (process.env.OLTP_CONNECTION_STRING) {
    return { connectionString: process.env.OLTP_CONNECTION_STRING };
  }
  if (process.env.DB_USER) {
    return {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 1433,
      database: process.env.OLTP_DATABASE || 'NexoSaludDB',
      options: {
        trustServerCertificate: true,
        encrypt: false,
      },
    };
  }
  return {
    connectionString:
      'Driver={ODBC Driver 17 for SQL Server};Server=localhost;Database=NexoSaludDB;Trusted_Connection=yes;TrustServerCertificate=yes;',
  };
}

let oltpPoolPromise: Promise<ConnectionPool> | null = null;

export async function getOltpPool(): Promise<ConnectionPool> {
  if (!oltpPoolPromise) {
    const pool = new sql.ConnectionPool(getOltpConfig());
    oltpPoolPromise = pool.connect().then((connectedPool) => {
      console.log('✅ [NexoSaludDB] Conexión establecida exitosamente a la BD Transaccional.');
      return connectedPool;
    }).catch((err) => {
      console.error('❌ [NexoSaludDB] Error conectando a NexoSaludDB:', err.message);
      oltpPoolPromise = null;
      throw err;
    });
  }
  return oltpPoolPromise;
}

export async function queryOltp<T = any>(queryText: string, params?: Record<string, any>): Promise<T[]> {
  const pool = await getOltpPool();
  const request = pool.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }
  const result = await request.query(queryText);
  return result.recordset as T[];
}

export { sql as martSql };
