import type { PoolClient } from "pg";
export type EmailKind = "paid-customer" | "paid-owner" | "shipped" | "delivered" | "exception" | "refund" | "subscriber";
export async function enqueue(client:PoolClient, kind:EmailKind, entity:string, payload:Record<string,string|number>) {
  await client.query("INSERT INTO email_jobs(job_key,kind,payload) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [`${kind}:${entity}`,kind,JSON.stringify(payload)]);
}
