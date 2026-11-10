import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { Client } from "pg";
import { database } from "../lib/db";
import { applyCheckout, reserve } from "../lib/orders";
import { applyTracking, buyLabel, quote, reconcileLabel } from "../lib/shippo";
import { publicOrder, shipmentStage } from "../lib/order-view";
import { runEmailJobs } from "../lib/email";

const url=process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname!=="/dubbclub_test") throw new Error("Set TEST_DATABASE_URL to an empty dubbclub_test database.");
const schemaName=`commerce_${randomUUID().replaceAll("-","")}`;
const isolated=new URL(url);
isolated.searchParams.set("options",`-c search_path=${schemaName}`);
process.env.DATABASE_URL=isolated.href;
const control=new Client({connectionString:url});
process.env.FLAT_SHIPPING_CENTS="850";
process.env.SHIPPO_API_TOKEN="shippo_test_mock";
process.env.SHIPPO_FROM_ADDRESS_JSON=JSON.stringify({name:"Test sender",street1:"1 Test Lane",city:"Columbus",state:"OH",zip:"43215",country:"US"});
const pg=database();
const variant="test-hoodie:M";
const items=[{id:variant,quantity:1}];

before(async()=>{
  await control.connect();
  await control.query(`CREATE SCHEMA ${schemaName}`);
  await pg.query(await readFile(new URL("../scripts/schema.sql",import.meta.url),"utf8"));
  await pg.query(`INSERT INTO products(slug,position,name,category,color,image,description,fit,measurements,approved,release_at)
    VALUES('test-hoodie',0,'Hoodie','Tops','Onyx','/images/hoodie-black.webp','Pullover','Boxy','M chest 44 in',true,now())`);
  await pg.query("INSERT INTO variants(id,product_slug,position,size,price,stock) VALUES($1,'test-hoodie',0,'M',6500,1)",[variant]);
});
after(async()=>{
  await pg.end();
  await control.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await control.end();
});

function stripeSession(orderId:string,status:"expired"|"complete",paid:boolean) {
  return {
    id:`cs_test_${orderId}`,metadata:{order_id:orderId},client_reference_id:orderId,
    status,payment_status:paid?"paid":"unpaid",currency:"usd",amount_total:7350,
    payment_intent:`pi_test_${orderId}`,customer_details:{email:"buyer@example.test"},
    collected_information:{shipping_details:{name:"Test Buyer",address:{
      line1:"2 Test Lane",city:"Columbus",state:"OH",postal_code:"43215",country:"US"
    }}}
  } as unknown as Stripe.Checkout.Session;
}
const stock=async()=>(await pg.query("SELECT stock,reserved FROM variants WHERE id=$1",[variant])).rows[0];

test("unapproved concepts cannot reserve stock and concurrent checkouts cannot oversell",async()=>{
  await pg.query("UPDATE products SET approved=false WHERE slug='test-hoodie'");
  await assert.rejects(reserve(items,randomUUID()),/unavailable/);
  await pg.query("UPDATE products SET approved=true WHERE slug='test-hoodie'");
  const key=randomUUID();
  const [a,b]=await Promise.all([reserve(items,key),reserve(items,key)]);
  assert.equal(a.order.id,b.order.id);
  const concurrent=await Promise.allSettled([reserve(items,randomUUID()),reserve(items,randomUUID())]);
  assert.ok(concurrent.every(result=>result.status==="rejected"));
  assert.deepEqual(await stock(),{stock:1,reserved:1});
  await applyCheckout(stripeSession(a.order.id,"expired",false),"expiry-1");
  await applyCheckout(stripeSession(a.order.id,"expired",false),"expiry-2");
  assert.deepEqual(await stock(),{stock:1,reserved:0});
});

test("payment commits once, Shippo uncertainty cannot double-buy, and tracking emails are queued once",async()=>{
  const winner=await Promise.allSettled([reserve(items,randomUUID()),reserve(items,randomUUID())]);
  const success=winner.find(r=>r.status==="fulfilled");
  assert.ok(success&&success.status==="fulfilled");
  assert.equal(winner.filter(r=>r.status==="fulfilled").length,1);
  const {order}=success.value;
  await applyCheckout(stripeSession(order.id,"complete",false),"payment-pending");
  assert.deepEqual(await stock(),{stock:1,reserved:1});
  const session=stripeSession(order.id,"complete",true);
  await Promise.all([applyCheckout(session,"paid-1"),applyCheckout(session,"paid-1"),applyCheckout(session,"paid-2")]);
  assert.deepEqual(await stock(),{stock:0,reserved:0});
  assert.equal((await publicOrder(order.access_token))?.total_cents,7350);
  assert.equal(await publicOrder("0".repeat(64)),null);
  const originalFetch=globalThis.fetch;
  let purchaseCount=0;
  let attemptId="";
  globalThis.fetch=async(url,init)=>{
    const path=new URL(String(url)).pathname;
    if (path==="/shipments/") return Response.json({rates:[
      {object_id:"rate-test",provider:"USPS",servicelevel:{name:"Ground Advantage"},amount:"8.50",currency:"USD"}]});
    if (path==="/transactions/" && init?.method==="POST") {
      purchaseCount++;attemptId=JSON.parse(String(init.body)).metadata;
      throw new Error("Provider response timed out after purchase.");
    }
    if (path==="/transactions/") return Response.json({next:null,results:[{
      object_id:"transaction-test",metadata:attemptId,status:"SUCCESS",label_url:"https://example.test/test-label",
      tracking_number:"9400TEST",tracking_url_provider:"https://example.test/tracking"
    }]});
    throw new Error("Unexpected request");
  };
  try {
    const [rate]=await quote(order.id,{length:13,width:10,height:3,weight:1.8});
    assert.equal(rate.cents,850);
    await assert.rejects(buyLabel(order.id,rate.id),/unclear/);
    await assert.rejects(buyLabel(order.id,rate.id),/already exists/);
    assert.equal(await reconcileLabel(order.id),"purchased");
    assert.equal(purchaseCount,1);
    assert.equal(shipmentStage((await publicOrder(order.access_token))!),"Label ready");
  } finally {globalThis.fetch=originalFetch;}

  const scan=(status:string,date:string)=>({carrier:"usps",tracking_number:"9400TEST",tracking_status:{status,status_date:date}});
  const transit=scan("TRANSIT","2026-11-10T15:00:00Z");
  await Promise.all([applyTracking(transit),applyTracking(transit)]);
  await applyTracking(scan("DELIVERED","2026-11-11T16:00:00Z"));
  await applyTracking(transit);
  assert.equal(shipmentStage((await publicOrder(order.access_token))!),"Delivered");
  const {rows}=await pg.query("SELECT kind FROM email_jobs ORDER BY kind");
  assert.deepEqual(rows.map(r=>r.kind),["delivered","paid-customer","paid-owner","shipped"]);
});

test("the Resend worker sends each queued notification once",async()=>{
  process.env.RESEND_API_KEY="test_resend_key";
  process.env.RESEND_FROM="orders@example.test";
  process.env.OWNER_EMAIL="owner@example.test";
  process.env.APP_URL="https://dubbclub.example.test";
  const originalFetch=globalThis.fetch;
  const messages=new Map<string,{subject:string;html:string;text:string}>();
  globalThis.fetch=async(url,init)=>{
    assert.equal(new URL(String(url)).pathname,"/emails");
    const key=new Headers(init?.headers).get("idempotency-key");
    assert.ok(key);
    assert.equal(messages.has(key),false);
    const message=JSON.parse(String(init?.body));
    messages.set(key,message);
    return Response.json({id:key});
  };
  try {
    await Promise.all([runEmailJobs(),runEmailJobs()]);
    await runEmailJobs();
    assert.equal(messages.size,4);
    assert.ok([...messages.values()].some(message=>message.subject.startsWith("On its way")&&message.text.includes("/order/")));
    assert.ok([...messages.values()].some(message=>message.subject.startsWith("Order confirmed")&&message.html.includes("hoodie-black.webp")));
    assert.equal((await pg.query("SELECT count(*)::int AS n FROM email_jobs WHERE sent_at IS NOT NULL")).rows[0].n,4);
  } finally {globalThis.fetch=originalFetch;}
});
