import { equal } from "@/lib/security";
import { failure } from "@/lib/http";
import { applyShippoWebhook } from "@/lib/shippo";

export async function POST(request:Request,{params}:{params:Promise<{secret:string}>}) {
  const secret=process.env.SHIPPO_WEBHOOK_SECRET;
  if (!secret || secret.length<32 || !equal((await params).secret,secret)) return new Response(null,{status:404});
  try {
    await applyShippoWebhook(await request.json());
    return new Response(null,{status:204});
  } catch (error) { return failure(error); }
}
