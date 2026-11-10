import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { database } from "./db";
import { HttpError } from "./http";
import { storeUrl } from "./settings";

export const token = () => randomBytes(32).toString("hex");
export const hash = (value:string) => createHash("sha256").update(value).digest("hex");
export const equal = (a:string,b:string) => timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
export function sameOrigin(request:Request) {
  if (request.headers.get("origin") !== storeUrl()) throw new HttpError(403,"Request origin is not allowed.");
}
export function rateKey(request:Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return hash(forwarded || request.headers.get("x-real-ip") || "local");
}
export async function rateLimit(key:string, max:number, minutes:number) {
  const {rows:[row]} = await database().query(`
    INSERT INTO request_limits(key,hits,resets_at) VALUES($1,1,now()+$2*interval '1 minute')
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN request_limits.resets_at<=now() THEN 1 ELSE request_limits.hits+1 END,
      resets_at=CASE WHEN request_limits.resets_at<=now() THEN EXCLUDED.resets_at ELSE request_limits.resets_at END
    RETURNING hits`,[key,minutes]);
  if (row.hits > max) throw new HttpError(429,"Too many attempts. Try again later.");
}
