import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { database, transaction } from "./db";
import { HttpError } from "./http";
import { checkoutReady, shippingCents, storeUrl } from "./settings";
import { token } from "./security";
import { stripe } from "./stripe";
import { enqueue } from "./outbox";

export type CartItem = { id:string; quantity:number };
export type Destination = { name:string; street1:string; street2?:string; city:string; state:string; zip:string; country:string };
type Order = {
  id:string; checkout_key:string; access_token:string; expires_at:Date; created_at:Date; payment_status:string;
  shipping_cents:number; automatic_tax:boolean; stripe_session:string|null; stripe_intent:string|null;
  refunded_cents:number; total_cents:number|null;
};
type Item = { variant_id:string; quantity:number; price:number; name:string; size:string; color:string; image:string };
const readItems = "SELECT * FROM order_items WHERE order_id=$1 ORDER BY variant_id";

export async function reserve(items:CartItem[], checkoutKey:string) {
  const ids = items.map(i=>i.id);
  return transaction(async client=>{
    // Serialize requests sharing a checkout key before checking or changing stock.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[checkoutKey]);
    const {rows:[existing]} = await client.query<Order>("SELECT * FROM orders WHERE checkout_key=$1",[checkoutKey]);
    if (existing) {
      const {rows:prior} = await client.query<Item>(readItems,[existing.id]);
      if (prior.length !== items.length || prior.some(row=>!items.some(item=>item.id===row.variant_id && item.quantity===row.quantity)))
        throw new HttpError(409,"Your bag changed. Start a new checkout.");
      return {order:existing,items:prior};
    }
    const {rows} = await client.query(`
      SELECT v.id,v.size,v.price,v.stock-v.reserved AS available,p.name,p.color,p.image
      FROM variants v JOIN products p ON p.slug=v.product_slug
      WHERE v.id=ANY($1::text[]) AND p.approved AND btrim(p.measurements)<>''
        AND p.release_at<=now() AND v.price IS NOT NULL
      ORDER BY v.id FOR UPDATE OF v,p`,[ids]);
    if (rows.length !== items.length || rows.some(row=>row.available < items.find(i=>i.id===row.id)!.quantity))
      throw new HttpError(409,"Some sizes in your bag are unavailable. Check your bag and try again.");
    const {rows:[order]} = await client.query<Order>(`
      INSERT INTO orders(id,checkout_key,access_token,expires_at,shipping_cents,automatic_tax)
      VALUES($1,$2,$3,date_trunc('second',now())+interval '35 minutes',$4,$5) RETURNING *`,
      [randomUUID(),checkoutKey,token(),shippingCents(),process.env.STRIPE_AUTOMATIC_TAX==="true"]);
    for (const row of rows) {
      const quantity = items.find(i=>i.id===row.id)!.quantity;
      await client.query("UPDATE variants SET reserved=reserved+$2 WHERE id=$1",[row.id,quantity]);
      await client.query(`INSERT INTO order_items(order_id,variant_id,quantity,price,name,size,color,image)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[order.id,row.id,quantity,row.price,row.name,row.size,row.color,row.image]);
    }
    const result = await client.query<Item>(readItems,[order.id]);
    return {order,items:result.rows};
  });
}

export async function checkout(items:CartItem[], key:string) {
  if (!checkoutReady()) throw new HttpError(503,"Checkout opens with the first drop.");
  const reserved = await reserve(items,key);
  const order = reserved.order;
  if (order.payment_status !== "pending" || order.expires_at.getTime() <= Date.now())
    throw new HttpError(409,"This checkout has ended. Start again from your bag.");
  const api = stripe();
  const session = order.stripe_session ? await api.checkout.sessions.retrieve(order.stripe_session) :
    await api.checkout.sessions.create({
      mode:"payment",
      client_reference_id:order.id,
      metadata:{order_id:order.id},
      payment_intent_data:{metadata:{order_id:order.id}},
      expires_at:Math.floor(order.expires_at.getTime()/1000),
      shipping_address_collection:{allowed_countries:["US"]},
      shipping_options:[{shipping_rate_data:{display_name:"Standard U.S. shipping",type:"fixed_amount",
        fixed_amount:{amount:order.shipping_cents,currency:"usd"},tax_behavior:"exclusive",tax_code:"txcd_92010001"}}],
      automatic_tax:{enabled:order.automatic_tax},
      allow_promotion_codes:true,
      line_items:reserved.items.map(item=>({quantity:item.quantity,price_data:{
        currency:"usd",unit_amount:item.price,tax_behavior:"exclusive",
        product_data:{name:`${item.name} · ${item.color} / ${item.size}`,tax_code:"txcd_30011000",
          images:storeUrl().startsWith("https:")?[new URL(item.image,storeUrl()).href]:undefined}
      }})),
      success_url:`${storeUrl()}/order/${order.access_token}?checkout=complete`,
      cancel_url:`${storeUrl()}/bag`
    },{idempotencyKey:`checkout-${order.id}`});
  await database().query("UPDATE orders SET stripe_session=$2 WHERE id=$1 AND (stripe_session IS NULL OR stripe_session=$2)",[order.id,session.id]);
  if (session.status !== "open" || !session.url) throw new HttpError(409,"This checkout has ended. Start again from your bag.");
  return session.url;
}

function stripeAddress(session:Stripe.Checkout.Session): Destination | null {
  const legacy = session as Stripe.Checkout.Session & {shipping_details?:{name:string;address:Stripe.Address}};
  const shipping = session.collected_information?.shipping_details ?? legacy.shipping_details;
  const address = shipping?.address;
  if (!shipping?.name || !address?.line1 || !address.city || !address.state || !address.postal_code || address.country !== "US")
    return null;
  return {name:shipping.name,street1:address.line1,street2:address.line2 ?? undefined,
    city:address.city,state:address.state,zip:address.postal_code,country:address.country};
}

export async function applyCheckout(session:Stripe.Checkout.Session, eventId:string, terminalFailure=false) {
  const id = session.metadata?.order_id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || session.client_reference_id !== id) return;
  await transaction(async client=>{
    const {rows:[order]} = await client.query<Order>("SELECT * FROM orders WHERE id=$1 FOR UPDATE",[id]);
    if (!order || (order.stripe_session && order.stripe_session !== session.id)) return;
    const event = await client.query("INSERT INTO provider_events(provider,event_id) VALUES('stripe',$1) ON CONFLICT DO NOTHING",[eventId]);
    if (!event.rowCount || order.payment_status !== "pending") return;
    await client.query("UPDATE orders SET stripe_session=$2 WHERE id=$1",[id,session.id]);
    const paid = session.payment_status==="paid" || (session.payment_status==="no_payment_required" && session.amount_total===0);
    if (paid) {
      if (session.currency !== "usd" || session.amount_total === null) {
        await client.query("UPDATE orders SET payment_review='Verify Stripe amount and currency' WHERE id=$1",[id]);
        return;
      }
      const destination = stripeAddress(session);
      const email = session.customer_details?.email ?? session.customer_email;
      await client.query(`UPDATE orders SET payment_status='paid',paid_at=now(),email=$2,destination=$3,
        total_cents=$4,stripe_intent=$5,payment_review=$6 WHERE id=$1`,[
        id,email,destination?JSON.stringify(destination):null,session.amount_total,
        typeof session.payment_intent==="string"?session.payment_intent:session.payment_intent?.id??null,
        destination&&email?null:"Verify customer shipping details in Stripe"
      ]);
      await client.query(`UPDATE variants v SET stock=v.stock-i.quantity,reserved=v.reserved-i.quantity
        FROM order_items i WHERE i.order_id=$1 AND v.id=i.variant_id`,[id]);
      if (email) await enqueue(client,"paid-customer",id,{orderId:id});
      await enqueue(client,"paid-owner",id,{orderId:id});
    } else if (session.status==="expired" || terminalFailure) {
      await client.query("UPDATE orders SET payment_status='expired' WHERE id=$1",[id]);
      await client.query(`UPDATE variants v SET reserved=v.reserved-i.quantity FROM order_items i
        WHERE i.order_id=$1 AND v.id=i.variant_id`,[id]);
    }
  });
}

export async function applyRefund(charge:Stripe.Charge) {
  const intent = typeof charge.payment_intent==="string"?charge.payment_intent:charge.payment_intent?.id;
  if (!intent) return;
  const api = stripe();
  // Stripe can deliver refund and Checkout events out of order.
  const existing=await database().query("SELECT 1 FROM orders WHERE stripe_intent=$1",[intent]);
  if (!existing.rowCount) {
    const {data:[session]}=await api.checkout.sessions.list({payment_intent:intent,limit:1});
    if (!session?.metadata?.order_id) return;
    await applyCheckout(session,`refund-reconcile:${charge.id}`);
  }
  let cents = 0;
  for await (const refund of api.refunds.list({charge:charge.id,limit:100}))
    if (refund.status==="succeeded") cents += refund.amount;
  await transaction(async client=>{
    const {rows:[order]} = await client.query<Order>("SELECT * FROM orders WHERE stripe_intent=$1 FOR UPDATE",[intent]);
    if (!order || cents <= order.refunded_cents) return;
    const status = cents >= (order.total_cents ?? charge.amount) ? "refunded" : "partially_refunded";
    await client.query(`UPDATE orders SET payment_status=$2,refunded_cents=$3,
      payment_review=CASE WHEN $2='partially_refunded' THEN 'Review items before shipping' ELSE payment_review END WHERE id=$1`,[order.id,status,cents]);
    await enqueue(client,"refund",`${order.id}:${cents}`,{orderId:order.id,amount:cents-order.refunded_cents});
  });
}

export async function reconcileCheckouts() {
  const {rows} = await database().query<Order>(`SELECT * FROM orders WHERE payment_status='pending'
    AND expires_at<now() ORDER BY expires_at LIMIT 50`);
  if (!rows.length || !process.env.STRIPE_SECRET_KEY) return;
  const api = stripe();
  for (const order of rows) {
    try {
      let session:Stripe.Checkout.Session|undefined;
      if (order.stripe_session) session=await api.checkout.sessions.retrieve(order.stripe_session);
      else {
        // A request can succeed at Stripe even if its response never reached us.
        for await (const candidate of api.checkout.sessions.list({limit:100,created:{
          gte:Math.floor(order.created_at.getTime()/1000)-2,lte:Math.ceil(order.expires_at.getTime()/1000)
        }})) {
          if (candidate.metadata?.order_id===order.id) {session=candidate;break;}
        }
      }
      if (session) {
        await applyCheckout(session,`reconcile:${session.id}:${session.status}:${session.payment_status}`);
      } else {
        await transaction(async client=>{
          const result=await client.query(`UPDATE orders SET payment_status='expired' WHERE id=$1
            AND payment_status='pending' AND stripe_session IS NULL RETURNING id`,[order.id]);
          if (result.rowCount) await client.query(`UPDATE variants v SET reserved=v.reserved-i.quantity
            FROM order_items i WHERE i.order_id=$1 AND v.id=i.variant_id`,[order.id]);
        });
      }
    } catch { console.error("Could not reconcile checkout",order.id); }
  }
}
