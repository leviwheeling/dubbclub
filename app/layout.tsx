import type {Metadata} from "next";
import {Header} from "./components/header";
import {Footer} from "./components/footer";
import {getCatalog} from "@/lib/products";
import {isReleased} from "@/lib/catalog";
import {checkoutReady} from "@/lib/settings";
import "./globals.css";

export const metadata:Metadata={
  title:{default:"DUBBCLUB | Made for the work",template:"%s | DUBBCLUB"},
  description:"DUBBCLUB activewear. Explore the collection and get first notice of new releases.",
  icons:{icon:"/icon.svg"}
};
export default async function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  const open=checkoutReady() && (await getCatalog()).some(p=>isReleased(p)&&p.variants.some(v=>v.price!==null&&v.available>0));
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>
    <Header open={open}/><main id="main">{children}</main><Footer/>
  </body></html>;
}
