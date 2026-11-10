import { z } from "zod";
import { transaction } from "@/lib/db";
import { failure, HttpError } from "@/lib/http";
import { enqueue } from "@/lib/outbox";
import { hash, rateKey, rateLimit, sameOrigin } from "@/lib/security";
const input=z.object({email:z.string().trim().max(254).toLowerCase().pipe(z.email())});
export async function POST(request:Request) {
  try {
    sameOrigin(request);
    if (!process.env.DATABASE_URL) throw new HttpError(503,"Drop notifications are not open yet.");
    const parsed=input.safeParse(await request.json().catch(()=>null));
    if (!parsed.success) throw new HttpError(400,"Enter a valid email address.");
    await rateLimit(`signup:${rateKey(request)}`,8,15);
    const {email}=parsed.data;
    await transaction(async client=>{
      await client.query("INSERT INTO subscribers(email) VALUES($1) ON CONFLICT DO NOTHING",[email]);
      await enqueue(client,"subscriber",hash(email),{email});
    });
    return Response.json({ok:true});
  } catch(error) { return failure(error); }
}
