import Link from "next/link";
import {isReleased} from "@/lib/catalog";
import {getCatalog} from "@/lib/products";
import {CatalogGrid} from "../components/catalog-grid";
import {Signup} from "../components/signup";
export const dynamic="force-dynamic";
export const metadata={title:"Shop"};
export default async function Shop({searchParams}:{searchParams:Promise<{search?:string}>}) {
  const [products,params]=await Promise.all([getCatalog(),searchParams]);
  const released=products.filter(p=>isReleased(p));
  return <><section className="wrap collection-page">
    <h1>Shop.</h1>
    {released.length ? <CatalogGrid products={released} startSearch={params.search==="1"}/> :
      <div className="empty-state"><p>The shop is not open yet.</p><Link className="text-link" href="/coming-soon">See what’s coming →</Link></div>}
  </section><Signup/></>;
}
