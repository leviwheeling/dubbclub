import {notFound} from "next/navigation";
import {publicOrder} from "@/lib/order-view";
import {money} from "@/lib/catalog";
import {OrderRefresh} from "../../components/order-refresh";
import {UpRight} from "../../components/icons";
export const dynamic="force-dynamic";
export const metadata={title:"Order status",robots:{index:false,follow:false},referrer:"no-referrer" as const};

export default async function Tracking({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{checkout?:string}>}) {
  const {token}=await params;
  const order=await publicOrder(token);
  if (!order) notFound();
  const pending=order.payment_status==="pending";
  const refund=order.payment_status==="refunded";
  const stage=refund?"Refunded":pending?"Confirming payment":order.tracking_state==="DELIVERED"?"Delivered":
    order.tracking_state==="TRANSIT"?"In transit":["RETURNED","FAILURE"].includes(order.tracking_state??"")?"Shipping update":"Preparing your order";
  return <section className="wrap small-page">
    <OrderRefresh pending={pending} orderId={order.id} complete={!pending&&(await searchParams).checkout==="complete"}/>
    <p className="eyebrow">DUBBCLUB / ORDER {order.id.slice(0,8).toUpperCase()}</p><h1>{stage}.</h1>
    <p className="intro">{pending?"Your order will update as soon as Stripe confirms the payment.":refund?"Your refund was issued to your original payment method.":"Check back here for updates on your order."}</p>
    <div className="tracking-list">{order.items.map(item=><div className="bag-row" key={item.variant_id}>
      <img src={item.image} width="74" height="89" alt=""/><div><h2>{item.name}</h2><p>{item.color} / {item.size} · Qty {item.quantity}</p></div>
      <strong>{money(item.price*item.quantity)}</strong>
    </div>)}</div>
    {order.total_cents!==null&&<p className="tracking-total">Order total <strong>{money(order.total_cents)}</strong></p>}
    {order.refunded_cents>0&&<p className="tracking-total">Refunded <strong>{money(order.refunded_cents)}</strong></p>}
    {order.tracking&&<div className="tracking-action"><p>{order.carrier} · {order.tracking}</p>
      {order.tracking_url&&<a className="button outline" href={order.tracking_url} target="_blank" rel="noreferrer">Carrier tracking <UpRight/></a>}
    </div>}
  </section>;
}
