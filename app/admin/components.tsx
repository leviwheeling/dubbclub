"use client";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {money,type Product} from "@/lib/catalog";
import {Arrow,UpRight} from "../components/icons";

async function send(path:string,body:object) {
  const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result=await response.json();
  if (!response.ok) throw new Error(result.error??"Request failed.");
  return result;
}
const session="/api/admin/session";
const operations="/api/admin/operations";
const reason=(error:unknown)=>error instanceof Error?error.message:"Try again shortly.";
export function SignIn({token,configured=true}:{token?:string;configured?:boolean}) {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [done,setDone]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setMessage("");
    try {
      await send(session,token?{action:"verify",token}:{action:"request",email:new FormData(event.currentTarget).get("email")});
      if (token) {router.replace("/admin");router.refresh();}
      else {setDone(true);setMessage("Check your inbox for a sign-in link.");}
    } catch(error) {setMessage(reason(error));}
    finally{setBusy(false);}
  }
  return <form className="admin-form sign-in-form" onSubmit={submit}>
    {token?<p className="muted">Continue to open the owner dashboard.</p>:<label>Owner email<input name="email" type="email" autoComplete="email" required disabled={!configured}/></label>}
    <button className="button dark" disabled={busy||done||!configured}>{busy?"Working…":token?"Open dashboard":"Email me a sign-in link"} <Arrow/></button>
    <p className="muted" aria-live="polite">{configured?message:"Owner sign-in opens after the database and sender are configured."}</p>
  </form>;
}
export function SignOut() {
  const [error,setError]=useState("");
  return <><button type="button" className="button outline" onClick={async()=>{try {await send(session,{action:"logout"});window.location.assign("/admin");}
    catch(e){setError(reason(e));}}}>Sign out</button>{error&&<span role="alert">{error}</span>}</>;
}

export type InventoryProduct=Omit<Product,"variants"> & {variants:Array<Product["variants"][number] & {stock:number;reserved:number}>};
export function InventoryEdit({product}:{product:InventoryProduct}) {
  const router=useRouter();
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [release,setRelease]=useState(product.releaseAt?new Date(product.releaseAt).toISOString().slice(0,16):"");
  const timeZone="UTC";
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setMessage("");
    const form=new FormData(event.currentTarget);
    const value=(field:string)=>String(form.get(field)??"");
    try {
      await send(operations,{action:"product",slug:product.slug,approved:form.has("approved"),
        releaseAt:release?new Date(`${release}Z`).toISOString():null,image:value("image"),
        description:value("description"),fit:value("fit"),measurements:value("measurements"),
        variants:product.variants.map(v=>({
          id:v.id,stock:Number(value(`stock:${v.id}`)),price:value(`price:${v.id}`)===""?null:Math.round(Number(value(`price:${v.id}`))*100)
        }))});
      setMessage("Saved.");router.refresh();
    } catch(error) {setMessage(reason(error));}
    finally{setBusy(false);}
  }
  return <details className="admin-panel inventory-panel">
    <summary><img src={product.image} alt="" width="52" height="62"/><span><strong>{product.name}</strong><span>{product.color} · {product.approved?"Approved":"Concept"}</span></span><span className="admin-chevron">＋</span></summary>
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid"><label>Image path or HTTPS URL<input name="image" defaultValue={product.image} required/></label>
      <label>Release time ({timeZone})<input type="datetime-local" value={release} onChange={e=>setRelease(e.target.value)}/></label></div>
      <label>Description<textarea name="description" defaultValue={product.description} required rows={2}/></label>
      <label>Fit<textarea name="fit" defaultValue={product.fit} required rows={2}/></label>
      <label>Measurements by size<textarea name="measurements" defaultValue={product.measurements} rows={3} placeholder="S — chest 42 in, length 26 in"/></label>
      <div className="variant-table"><span>Size</span><span>Price (USD)</span><span>On hand</span><span>Reserved</span>
        {product.variants.map(v=><div className="variant-line" key={v.id}><strong>{v.size}</strong>
          <input type="number" min=".50" max="10000" step=".01" name={`price:${v.id}`} defaultValue={v.price===null?"":v.price/100} aria-label={`${v.size} price`}/>
          <input type="number" min={v.reserved} max="100000" step="1" name={`stock:${v.id}`} defaultValue={v.stock} aria-label={`${v.size} on hand`} required/>
          <span>{v.reserved}</span></div>)}</div>
      <label className="checkbox"><input type="checkbox" name="approved" defaultChecked={product.approved}/> I approve this imagery, fit, and sizing for sale.</label>
      <div className="admin-save"><button className="button dark" disabled={busy}>{busy?"Saving…":"Save piece"}</button><span role="status">{message}</span></div>
    </form>
  </details>;
}
type Rate={id:string;carrier:string;service:string;cents:number;days:number|null};
export function ShipDesk({orderId,canShip,purchaseState,labelUrl,hasShippo}:{orderId:string;canShip:boolean;purchaseState:string|null;labelUrl:string|null;hasShippo:boolean}) {
  const router=useRouter();
  const [rates,setRates]=useState<Rate[]>([]);
  const [rate,setRate]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const waiting=["pending","unknown"].includes(purchaseState??"");
  async function call(body:object) {
    setBusy(true);setMessage("");
    try {return await send(operations,{...body,orderId});}
    catch(error){setMessage(reason(error));router.refresh();return null;}
    finally{setBusy(false);}
  }
  async function getRates(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setConfirm(false);setRates([]);setRate("");
    const form=new FormData(event.currentTarget);
    const parcel=Object.fromEntries(["length","width","height","weight"].map(k=>[k,Number(form.get(k))]));
    const result=await call({action:"quote",parcel});
    if (result) setRates(result.rates);
  }
  async function finish(action:"buy"|"reconcile") {
    const result=await call(action==="buy"?{action,rateId:rate}:{action});
    if (result) {
      setMessage(result.state==="purchased"?"Label purchased.":result.state==="failed"?"The label failed. Request new rates after checking the address.":"Awaiting Shippo confirmation.");
      router.refresh();setConfirm(false);setRates([]);setRate("");
    }
  }
  return <div className="admin-panel ship-desk">
    <p className="eyebrow">SHIPPO / LABELS</p><h2>Shipping desk</h2>
    {labelUrl&&<a className="button dark" href={labelUrl} target="_blank" rel="noreferrer">Open 4×6 label <UpRight/></a>}
    {waiting&&<button className="button outline" disabled={busy} onClick={()=>finish("reconcile")}>Check Shippo status</button>}
    {!labelUrl&&!waiting&&canShip&&hasShippo&&<>
      <form className="admin-form" onSubmit={getRates}>
        <div className="parcel-grid">{[["length","Length (in)"],["width","Width (in)"],["height","Height (in)"],["weight","Weight (lb)"]].map(([k,label])=>
          <label key={k}>{label}<input name={k} type="number" min=".01" step=".01" max={k==="weight"?70:100} required onChange={()=>{setRates([]);setRate("");setConfirm(false);}}/></label>)}</div>
        <button className="button outline" disabled={busy}>Compare postage <Arrow/></button>
      </form>
      {!!rates.length&&<fieldset className="rates"><legend>Shipping services</legend>
        {rates.map(r=><label key={r.id}><input type="radio" checked={rate===r.id} onChange={()=>{setRate(r.id);setConfirm(false);}}/>
          <span>{r.carrier} · {r.service}{r.days!==null&&<small>{r.days} estimated business days</small>}</span><strong>{money(r.cents)}</strong></label>)}
        <button className="button dark" disabled={!rate||busy} onClick={()=>confirm?finish("buy"):setConfirm(true)}>
          {confirm?`Confirm purchase · ${money(rates.find(r=>r.id===rate)!.cents)}`:"Buy 4×6 label"}</button>
      </fieldset>}
    </>}
    {!hasShippo&&<p className="muted">Connect Shippo and add the ship-from address to purchase labels.</p>}
    {!canShip&&!labelUrl&&!waiting&&hasShippo&&<p className="muted">Review the payment and shipping address before buying a label.</p>}
    <p className="muted" aria-live="polite">{message}</p>
  </div>;
}
