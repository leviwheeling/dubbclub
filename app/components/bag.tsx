"use client";
import Link from "next/link";
import {useState} from "react";
import type {Product} from "@/lib/catalog";
import {isReleased,money} from "@/lib/catalog";
import {updateBag,useBag} from "./bag-store";
import {Arrow} from "./icons";

export function Bag({products,enabled,shipping}:{products:Product[];enabled:boolean;shipping:number|null}) {
  const bag=useBag();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const rows=bag.map(item=>{
    const product=products.find(p=>p.variants.some(v=>v.id===item.id));
    return {...item,product,variant:product?.variants.find(v=>v.id===item.id)};
  });
  const subtotal=rows.reduce((sum,i)=>sum+(i.variant?.price??0)*i.quantity,0);
  const canBuy=enabled&&rows.length>0&&rows.every(i=>i.product&&isReleased(i.product)&&i.variant?.price!=null);
  async function checkout() {
    setBusy(true);setMessage("");
    try {
      const signature=JSON.stringify(bag);
      const prior=JSON.parse(sessionStorage.getItem("dubbclub-checkout")??"null");
      const key=prior?.signature===signature?prior.key:crypto.randomUUID();
      sessionStorage.setItem("dubbclub-checkout",JSON.stringify({signature,key}));
      const result=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key,items:bag})});
      const data=await result.json();
      if (!result.ok) {
        if (result.status===409 && data.error?.includes("checkout has ended")) sessionStorage.removeItem("dubbclub-checkout");
        throw new Error(data.error);
      }
      window.location.assign(data.url);
    } catch (error) {setMessage(error instanceof Error?error.message:"Checkout could not start.");setBusy(false);}
  }
  if (!rows.length) return <div className="empty-state"><p>Your bag is empty.</p><Link className="button dark" href="/shop">Explore the drop <Arrow/></Link></div>;
  return <div className="bag-layout">
    <div>{rows.map(row=><div className="bag-row" key={row.id}>
      {row.product&&<img src={row.product.image} alt="" width="86" height="98"/>}
      <div><h2>{row.product?.name??"Unavailable piece"}</h2><p>{row.product?.color} / {row.variant?.size}</p>
        {(row.variant?.available??0)<row.quantity&&<p>Adjust quantity to continue.</p>}
        <label>Qty <select value={row.quantity} onChange={e=>updateBag(items=>items.map(i=>i.id===row.id?{...i,quantity:Number(e.target.value)}:i))}>
          {Array.from({length:Math.max(row.quantity,Math.min(20,row.variant?.available??0))},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}
        </select></label>
        <button className="link-button" onClick={()=>updateBag(items=>items.filter(i=>i.id!==row.id))}>Remove</button>
      </div><strong>{row.variant?.price!=null?money(row.variant.price*row.quantity):"—"}</strong>
    </div>)}</div>
    <aside className="summary"><h2>Order summary</h2><dl><div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
      <div><dt>Standard U.S. shipping</dt><dd>{shipping===null?"At launch":money(shipping)}</dd></div></dl>
      <p className="muted">Taxes, when applicable, appear at checkout.</p>
      <button className="button dark full" disabled={!canBuy||busy} onClick={checkout}>{busy?"Opening checkout…":enabled?"Continue to checkout":"Checkout coming soon"}<Arrow/></button>
      {message&&<p role="alert">{message}</p>}
    </aside>
  </div>;
}
