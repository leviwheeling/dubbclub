import type {Metadata} from "next";
import {Header} from "./components/header";
import {Footer} from "./components/footer";
import "./globals.css";

export const metadata:Metadata={
  title:{default:"DUBBCLUB | Made for the work",template:"%s | DUBBCLUB"},
  description:"DUBBCLUB activewear. Explore the collection and get first notice of new releases.",
  icons:{icon:"/icon.svg"}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>
    <Header/><main id="main">{children}</main><Footer/>
  </body></html>;
}
