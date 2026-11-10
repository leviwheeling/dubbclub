import { randomUUID } from "node:crypto";
import { z } from "zod";
import { database, transaction } from "./db";
import { HttpError } from "./http";
import { enqueue } from "./outbox";
import type { Destination } from "./orders";

const addressInput = z.object({
  name:z.string().trim().min(1).max(150),street1:z.string().trim().min(1),street2:z.string().optional(),
  city:z.string().trim().min(1),state:z.string().regex(/^[A-Z]{2}$/),zip:z.string().regex(/^\d{5}(-\d{4})?$/),country:z.literal("US")
});
export const parcelInput = z.object({
  length:z.number().positive().max(100),width:z.number().positive().max(100),
  height:z.number().positive().max(100),weight:z.number().positive().max(70)
});
type Parcel=z.infer<typeof parcelInput>;
type Rate={object_id:string;provider:string;servicelevel:{name:string};amount:string;currency:string;estimated_days?:number};
type Label={object_id:string;status:string;metadata?:string;label_url?:string;
  tracking_number?:string;tracking_url_provider?:string;object_created?:string};
type Attempt={order_id:string;attempt_id:string;provider_id:string|null;purchase_state:string;
  carrier:string;tracking:string|null;tracking_state:string|null;tracking_at:Date|null;updated_at:Date};

class ShippoError extends Error {
  constructor(readonly status:number) { super("Shippo request failed."); }
}
async function requestShippo<T>(path:string, body?:unknown):Promise<T> {
  const key=process.env.SHIPPO_API_TOKEN;
  if (!key) throw new HttpError(503,"Connect Shippo before buying labels.");
  const response=await fetch(new URL(path,"https://api.goshippo.com"),{
    method:body?"POST":"GET",cache:"no-store",signal:AbortSignal.timeout(12000),
    headers:{Authorization:`ShippoToken ${key}`,"Content-Type":"application/json","SHIPPO-API-VERSION":"2018-02-08"},
    body:body?JSON.stringify(body):undefined
  });
  if (!response.ok) throw new ShippoError(response.status);
  return response.json();
}
function sender() {
  try { return addressInput.parse(JSON.parse(process.env.SHIPPO_FROM_ADDRESS_JSON??"null")); }
  catch { throw new HttpError(503,"Set the U.S. ship-from address before requesting rates."); }
}
function shippingOrder(order:{payment_status:string;destination:Destination|null;payment_review:string|null}) {
  if (!order || order.payment_status!=="paid" || !order.destination || order.payment_review)
    throw new HttpError(409,"Only paid orders with confirmed shipping details can be shipped.");
}
export async function quote(orderId:string, parcel:Parcel) {
  const {rows:[order]}=await database().query("SELECT payment_status,destination,payment_review FROM orders WHERE id=$1",[orderId]);
  shippingOrder(order);
  const shipment=await requestShippo<{rates:Rate[]}>("/shipments/",{
    address_from:sender(),address_to:addressInput.parse(order.destination),async:false,
    parcels:[{...parcel,mass_unit:"lb",distance_unit:"in"}]
  });
  const rates=(shipment.rates??[]).filter(r=>r.currency==="USD" && /^\d+(\.\d{1,2})?$/.test(r.amount))
    .map(r=>({id:r.object_id,carrier:r.provider,service:r.servicelevel.name,
      cents:Math.round(Number(r.amount)*100),days:r.estimated_days??null}))
    .sort((a,b)=>a.cents-b.cents);
  if (!rates.length) throw new HttpError(422,"Shippo returned no rates. Check the address and parcel details.");
  await transaction(async client=>{
    for (const rate of rates) await client.query(`INSERT INTO shipping_quotes(rate_id,order_id,carrier,service,cents,expires_at)
      VALUES($1,$2,$3,$4,$5,now()+interval '15 minutes') ON CONFLICT DO NOTHING`,
    [rate.id,orderId,rate.carrier,rate.service,rate.cents]);
  });
  return rates;
}

const knownFailure=new Set([400,401,403,404,422]);
function usableUrl(value:unknown) {
  return typeof value==="string" && /^https:\/\//i.test(value) ? value : null;
}
async function saveLabel(orderId:string,attemptId:string,label:Label) {
  const url=usableUrl(label.label_url);
  const purchased=label.status==="SUCCESS" && url && label.tracking_number;
  const state=purchased?"purchased":label.status==="ERROR"?"failed":"unknown";
  await database().query(`UPDATE shipments SET purchase_state=$3,provider_id=$4,label_url=$5,
    tracking=$6,tracking_url=$7,tracking_state=CASE WHEN $3='purchased' THEN 'PRE_TRANSIT' ELSE NULL END,
    exception=$8,updated_at=now() WHERE order_id=$1 AND attempt_id=$2 AND purchase_state IN ('pending','unknown')`,
  [orderId,attemptId,state,label.object_id??null,url,label.tracking_number??null,usableUrl(label.tracking_url_provider),
    state==="failed"?"Shippo rejected the label. Check the address and rates.":state==="unknown"?"Awaiting Shippo confirmation.":null]);
  return state;
}
export async function buyLabel(orderId:string,rateId:string) {
  if (!process.env.SHIPPO_API_TOKEN) throw new HttpError(503,"Connect Shippo before buying labels.");
  const attemptId=randomUUID();
  await transaction(async client=>{
    const {rows:[order]}=await client.query("SELECT payment_status,destination,payment_review FROM orders WHERE id=$1 FOR UPDATE",[orderId]);
    shippingOrder(order);
    const {rows:[rate]}=await client.query(`SELECT * FROM shipping_quotes
      WHERE rate_id=$1 AND order_id=$2 AND expires_at>now()`,[rateId,orderId]);
    if (!rate) throw new HttpError(409,"This rate expired. Request fresh rates.");
    const result=await client.query(`INSERT INTO shipments(order_id,attempt_id,purchase_state,carrier,postage_cents)
      VALUES($1,$2,'pending',$3,$4) ON CONFLICT(order_id) DO UPDATE SET
      attempt_id=EXCLUDED.attempt_id,purchase_state='pending',carrier=EXCLUDED.carrier,postage_cents=EXCLUDED.postage_cents,
      provider_id=NULL,label_url=NULL,tracking=NULL,tracking_url=NULL,tracking_state=NULL,tracking_at=NULL,exception=NULL,updated_at=now()
      WHERE shipments.purchase_state='failed' RETURNING order_id`,[orderId,attemptId,rate.carrier,rate.cents]);
    if (!result.rowCount) throw new HttpError(409,"A label already exists or the last attempt is still being checked.");
  });
  let label:Label;
  try { label=await requestShippo<Label>("/transactions/",{rate:rateId,label_file_type:"PDF_4x6",async:false,metadata:attemptId}); }
  catch(error) {
    const definitive=error instanceof ShippoError && knownFailure.has(error.status);
    await database().query(`UPDATE shipments SET purchase_state=$3,exception=$4,updated_at=now()
      WHERE order_id=$1 AND attempt_id=$2 AND purchase_state='pending'`,
    [orderId,attemptId,definitive?"failed":"unknown",definitive?"Shippo rejected the request.":"Confirm the purchase with Shippo before retrying."]);
    throw new HttpError(definitive?422:502,definitive?"Shippo rejected the label request.":"Shippo’s result is unclear. Check the purchase status before retrying.");
  }
  return saveLabel(orderId,attemptId,label);
}

export async function reconcileLabel(orderId:string) {
  const {rows:[attempt]}=await database().query<Attempt>("SELECT * FROM shipments WHERE order_id=$1",[orderId]);
  if (!attempt || !["pending","unknown"].includes(attempt.purchase_state)) return attempt?.purchase_state;
  if (attempt.purchase_state==="pending" && Date.now()-attempt.updated_at.getTime()<15000) return "pending";
  if (attempt.provider_id) {
    const label=await requestShippo<Label>(`/transactions/${encodeURIComponent(attempt.provider_id)}/`);
    return saveLabel(orderId,attempt.attempt_id,label);
  }
  for (let page=1;page<=10;page++) {
    const data=await requestShippo<{results:Label[];next:string|null}>(`/transactions/?results=100&page=${page}`);
    const match=data.results.find(row=>row.metadata===attempt.attempt_id);
    if (match) return saveLabel(orderId,attempt.attempt_id,match);
    if (!data.next) break;
  }
  // An absent result does not prove that no label was purchased.
  await database().query(`UPDATE shipments SET purchase_state='unknown',
    exception='No matching label yet. Verify in the Shippo dashboard before any replacement.',updated_at=now()
    WHERE order_id=$1 AND attempt_id=$2 AND purchase_state IN ('pending','unknown')`,[orderId,attempt.attempt_id]);
  return "unknown";
}

const trackingInput=z.object({carrier:z.string().min(1).max(80),tracking_number:z.string().min(1).max(180),
  tracking_status:z.object({status:z.string(),status_date:z.iso.datetime({offset:true}).nullish(),
    substatus:z.object({action_required:z.boolean().optional()}).nullish()})});
const carrierKey=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");
export async function applyTracking(payload:unknown) {
  const parsed=trackingInput.safeParse(payload);
  if (!parsed.success) return;
  const data=parsed.data;
  const current=data.tracking_status.status;
  const when=data.tracking_status.status_date;
  const action=data.tracking_status.substatus?.action_required===true;
  if (!when || !["TRANSIT","DELIVERED","RETURNED","FAILURE","PRE_TRANSIT"].includes(current)) return;
  await transaction(async client=>{
    const {rows:[row]}=await client.query<Attempt>(`SELECT * FROM shipments
      WHERE tracking=$1 AND regexp_replace(lower(carrier),'[^a-z0-9]','','g')=$2
        AND purchase_state='purchased' FOR UPDATE`,[data.tracking_number,carrierKey(data.carrier)]);
    if (!row || (row.tracking_at && new Date(when)<row.tracking_at) ||
      (current==="PRE_TRANSIT" && row.tracking_state!=="PRE_TRANSIT") ||
      (current==="TRANSIT" && row.tracking_state==="DELIVERED")) return;
    const isIssue=action || current==="FAILURE" || current==="RETURNED";
    const eventId=`${row.attempt_id}:${current}:${when}:${action}`;
    const saved=await client.query("INSERT INTO provider_events(provider,event_id) VALUES('shippo',$1) ON CONFLICT DO NOTHING",[eventId]);
    if (!saved.rowCount) return;
    await client.query(`UPDATE shipments SET tracking_state=$2,tracking_at=$3,updated_at=now(),exception=$4
      WHERE order_id=$1`,[row.order_id,current,when,isIssue?"Carrier flagged this shipment. Review tracking.":null]);
    const payload={orderId:row.order_id};
    if (current==="TRANSIT") await enqueue(client,"shipped",row.order_id,payload);
    if (current==="DELIVERED") await enqueue(client,"delivered",row.order_id,payload);
    if (isIssue) await enqueue(client,"exception",`${row.order_id}:${current}`,payload);
  });
}
export async function applyShippoWebhook(event:unknown) {
  const payload=z.object({event:z.string(),data:z.unknown()}).safeParse(event);
  if (!payload.success) return;
  const {event:kind,data}=payload.data;
  if (kind==="track_updated") await applyTracking(data);
  if (kind==="transaction_created" || kind==="transaction_updated") {
    const label=data as Label;
    if (!label?.object_id || !label.metadata) return;
    const {rows:[row]}=await database().query<Attempt>(`SELECT * FROM shipments
      WHERE attempt_id::text=$1 AND purchase_state IN ('pending','unknown')`,[label.metadata]);
    if (row) await saveLabel(row.order_id,row.attempt_id,label);
  }
}
export async function reconcileShipments() {
  if (!process.env.SHIPPO_API_TOKEN) return;
  const {rows}=await database().query<Attempt>(`SELECT * FROM shipments WHERE purchase_state IN ('pending','unknown')
    AND updated_at<now()-interval '2 minutes' ORDER BY updated_at LIMIT 5`);
  for (const row of rows) {
    try { await reconcileLabel(row.order_id); }
    catch { console.error("Could not reconcile shipment",row.order_id); }
  }
}
