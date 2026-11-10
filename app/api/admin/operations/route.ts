import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { failure, HttpError } from "@/lib/http";
import { buyLabel, parcelInput, quote, reconcileLabel } from "@/lib/shippo";
import { sameOrigin } from "@/lib/security";

const imageInput=z.string().max(500).refine(value=>{
  if (/^\/images\/[a-z0-9/_-]+\.(webp|jpg|jpeg|png)$/i.test(value)) return true;
  try {const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password;}
  catch{return false;}
});
const input=z.discriminatedUnion("action",[
  z.object({action:z.literal("quote"),orderId:z.uuid(),parcel:parcelInput}),
  z.object({action:z.literal("buy"),orderId:z.uuid(),rateId:z.string().min(1).max(100)}),
  z.object({action:z.literal("reconcile"),orderId:z.uuid()}),
  z.object({action:z.literal("product"),slug:z.string().min(1).max(80),approved:z.boolean(),
    releaseAt:z.iso.datetime().nullable(),description:z.string().trim().min(1).max(2000),fit:z.string().trim().min(1).max(600),
    measurements:z.string().trim().max(3000),image:imageInput,
    variants:z.array(z.object({id:z.string().max(100),stock:z.number().int().min(0).max(100000),
      price:z.number().int().min(50).max(1000000).nullable()})).min(1).max(20)})
]);

export async function POST(request:Request) {
  try {
    sameOrigin(request);
    await requireOwner();
    const parsed=input.safeParse(await request.json().catch(()=>null));
    if (!parsed.success) throw new HttpError(400,"Check the fields and try again. Prices must be at least $0.50 and photos must use HTTPS or a store image.");
    const data=parsed.data;
    if (data.action==="quote") return Response.json({rates:await quote(data.orderId,data.parcel)});
    if (data.action==="buy") return Response.json({state:await buyLabel(data.orderId,data.rateId)});
    if (data.action==="reconcile") return Response.json({state:await reconcileLabel(data.orderId)});
    if (data.approved && (!data.releaseAt || !data.measurements || !data.variants.some(v=>v.price!==null)))
      throw new HttpError(400,"Add measurements, a release date, and at least one price before approving this piece.");
    await transaction(async client=>{
      const {rows}=await client.query(`SELECT v.id,v.reserved FROM variants v JOIN products p ON p.slug=v.product_slug
        WHERE p.slug=$1 ORDER BY v.id FOR UPDATE OF v,p`,[data.slug]);
      if (!rows.length) throw new HttpError(404,"Product not found.");
      if (rows.length!==data.variants.length || new Set(data.variants.map(v=>v.id)).size!==rows.length)
        throw new HttpError(400,"All sizes must be present.");
      for (const variant of data.variants) {
        const row=rows.find(r=>r.id===variant.id);
        if (!row) throw new HttpError(400,"Unrecognized size.");
        if (variant.stock<row.reserved) throw new HttpError(409,"Stock can’t fall below quantities reserved in open checkouts.");
        await client.query("UPDATE variants SET stock=$2,price=$3 WHERE id=$1",[variant.id,variant.stock,variant.price]);
      }
      await client.query(`UPDATE products SET description=$2,fit=$3,measurements=$4,image=$5,approved=$6,release_at=$7
        WHERE slug=$1`,[data.slug,data.description,data.fit,data.measurements,data.image,data.approved,data.releaseAt]);
    });
    return Response.json({ok:true});
  } catch(error) { return failure(error); }
}
