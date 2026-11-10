import { z } from "zod";
import { failure, HttpError } from "@/lib/http";
import { hash, rateKey, rateLimit, sameOrigin } from "@/lib/security";
import { ownerEmail } from "@/lib/email";
import { sendOwnerLink, signOutOwner, verifyOwnerLink } from "@/lib/auth";

const input=z.discriminatedUnion("action",[
  z.object({action:z.literal("request"),email:z.string().trim().max(254).toLowerCase().pipe(z.email())}),
  z.object({action:z.literal("verify"),token:z.string().max(64)}),
  z.object({action:z.literal("logout")})
]);
export async function POST(request:Request) {
  try {
    sameOrigin(request);
    if (!process.env.DATABASE_URL || !ownerEmail()) throw new HttpError(503,"Owner sign-in is not configured.");
    const parsed=input.safeParse(await request.json().catch(()=>null));
    if (!parsed.success) throw new HttpError(400,"Check your sign-in information.");
    const data=parsed.data;
    await rateLimit(`session:${rateKey(request)}`,12,15);
    if (data.action==="request") {
      await rateLimit(`owner-link:${hash(data.email)}`,4,15);
      await sendOwnerLink(data.email);
    } else if (data.action==="verify") await verifyOwnerLink(data.token);
    else await signOutOwner();
    return Response.json({ok:true});
  } catch(error) { return failure(error); }
}
