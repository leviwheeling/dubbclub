import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { applyCheckout, applyRefund } from "@/lib/orders";
import { failure } from "@/lib/http";

export async function POST(request:Request) {
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  const signature=request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Missing signature.",{status:400});
  let event:Stripe.Event;
  try { event=stripe().webhooks.constructEvent(await request.text(),signature,secret); }
  catch { return new Response("Invalid signature.",{status:400}); }
  try {
    switch(event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await applyCheckout(event.data.object,event.id,event.type==="checkout.session.async_payment_failed");
        break;
      case "charge.refunded": await applyRefund(event.data.object); break;
      case "refund.updated": {
        const charge=event.data.object.charge;
        if (charge) await applyRefund(typeof charge==="string"?await stripe().charges.retrieve(charge):charge);
        break;
      }
    }
    return new Response(null,{status:204});
  } catch (error) { return failure(error); }
}
