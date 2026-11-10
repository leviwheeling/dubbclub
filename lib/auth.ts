import { cookies } from "next/headers";
import { database, transaction } from "./db";
import { equal, hash, token } from "./security";
import { ownerEmail, loginEmail } from "./email";
import { HttpError } from "./http";
import { storeUrl } from "./settings";

const cookieName="dubb_owner";
export async function ownerSession() {
  if (!process.env.DATABASE_URL || !ownerEmail()) return null;
  const value=(await cookies()).get(cookieName)?.value;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  const {rows:[row]}=await database().query("SELECT email FROM owner_sessions WHERE token_hash=$1 AND expires_at>now()",[hash(value)]);
  return row?.email && equal(row.email,ownerEmail()!) ? row.email as string : null;
}
export async function requireOwner() {
  if (!await ownerSession()) throw new HttpError(401,"Sign in to the owner dashboard.");
}
export async function sendOwnerLink(email:string) {
  if (!ownerEmail() || !equal(email,ownerEmail()!)) return;
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) throw new HttpError(503,"Owner email delivery is not configured.");
  const value=token();
  const digest=hash(value);
  await database().query("INSERT INTO owner_login_links VALUES($1,$2,now()+interval '15 minutes')",[digest,email]);
  await loginEmail(email,value,`owner-login:${digest}`);
}
export async function verifyOwnerLink(value:string) {
  if (!/^[a-f0-9]{64}$/.test(value) || !ownerEmail()) throw new HttpError(400,"This sign-in link is invalid or expired.");
  const secret=token();
  await transaction(async client=>{
    const {rows:[row]}=await client.query(`DELETE FROM owner_login_links
      WHERE token_hash=$1 AND email=$2 AND expires_at>now() RETURNING email`,[hash(value),ownerEmail()]);
    if (!row) throw new HttpError(400,"This sign-in link is invalid or expired.");
    await client.query("INSERT INTO owner_sessions VALUES($1,$2,now()+interval '12 hours')",[hash(secret),row.email]);
  });
  (await cookies()).set(cookieName,secret,{httpOnly:true,sameSite:"lax",secure:storeUrl().startsWith("https:"),
    path:"/",maxAge:43200});
}
export async function signOutOwner() {
  const jar=await cookies();
  const value=jar.get(cookieName)?.value;
  if (value) await database().query("DELETE FROM owner_sessions WHERE token_hash=$1",[hash(value)]);
  jar.delete(cookieName);
}
