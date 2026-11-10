"use client";
import Link from "next/link";
import Image from "next/image";
import {useState} from "react";
import {isReleased,money,type Product} from "@/lib/catalog";
import {SearchIcon,UpRight} from "./icons";
export function ProductCard({product,eager=false}:{product:Product;eager?:boolean}) {
  const live=isReleased(product);
  const prices=product.variants.flatMap(v=>v.price===null?[]:[v.price]);
  const status=live?(product.variants.some(v=>v.available>0&&v.price!==null)?(prices.length?money(Math.min(...prices)):""):"Sold out"):"Coming soon";
  return <Link className="product-card" href={`/products/${product.slug}`}>
    <div className="product-image">
      <Image src={product.image} alt={`${product.name} in ${product.color}`} fill loading={eager?"eager":"lazy"} sizes="(max-width: 760px) 48vw, 33vw" unoptimized={product.image.startsWith("https://")}/>
      {live?<span className="card-arrow"><UpRight width={17} height={17}/></span>:
        <span className="image-label">Coming soon <UpRight width={13} height={13}/></span>}
    </div>
    <div className="product-meta"><div><h3>{product.name}</h3><p>{product.color}</p></div><span>{live?status:product.category}</span></div>
  </Link>;
}
export function CatalogGrid({products,startSearch=false}:{products:Product[];startSearch?:boolean}) {
  const [category,setCategory]=useState("All");
  const [search,setSearch]=useState("");
  const [searching,setSearching]=useState(startSearch);
  const result=products.filter(p=>(category==="All"||p.category===category)&&
    `${p.name} ${p.color} ${p.category}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <>
    <div className="catalog-tools">
      <div className="tabs" aria-label="Filter by category">{["All","Tops","Bottoms","Accessories"].map(item=><button key={item} aria-pressed={category===item} onClick={()=>setCategory(item)}>{item}</button>)}</div>
      <div className="catalog-search">{searching?<label><span className="sr-only">Search pieces</span><input type="search" placeholder="Search pieces" value={search} onChange={e=>setSearch(e.target.value)} autoFocus/></label>:null}
        <button className="icon-button" aria-expanded={searching} aria-label="Toggle search" onClick={()=>{setSearching(!searching);setSearch("");}}><SearchIcon/></button></div>
    </div>
    <p className="results eyebrow" aria-live="polite">{String(result.length).padStart(2,"0")} {result.length===1?"PIECE":"PIECES"}</p>
    <div className="product-grid">{result.map((product,index)=><ProductCard key={product.slug} product={product} eager={index<3}/>)}</div>
    {!result.length&&<p className="empty-state">No pieces match that search.</p>}
  </>;
}
