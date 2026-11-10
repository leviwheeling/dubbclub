import {getCatalog} from "@/lib/products";
import {checkoutReady,shippingCents} from "@/lib/settings";
import {Bag} from "../components/bag";
export const dynamic="force-dynamic";
export const metadata={title:"Bag",robots:{index:false}};
export default async function BagPage() {
  return <section className="wrap collection-page"><p className="eyebrow">DUBBCLUB / CHECKOUT</p><h1>Your bag.</h1>
    <Bag products={await getCatalog()} shipping={shippingCents()} enabled={checkoutReady()}/></section>;
}
