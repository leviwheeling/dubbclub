import {notFound} from "next/navigation";
import {supportEmail} from "@/lib/settings";
export const dynamic="force-dynamic";
const policies:Record<string,{title:string;env:string}> = {
  shipping:{title:"Shipping",env:"SHIPPING_POLICY"},
  returns:{title:"Returns",env:"RETURN_POLICY"},
  privacy:{title:"Privacy",env:"PRIVACY_POLICY"},
  contact:{title:"Contact",env:""}
};
export default async function Info({params}:{params:Promise<{page:string}>}) {
  const {page}=await params;
  const policy=policies[page];
  if (!policy) notFound();
  return <section className="wrap small-page"><p className="eyebrow">DUBBCLUB / HELP</p><h1>{policy.title}.</h1>
    {page!=="contact"&&<p className="intro preline">{process.env[policy.env]||"Full details will be available when the store opens."}</p>}
    {supportEmail?<p>Questions? <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>:page==="contact"?<p className="intro">Contact details will be available at launch.</p>:null}
  </section>;
}
