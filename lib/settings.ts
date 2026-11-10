export const supportEmail = process.env.SUPPORT_EMAIL;
export function storeUrl() {
  const url = new URL(process.env.APP_URL ?? "http://localhost:3000");
  if (!["http:","https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid APP_URL.");
  return url.origin;
}
export function shippingCents() {
  const raw = process.env.FLAT_SHIPPING_CENTS;
  if (!raw || !/^\d{1,5}$/.test(raw)) return null;
  return Number(raw);
}
export function checkoutReady() {
  return process.env.STORE_CHECKOUT_ENABLED === "true" && shippingCents() !== null &&
    !!(process.env.DATABASE_URL && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.SHIPPO_API_TOKEN && /^[A-Za-z0-9_-]{32,}$/.test(process.env.SHIPPO_WEBHOOK_SECRET??"") && process.env.SHIPPO_FROM_ADDRESS_JSON &&
      process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.OWNER_EMAIL &&
      process.env.APP_URL && process.env.SUPPORT_EMAIL && process.env.SHIPPING_POLICY && process.env.RETURN_POLICY && process.env.PRIVACY_POLICY);
}
