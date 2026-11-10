import "./load-env";
import { database } from "../lib/db";
import { reconcileCheckouts } from "../lib/orders";
import { reconcileShipments } from "../lib/shippo";
import { runEmailJobs } from "../lib/email";

async function run() {
  const results=await Promise.allSettled([reconcileCheckouts(),reconcileShipments(),runEmailJobs()]);
  for (const [index,result] of results.entries()) {
    if (result.status==="rejected") { console.error("Job failed",index,result.reason?.name);process.exitCode=1; }
  }
  await database().query(`DELETE FROM owner_login_links WHERE expires_at<now();
    DELETE FROM owner_sessions WHERE expires_at<now();
    DELETE FROM request_limits WHERE resets_at<now();
    DELETE FROM shipping_quotes WHERE expires_at<now();
  `);
}
run().catch(error=>{console.error("Maintenance failed",error.name);process.exitCode=1;}).finally(()=>database().end());
