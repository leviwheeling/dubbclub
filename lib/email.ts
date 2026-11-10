import { Resend } from "resend";
import { money } from "./catalog";
import { database } from "./db";
import { storeUrl, supportEmail } from "./settings";
import type { EmailKind } from "./outbox";

export function ownerEmail() { return process.env.OWNER_EMAIL?.trim().toLowerCase(); }
function sender() {
  const from=process.env.RESEND_FROM;
  if (!from) throw new Error("Resend sender is missing.");
  return `dubbclub <${from}>`;
}
function api() {
  if (!process.env.RESEND_API_KEY) throw new Error("Resend is not configured.");
  return new Resend(process.env.RESEND_API_KEY);
}
const escape=(text:unknown)=>String(text??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
function template(title:string, body:string, href:string, cta:string, details="", eyebrow="DUBBCLUB / ORDER DESK") {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f3f1ee;color:#171714;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 12px" align="center">
  <table role="presentation" width="600" style="width:100%;max-width:600px;background:white" cellspacing="0" cellpadding="0">
  <tr><td style="padding:30px 32px;border-bottom:1px solid #dedbd5">
  <img src="${escape(storeUrl())}/wordmark.png" width="108" alt="dubbclub" style="display:block;width:108px;height:auto"></td></tr>
  <tr><td style="padding:36px 32px">
  <p style="font-size:11px;letter-spacing:2px;color:#5b584f;margin:0 0 16px">${escape(eyebrow)}</p>
  <h1 style="font-size:36px;line-height:1.06;letter-spacing:-1.8px;margin:0 0 16px">${escape(title)}</h1>
  <p style="font-size:16px;line-height:1.55;margin:0 0 24px;color:#45443e">${escape(body)}</p>
  ${details}
  <a href="${escape(href)}" style="display:inline-block;background:#171714;color:#fff;padding:14px 23px;text-decoration:none;font-size:14px;font-weight:bold;border-radius:24px">${escape(cta)}</a>
  </td></tr><tr><td style="padding:24px 32px;background:#171714;color:#fff;font-size:12px">dubbclub &nbsp; / &nbsp; Made for the work.</td></tr>
  </table></td></tr></table></body></html>`;
}
async function send(to:string,subject:string,body:string,url:string,cta:string,key:string,details?:string,eyebrow?:string) {
  const result=await api().emails.send({
    from:sender(),to,subject,html:template(subject,body,url,cta,details,eyebrow),
    text:`${subject}\n\n${body}\n\n${cta}: ${url}`,replyTo:supportEmail
  },{idempotencyKey:key});
  if (result.error) throw new Error(result.error.name);
  return result.data.id;
}
export async function loginEmail(email:string,value:string,key:string) {
  await send(email,"Your DUBBCLUB sign-in link","Use this link to open the owner dashboard. It expires in 15 minutes.",
    `${storeUrl()}/admin/verify?token=${value}`,"Continue to dashboard",key,undefined,"DUBBCLUB / OWNER ACCESS");
}

type Job={job_key:string;kind:EmailKind;payload:{orderId?:string;amount?:number;email?:string};attempts:number};
async function addSubscriber(email:string) {
  const segmentId=process.env.RESEND_DROPS_SEGMENT_ID!;
  const resend=api();
  const current=await resend.contacts.get({email});
  if (current.data) {
    if (current.data.unsubscribed) return current.data.id;
    const updated=await resend.contacts.segments.add({email,segmentId});
    if (updated.error && updated.error.statusCode!==409) throw new Error(updated.error.name);
    return current.data.id;
  }
  if (current.error.statusCode!==404) throw new Error(current.error.name);
  const created=await resend.contacts.create({email,segments:[{id:segmentId}]});
  if (created.error) throw new Error(created.error.name);
  return created.data.id;
}
async function sendOrderJob(job:Job) {
  const {rows:[order]}=await database().query(`SELECT o.id,o.email,o.access_token,o.total_cents,s.carrier,s.tracking
    FROM orders o LEFT JOIN shipments s ON s.order_id=o.id WHERE o.id=$1`,[job.payload.orderId]);
  if (!order) throw new Error("MissingOrder");
  const number=order.id.slice(0,8).toUpperCase();
  const trackingPage=`${storeUrl()}/order/${order.access_token}`;
  const admin=`${storeUrl()}/admin/orders/${order.id}`;
  const orderTotal=order.total_cents===null?"":money(order.total_cents);
  const tracking=[order.carrier,order.tracking].filter(Boolean).join(" · ");
  const details=tracking?`<p style="border-top:1px solid #dedbd5;padding-top:12px;margin-bottom:22px;font-size:13px">${escape(tracking)}</p>`:"";
  const kind=job.kind;
  if (kind==="paid-owner" || kind==="exception") {
    const to=ownerEmail();
    if (!to) throw new Error("MissingOwner");
    return send(to,kind==="paid-owner"?`New order · ${number}`:`Shipment needs attention · ${number}`,
      kind==="paid-owner"?`A paid order for ${orderTotal} is ready to review and pack.`:"The carrier flagged this package. Check its latest status in the shipping desk.",
      admin,"Open order",job.job_key,details);
  }
  if (!order.email) throw new Error("MissingRecipient");
  if (kind==="paid-customer") {
    const {rows}=await database().query("SELECT name,color,size,quantity,image FROM order_items WHERE order_id=$1 ORDER BY variant_id",[order.id]);
    const items=rows.map(item=>`<tr><td style="padding:10px 12px 10px 0" width="64">
      <img src="${escape(new URL(item.image,storeUrl()).href)}" alt="" width="58" style="display:block;width:58px"></td>
      <td style="font-size:14px"><strong>${escape(item.name)}</strong><br><span style="color:#67645d">${escape(item.color)} / ${escape(item.size)} · Qty ${item.quantity}</span></td></tr>`).join("");
    return send(order.email,`Order confirmed · ${number}`,`Your order is in. We’ll send another note when it’s with the carrier.`,
      trackingPage,"View your order",job.job_key,`<table role="presentation" style="margin-bottom:22px">${items}</table>`);
  }
  if (kind==="shipped") return send(order.email,`On its way · ${number}`,"Your DUBBCLUB order is with the carrier.",
    trackingPage,"Track your order",job.job_key,details);
  if (kind==="delivered") return send(order.email,`Delivered · ${number}`,"The carrier marked your DUBBCLUB order as delivered.",
    trackingPage,"View your order",job.job_key,details);
  return send(order.email,`Refund issued · ${number}`,`We issued a refund of ${money(job.payload.amount!)} to your original payment method.`,
    trackingPage,"View your order",job.job_key);
}

export async function runEmailJobs() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return;
  for (let i=0;i<25;i++) {
    const {rows:[job]}=await database().query<Job>(`
      WITH candidate AS (SELECT job_key FROM email_jobs WHERE sent_at IS NULL AND failed_at IS NULL AND available_at<=now()
        AND (kind<>'subscriber' OR $1) ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED)
      UPDATE email_jobs j SET attempts=attempts+1,first_attempt=COALESCE(first_attempt,now()),
        available_at=now()+interval '10 minutes' FROM candidate WHERE j.job_key=candidate.job_key
        AND (j.first_attempt IS NULL OR j.first_attempt>now()-interval '23 hours') RETURNING j.*`,
    [!!process.env.RESEND_DROPS_SEGMENT_ID]);
    if (!job) {
      await database().query(`UPDATE email_jobs SET failed_at=now(),last_error='Needs delivery review'
        WHERE sent_at IS NULL AND failed_at IS NULL AND first_attempt<=now()-interval '23 hours'`);
      return;
    }
    try {
      const id=job.kind==="subscriber"?await addSubscriber(job.payload.email!):await sendOrderJob(job);
      await database().query("UPDATE email_jobs SET sent_at=now(),provider_id=$2,last_error=NULL WHERE job_key=$1",[job.job_key,id]);
    } catch(error) {
      const reason=error instanceof Error?error.message.slice(0,80):"DeliveryError";
      await database().query(`UPDATE email_jobs SET last_error=$2,
        available_at=now()+$3*interval '1 minute',failed_at=CASE WHEN attempts>=7 THEN now() ELSE NULL END WHERE job_key=$1`,
      [job.job_key,reason,Math.min(120,2**job.attempts)]);
    }
  }
}
