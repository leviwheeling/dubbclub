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
    <p className="eyebrow">DUBBCLUB / THE COLLECTION</p><h1>Shop.</h1><p className="intro">Training layers and off-duty essentials.</p>
    <CatalogGrid products={released.length?released:products} startSearch={params.search==="1"}/>
  </section><Signup/></>;
}
