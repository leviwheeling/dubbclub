import Link from "next/link";
import {SignIn} from "../components";
export default async function Verify({searchParams}:{searchParams:Promise<{token?:string}>}) {
  const {token}=await searchParams;
  return <section className="wrap small-page"><p className="eyebrow">DUBBCLUB / OWNER ACCESS</p><h1>Confirm sign-in.</h1>
    {typeof token==="string"&&/^[a-f0-9]{64}$/.test(token)?<SignIn token={token}/>:<Link className="button dark" href="/admin">Request a new link</Link>}
  </section>;
}
