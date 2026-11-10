import Link from "next/link";
import {redirect} from "next/navigation";
import {ownerSession} from "@/lib/auth";
import {database} from "@/lib/db";
import {InventoryEdit,type InventoryProduct} from "../components";
export default async function AdminCatalog() {
  if (!await ownerSession()) redirect("/admin");
  const {rows}=await database().query<InventoryProduct>(`SELECT p.*,p.release_at AS "releaseAt",
    json_agg(json_build_object('id',v.id,'size',v.size,'price',v.price,'stock',v.stock,'available',v.stock-v.reserved,'reserved',v.reserved)
    ORDER BY v.position) AS variants FROM products p JOIN variants v ON v.product_slug=p.slug GROUP BY p.slug ORDER BY p.position`);
  return <section className="wrap admin-page">
    <p className="eyebrow"><Link href="/admin">← ORDER DESK</Link></p>
    <div className="admin-heading"><h1>Inventory.</h1></div>
    <p className="intro">Update price, stock, measurements, and release timing for each piece.</p>
    <div className="inventory-list">{rows.map(product=><InventoryEdit key={product.slug} product={product}/>)}</div>
  </section>;
}
