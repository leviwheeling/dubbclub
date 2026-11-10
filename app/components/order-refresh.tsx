"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {updateBag} from "./bag-store";
export function OrderRefresh({pending,complete,orderId}:{pending:boolean;complete:boolean;orderId:string}) {
  const router=useRouter();
  useEffect(()=>{
    if (complete) {
      const marker=`dubbclub-completed:${orderId}`;
      if (!sessionStorage.getItem(marker)) {
        const prior=sessionStorage.getItem("dubbclub-checkout");
        if (prior) {
          try { const data=JSON.parse(prior);updateBag(items=>JSON.stringify(items)===data.signature?[]:items); }
          catch { /* The bag stays intact when there is no matching checkout. */ }
          sessionStorage.removeItem("dubbclub-checkout");
        }
        sessionStorage.setItem(marker,"yes");
      }
    }
    if (pending) {
      let tries=0;
      const interval=setInterval(()=>{if (++tries>12) clearInterval(interval);else router.refresh();},3500);
      return ()=>clearInterval(interval);
    }
  },[router,pending,complete,orderId]);
  return null;
}
