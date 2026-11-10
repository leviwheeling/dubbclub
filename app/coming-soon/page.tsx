import {getCatalog} from "@/lib/products";
import {isReleased} from "@/lib/catalog";
import {CatalogGrid} from "../components/catalog-grid";
import {Signup} from "../components/signup";
export const dynamic="force-dynamic";
export const metadata={title:"Coming soon"};
export default async function ComingSoon() {
  const products=(await getCatalog()).filter(p=>!isReleased(p));
  return <><section className="wrap collection-page">
    <h1>Coming soon.</h1>
    <p className="intro">A first look at pieces in development. Join the drop list for release dates.</p>
    <CatalogGrid products={products}/>
  </section><Signup/></>;
}
