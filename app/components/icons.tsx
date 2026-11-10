import type { SVGProps } from "react";
type Props=SVGProps<SVGSVGElement>;
const defaults={width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.65,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true as const};
export const Arrow=({className,...rest}:Props)=><svg {...defaults} className={className} {...rest}><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;
export const UpRight=(props:Props)=><svg {...defaults} {...props}><path d="M6 18 18 6M8 6h10v10"/></svg>;
export const BagIcon=(props:Props)=><svg {...defaults} {...props}><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>;
export const MenuIcon=(props:Props)=><svg {...defaults} {...props}><path d="M4 8h16M4 16h16"/></svg>;
export const SearchIcon=(props:Props)=><svg {...defaults} {...props}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>;
