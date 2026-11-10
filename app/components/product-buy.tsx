"use client";
import {useState} from "react";
import Link from "next/link";
import {money,type Variant} from "@/lib/catalog";
import {readBag,updateBag} from "./bag-store";
import {Arrow,BagIcon} from "./icons";

export function ProductBuy({variants,enabled}:{variants:Variant[];enabled:boolean}) {
  const [id,setId]=useState("");
  const [added,setAdded]=useState(false);
  const [notice,setNotice]=useState("");
  const selected=variants.find(v=>v.id===id);
  const prices=variants.flatMap(v=>v.price===null?[]:[v.price]);
  function add() {
    if (!selected||selected.available<1||!enabled) return;
    const count=readBag(localStorage.getItem("dubbclub-bag-v1")??"[]").find(v=>v.id===id)?.quantity??0;
    if (count>=Math.min(20,selected.available)) {setNotice("You’ve already added the available quantity.");return;}
    updateBag(items=>items.some(item=>item.id===id)?items.map(item=>item.id===id?{...item,quantity:item.quantity+1}:item):[...items,{id,quantity:1}]);
    setAdded(true);setNotice("");
  }
  return <div className="purchase">
    {!!prices.length&&<p className="product-price">{money(selected?.price??Math.min(...prices))}</p>}
    <fieldset className="sizes"><legend>Size</legend>
      {variants.filter(v=>v.price!==null).map(v=><button type="button" key={v.id} disabled={!v.available} aria-pressed={id===v.id} onClick={()=>{setId(v.id);setAdded(false);setNotice("");}}>{v.size}</button>)}
    </fieldset>
    {added?<Link className="button dark full" href="/bag">Added · View bag <Arrow/></Link>:
      <button className="button dark full" disabled={!enabled||!selected} onClick={add}>{enabled?"Add to bag":"Checkout coming soon"} <BagIcon/></button>}
    {notice&&<p className="muted" role="status">{notice}</p>}
  </div>;
}
