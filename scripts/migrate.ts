import "./load-env";
import { readFile } from "node:fs/promises";
import { database, transaction } from "../lib/db";
import { previewCatalog } from "../lib/catalog";

async function migrate() {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(11092026)");
    await client.query(schema);
    for (const [position,p] of previewCatalog.entries()) {
      await client.query(`INSERT INTO products(slug,position,name,category,color,image,description,fit)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [p.slug,position,p.name,p.category,p.color,p.image,p.description,p.fit]);
      for (const [index,v] of p.variants.entries())
        await client.query("INSERT INTO variants(id,product_slug,position,size) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [v.id,p.slug,index,v.size]);
    }
  });
  console.log("DUBBCLUB schema and catalog ready.");
}
migrate().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>database().end());
