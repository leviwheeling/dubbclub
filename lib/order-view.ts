import { database } from "./db";
import type { Destination } from "./orders";
type ShipmentView = {
  purchase_state:string|null; tracking_state:string|null; tracking:string|null; tracking_url:string|null;
  carrier:string|null; label_url:string|null; postage_cents:number|null; exception:string|null; attempt_id:string|null; provider_id:string|null;
};
type OwnerOrderSummary=ShipmentView & {id:string;email:string|null;payment_status:string;payment_review:string|null;total_cents:number|null;paid_at:Date|null};
type OwnerOrder=OwnerOrderSummary & {destination:Destination|null;refunded_cents:number;shipping_cents:number;stripe_intent:string|null};
type OwnerItem={name:string;size:string;color:string;price:number;quantity:number};
type EmailStatus={job_key:string;kind:string;attempts:number;sent_at:Date|null;failed_at:Date|null;last_error:string|null};
export function shipmentStage(order:{payment_status:string;purchase_state?:string|null;tracking_state?:string|null;
  exception?:string|null;payment_review?:string|null}) {
  if (order.payment_status==="refunded") return "Refunded";
  if (order.payment_review || order.exception || ["pending","unknown","failed"].includes(order.purchase_state??""))
    return "Needs attention";
  if (order.tracking_state==="DELIVERED") return "Delivered";
  if (order.tracking_state==="TRANSIT") return "In transit";
  if (order.purchase_state==="purchased") return "Label ready";
  if (order.payment_status==="paid") return "Ready to ship";
  return "Payment pending";
}
const shipmentColumns=`s.purchase_state,s.tracking_state,s.tracking,s.tracking_url,s.carrier,s.label_url,
  s.postage_cents,s.exception,s.attempt_id,s.provider_id`;
export async function publicOrder(token:string) {
  if (!process.env.DATABASE_URL || !/^[a-f0-9]{64}$/.test(token)) return null;
  const {rows:[order]}=await database().query(`SELECT o.id,o.payment_status,o.total_cents,o.refunded_cents,
    s.purchase_state,s.tracking_state,s.tracking,s.tracking_url,s.carrier FROM orders o
    LEFT JOIN shipments s ON s.order_id=o.id WHERE o.access_token=$1 AND o.payment_status<>'expired'`,[token]);
  if (!order) return null;
  const {rows:items}=await database().query("SELECT variant_id,name,size,color,price,quantity,image FROM order_items WHERE order_id=$1 ORDER BY variant_id",[order.id]);
  return {...order,items} as Record<string,unknown> & {id:string;items:Array<{variant_id:string;name:string;size:string;color:string;quantity:number;image:string;price:number}>;
    payment_status:string;total_cents:number|null;refunded_cents:number;purchase_state:string|null;tracking_state:string|null;tracking_url:string|null;tracking:string|null;carrier:string|null};
}
export async function ownerOrders() {
  const {rows}=await database().query<OwnerOrderSummary>(`SELECT o.id,o.email,o.payment_status,o.payment_review,o.total_cents,
    o.paid_at,${shipmentColumns} FROM orders o LEFT JOIN shipments s ON s.order_id=o.id
    WHERE o.payment_status IN ('paid','partially_refunded','refunded') ORDER BY o.paid_at DESC`);
  return rows;
}
export async function ownerOrder(id:string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const {rows:[order]}=await database().query<OwnerOrder>(`SELECT o.id,o.email,o.payment_status,o.payment_review,
    o.destination,o.total_cents,o.refunded_cents,o.shipping_cents,o.stripe_intent,${shipmentColumns}
    FROM orders o LEFT JOIN shipments s ON s.order_id=o.id
    WHERE o.id=$1 AND o.payment_status IN ('paid','partially_refunded','refunded')`,[id]);
  if (!order) return null;
  const {rows:items}=await database().query<OwnerItem>("SELECT name,size,color,price,quantity FROM order_items WHERE order_id=$1 ORDER BY variant_id",[id]);
  const {rows:emails}=await database().query<EmailStatus>(`SELECT job_key,kind,attempts,sent_at,failed_at,last_error FROM email_jobs
    WHERE payload->>'orderId'=$1 ORDER BY available_at`,[id]);
  return {...order,items,emails};
}
