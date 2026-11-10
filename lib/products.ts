import { cache } from "react";
import { database } from "./db";
import { previewCatalog, type Product } from "./catalog";
export const getCatalog = cache(async ():Promise<Product[]> => {
  if (!process.env.DATABASE_URL) return previewCatalog;
  const {rows} = await database().query<Omit<Product,"releaseAt"> & {releaseAt:Date|null}>(`
    SELECT p.slug,p.name,p.category,p.color,p.image,p.description,p.fit,p.measurements,p.approved,
      p.release_at AS "releaseAt",
      json_agg(json_build_object('id',v.id,'size',v.size,'price',v.price,'available',v.stock-v.reserved)
        ORDER BY v.position) AS variants
    FROM products p JOIN variants v ON v.product_slug=p.slug
    GROUP BY p.slug ORDER BY p.position`);
  return rows.map(row=>({...row,releaseAt:row.releaseAt?.toISOString()??null}));
});
