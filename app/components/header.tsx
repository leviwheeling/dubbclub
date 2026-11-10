"use client";
import Link from "next/link";
import {useState} from "react";
import {BagIcon, MenuIcon, SearchIcon} from "./icons";
import {useBag} from "./bag-store";

export function Header({open}:{open:boolean}) {
  const [menu,setMenu]=useState(false);
  const count=useBag().reduce((total,item)=>total+item.quantity,0);
  return <>
    <div className="top-strip"><span className="tiny-dot"/>{open?"THE SHOP IS OPEN":"DUBBCLUB / COLLECTION PREVIEW"}</div>
    <header className="site-header">
      <button className="icon-button mobile-toggle" aria-label="Menu" aria-expanded={menu} onClick={()=>setMenu(!menu)}><MenuIcon/></button>
      <Link href="/" className="brand" aria-label="DUBBCLUB home"><img src="/wordmark.svg" width="126" height="28" alt="dubbclub"/></Link>
      <nav className={`primary-nav ${menu?"nav-open":""}`} aria-label="Main navigation">
        <Link href="/shop" onClick={()=>setMenu(false)}>Shop</Link>
        <Link href="/coming-soon" onClick={()=>setMenu(false)}>Coming soon</Link>
        <Link href="/about" onClick={()=>setMenu(false)}>About</Link>
      </nav>
      <div className="nav-actions">
        <Link className="icon-button search-link" href="/shop?search=1" aria-label="Search the collection"><SearchIcon/></Link>
        <Link className="icon-button bag-icon" href="/bag" aria-label={`Bag, ${count} items`}><BagIcon/>{count>0&&<span>{count}</span>}</Link>
      </div>
    </header>
  </>;
}
