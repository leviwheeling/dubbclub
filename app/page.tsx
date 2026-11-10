import Link from "next/link";
import Image from "next/image";
import {getCatalog} from "@/lib/products";
import {isReleased} from "@/lib/catalog";
import {ProductCard} from "./components/catalog-grid";
import {Arrow,UpRight} from "./components/icons";
import {Signup} from "./components/signup";

export const dynamic="force-dynamic";
export default async function Home() {
  const products=await getCatalog();
  const live=products.filter(p=>isReleased(p));
  const featured=(live.length?live:products).slice(0,3);
  return <>
    <section className="hero wrap">
      <div className="hero-copy">
        <h1>Made for <br/>the work.</h1>
        <p>Comfortable essentials for training and everyday wear.</p>
        <Link className="button dark" href="/shop">Explore the collection <Arrow/></Link>
      </div>
      <div className="hero-media">
        <Image src="/images/campaign.webp" alt="Four models in black and white DUBBCLUB activewear in a concrete studio" fill loading="eager" fetchPriority="high" sizes="(max-width: 860px) 100vw, 65vw"/>
        <span className="media-caption">DUBBCLUB STUDIO</span>
        <Link className="hero-lookbook" href="/coming-soon">Coming soon <UpRight width={15} height={15}/></Link>
      </div>
    </section>
    <section className="wrap featured">
      <div className="section-head"><div><h2>First rotation.</h2></div><Link className="text-link" href="/shop">View all pieces <UpRight/></Link></div>
      <div className="product-grid">{featured.map(product=><ProductCard product={product} key={product.slug}/>)}</div>
    </section>
    <section className="wrap editorial">
      <Link href="/coming-soon" className="editorial-image"><Image src="/images/pump-cover.webp" alt="Oversized white DUBBCLUB pump-cover tee concept" fill sizes="(max-width: 700px) 95vw, 50vw"/></Link>
      <div><p className="eyebrow">IN THE WORKS</p><h2>What’s next.</h2><p>Wide legs, oversized tees, and the pieces that finish the kit.</p><Link href="/coming-soon" className="button outline">See what’s coming <Arrow/></Link></div>
    </section>
    <Signup/>
  </>;
}
