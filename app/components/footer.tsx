import Link from "next/link";
import {UpRight} from "./icons";
export function Footer() {
  return <footer className="footer">
    <div className="footer-main wrap">
      <Link href="/" aria-label="DUBBCLUB home"><img src="/wordmark.svg" width="155" height="32" alt="dubbclub"/></Link>
      <div className="footer-links"><Link href="/shop">Shop</Link><Link href="/coming-soon">Coming soon</Link><Link href="/about">About</Link>
      <Link href="/info/shipping">Shipping</Link><Link href="/info/returns">Returns</Link><Link href="/info/privacy">Privacy</Link>
      <Link href="/info/contact">Contact <UpRight width={13} height={13}/></Link></div>
    </div>
    <div className="footer-base wrap"><span>© {new Date().getFullYear()} DUBBCLUB</span></div>
  </footer>;
}
