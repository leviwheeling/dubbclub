"use client";
import {useSyncExternalStore} from "react";
import type {CartItem} from "@/lib/orders";
const key="dubbclub-bag-v1";
const updateEvent="dubbclub:bag";
const subscribe=(callback:()=>void)=>{
  window.addEventListener("storage",callback);window.addEventListener(updateEvent,callback);
  return ()=>{window.removeEventListener("storage",callback);window.removeEventListener(updateEvent,callback);};
};
const get=()=>localStorage.getItem(key)??"[]";
export function readBag(raw:string):CartItem[] {
  try {const data=JSON.parse(raw);return Array.isArray(data)?data.filter(i=>typeof i?.id==="string"&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=20):[];}
  catch{return [];}
}
export const useBag=()=>readBag(useSyncExternalStore(subscribe,get,()=>"[]"));
export function updateBag(fn:(items:CartItem[])=>CartItem[]) {
  localStorage.setItem(key,JSON.stringify(fn(readBag(get()))));
  window.dispatchEvent(new Event(updateEvent));
}
