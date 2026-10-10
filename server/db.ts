import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

export let pool: Pool | undefined;
export let db: any;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    db = drizzle(pool, { schema });
  } catch (err) {
    console.warn("Failed to initialize PostgreSQL pool:", err);
  }
}

if (!db) {
  console.warn('[AI Studio] DATABASE_URL not set or unreachable — using mock database proxy');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({})
  };
  db = new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'execute') return async () => { throw new Error('Database not connected'); };
      if (prop === 'query') return new Proxy({}, { get: () => noOp });
      if (prop === 'transaction') {
        return async (callback: (tx: any) => Promise<any>) => {
          return await callback(db);
        };
      }
      if (prop === 'select' || prop === 'insert' || prop === 'update' || prop === 'delete') {
        const chain: any = () => chain;
        chain.from = () => chain;
        chain.where = () => chain;
        chain.values = () => chain;
        chain.set = () => chain;
        chain.returning = async () => [];
        chain.limit = () => chain;
        chain.orderBy = () => chain;
        chain.innerJoin = () => chain;
        chain.leftJoin = () => chain;
        chain.then = (resolve: any) => resolve([]);
        return chain;
      }
      return async () => [];
    },
  });
}
