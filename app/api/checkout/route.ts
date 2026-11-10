import { z } from "zod";
import { checkout } from "@/lib/orders";
import { failure, HttpError } from "@/lib/http";
import { rateKey, rateLimit, sameOrigin } from "@/lib/security";
import { checkoutReady } from "@/lib/settings";

const input = z.object({key:z.uuid(),items:z.array(z.object({id:z.string().min(1).max(100),
  quantity:z.number().int().min(1).max(20)})).min(1).max(20)});
export async function POST(request:Request) {
  try {
    sameOrigin(request);
    if (!checkoutReady()) throw new HttpError(503,"Checkout opens with the first drop.");
    const parsed=input.safeParse(await request.json().catch(()=>null));
    if (!parsed.success || new Set(parsed.data.items.map(i=>i.id)).size!==parsed.data.items.length)
      throw new HttpError(400,"Your bag could not be read.");
    await rateLimit(`checkout:${rateKey(request)}`,15,10);
    return Response.json({url:await checkout(parsed.data.items,parsed.data.key)});
  } catch (error) { return failure(error); }
}
