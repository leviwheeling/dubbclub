import { Pool, type PoolClient } from "pg";
const shared = globalThis as typeof globalThis & { dubbPool?: Pool };
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  return shared.dubbPool ??= new Pool({connectionString:process.env.DATABASE_URL, max:8});
}
export async function transaction<T>(work: (client: PoolClient)=>Promise<T>): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
