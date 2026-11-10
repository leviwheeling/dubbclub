import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {ownerSession} from "@/lib/auth";
import {ownerOrder,shipmentStage} from "@/lib/order-view";
import {money} from "@/lib/catalog";
import type {Destination} from "@/lib/orders";
import {ShipDesk} from "../../components";

export default async function AdminOrder({params}:{params:Promise<{id:string}>}) {
  if (!await ownerSession()) redirect("/admin");
  const order=await ownerOrder((await params).id);
  if (!order) notFound();
  const address=order.destination as Destination|null;
  const stage=shipmentStage(order);
  return <section className="wrap admin-page">
    <p className="eyebrow"><Link href="/admin">← ORDER DESK</Link></p>
    <div className="admin-heading"><h1>#{order.id.slice(0,8).toUpperCase()}</h1><span className="order-status">{stage}</span></div>
    <div className="admin-order-grid">
      <div className="admin-stack">
        <div className="admin-panel"><p className="eyebrow">ORDER DETAILS</p><h2>Pack list</h2>
          {order.items.map(item=><div className="pack-row" key={`${item.name}:${item.color}:${item.size}`}>
            <span><strong>{item.name}</strong><small>{item.color} / {item.size} · Qty {item.quantity}</small></span><span>{money(item.price*item.quantity)}</span>
          </div>)}
          <div className="pack-row"><span>Shipping charged</span><span>{money(order.shipping_cents)}</span></div>
          {order.total_cents!==null&&<div className="pack-row"><strong>Total charged</strong><strong>{money(order.total_cents)}</strong></div>}
          {order.refunded_cents>0&&<div className="pack-row"><span>Refunded</span><strong>{money(order.refunded_cents)}</strong></div>}
          {order.stripe_intent&&<a className="text-link" href={`https://dashboard.stripe.com/${process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")?"test/":""}payments/${order.stripe_intent}`} target="_blank" rel="noreferrer">Open payment in Stripe</a>}
        </div>
        <div className="admin-panel"><p className="eyebrow">CUSTOMER</p><h2>Ship to</h2>
          {address?<address>{address.name}<br/>{address.street1}<br/>{address.street2&&<>{address.street2}<br/></>}{address.city}, {address.state} {address.zip}<br/>{address.country}</address>:<p>Address needs review.</p>}
          {order.email&&<p>{order.email}</p>}{order.payment_review&&<p className="notice">{order.payment_review}</p>}
        </div>
      </div>
      <div className="admin-stack">
        <ShipDesk orderId={order.id} canShip={order.payment_status==="paid"&&!!address&&!order.payment_review}
          purchaseState={order.purchase_state} labelUrl={order.label_url}
          hasShippo={!!(process.env.SHIPPO_API_TOKEN&&process.env.SHIPPO_FROM_ADDRESS_JSON)}/>
        <div className="admin-panel"><p className="eyebrow">STATUS</p><h2>Tracking &amp; notifications</h2>
          {order.tracking&&<p>{order.carrier} · <a href={order.tracking_url??undefined} target="_blank" rel="noreferrer">{order.tracking}</a></p>}
          {order.postage_cents!=null&&order.purchase_state==="purchased"&&<p>Postage paid {money(order.postage_cents)}</p>}
          {order.attempt_id&&order.purchase_state!=="purchased"&&<p className="admin-reference">Shippo attempt {order.attempt_id}</p>}
          {order.exception&&<p className="notice">{order.exception}</p>}
          {order.emails.map(e=><div className="pack-row" key={e.job_key}><span>{e.kind.replaceAll("-"," ")}</span><span>{e.sent_at?"Accepted by Resend":e.failed_at?"Needs review":"Queued"}</span></div>)}
        </div>
      </div>
    </div>
  </section>;
}
