import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";
import {getCatalog} from "@/lib/products";
import {isReleased} from "@/lib/catalog";
import {checkoutReady,shippingCents} from "@/lib/settings";
import {money} from "@/lib/catalog";
import {ProductBuy} from "../../components/product-buy";
import {Arrow} from "../../components/icons";
import {Signup} from "../../components/signup";
export const dynamic="force-dynamic";
export default async function ProductPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const catalog=await getCatalog();
  const product=catalog.find(p=>p.slug===slug);
  if (!product) notFound();
  const live=isReleased(product);
  const colors=catalog.filter(p=>p.name===product.name);
  const price=shippingCents();
  return <>
    <div className="wrap product-page">
      <p className="breadcrumb"><Link href="/shop">Shop</Link> / {product.name}</p>
      <div className="product-layout">
        <div className="product-detail-image"><Image src={product.image} alt={`${product.name} in ${product.color}`} fill fetchPriority="high" sizes="(max-width: 760px) 100vw, 58vw" unoptimized={product.image.startsWith("https://")}/></div>
        <div className="product-info"><p className="eyebrow">{live?"THE COLLECTION":"COMING SOON / CONCEPT PREVIEW"}</p><h1>{product.name}</h1><p className="product-description">{product.description}</p>
          <p className="color-name">Color <strong>{product.color}</strong></p>
          {colors.length>1&&<div className="swatches" aria-label="Color options">{colors.map(color=><Link key={color.slug} href={`/products/${color.slug}`} className={color.color==="Chalk"?"swatch chalk":"swatch onyx"} aria-label={color.color} aria-current={color.slug===slug?"page":undefined}/>)}</div>}
          {live?<ProductBuy variants={product.variants} enabled={checkoutReady()}/>:<Link href="#drop-list" className="button dark full">Notify me about the drop <Arrow/></Link>}
          <details open><summary>Fit &amp; measurements</summary><p>{product.fit}</p><p className="preline">{live?product.measurements:"Size measurements will be available when this piece is released."}</p></details>
          <details><summary>Shipping &amp; returns</summary><p>{price!==null?`Flat U.S. shipping is ${money(price)}.`:"U.S. shipping. Rates will be available at launch."} <Link href="/info/shipping">Shipping details</Link> · <Link href="/info/returns">Returns</Link></p></details>
        </div>
      </div>
    </div>
    <Signup/>
  </>;
}
