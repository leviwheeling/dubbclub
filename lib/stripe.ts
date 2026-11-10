import Stripe from "stripe";
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured.");
  return new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:12000,maxNetworkRetries:1});
}
