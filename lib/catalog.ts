export type Category = "Tops" | "Bottoms" | "Accessories";
export type Product = {
  slug: string; name: string; category: Category; color: string; image: string;
  description: string; fit: string; measurements: string; approved: boolean; releaseAt: string | null;
  variants: Variant[];
};
export type Variant = { id: string; size: string; price: number | null; available: number };
type Concept = Pick<Product, "slug" | "name" | "category" | "color" | "description" | "fit"> & { sizes: string[] };
const standard = ["XS", "S", "M", "L", "XL", "2XL"];
const concepts: Concept[] = [
  { slug:"hoodie-black", name:"Club Hoodie", category:"Tops", color:"Onyx", description:"An oversized pullover with a clean hood, dropped shoulders, and a small chest mark.", fit:"Relaxed and boxy.", sizes:standard },
  { slug:"tank-white", name:"Form Tank", category:"Tops", color:"Chalk", description:"A fitted scoop-neck tank with curved panel seams and a small mark at the hem.", fit:"Close to the body.", sizes:standard },
  { slug:"wide-leg-sweats", name:"Club Wide-Leg Sweatpant", category:"Bottoms", color:"Onyx", description:"A roomy fleece sweatpant with a full-length leg and an easy drawstring waist.", fit:"Loose through the leg.", sizes:standard },
  { slug:"hoodie-white", name:"Club Hoodie", category:"Tops", color:"Chalk", description:"The Club Hoodie in white with a black chest mark.", fit:"Relaxed and boxy.", sizes:standard },
  { slug:"tank-black", name:"Form Tank", category:"Tops", color:"Onyx", description:"The fitted Form Tank in black with white lettering.", fit:"Close to the body.", sizes:standard },
  { slug:"pump-cover", name:"Oversized Pump Cover", category:"Tops", color:"Chalk", description:"An oversized crewneck tee with dropped shoulders and a small left-chest mark.", fit:"Oversized.", sizes:standard },
  { slug:"leggings", name:"Form Legging", category:"Bottoms", color:"Onyx", description:"A full-length legging with a wide, high-rise waistband.", fit:"High rise, close fit.", sizes:standard },
  { slug:"training-pants", name:"Training Pant", category:"Bottoms", color:"Onyx", description:"A tapered training pant with articulated knees and zip pockets.", fit:"Tapered leg.", sizes:standard },
  { slug:"headband", name:"Training Headband", category:"Accessories", color:"Onyx", description:"A wide training headband with a centered wordmark.", fit:"One size concept.", sizes:["One size"] },
  { slug:"gloves", name:"Training Gloves", category:"Accessories", color:"Onyx", description:"Fingerless training gloves with textured palms and a close wrist closure.", fit:"Adjustable wrist.", sizes:["S","M","L","XL"] },
  { slug:"socks", name:"Club Crew Sock", category:"Accessories", color:"Chalk", description:"A ribbed white crew sock with a small black cuff mark.", fit:"Crew length.", sizes:["S/M","L/XL"] }
];
export const previewCatalog: Product[] = concepts.map(({sizes, ...item}) => ({
  ...item, image: `/images/${item.slug}.webp`, approved:false, releaseAt:null, measurements:"",
  variants:sizes.map(size=>({id:`${item.slug}:${size}`, size, price:null, available:0}))
}));
export function isReleased(product: Product, now = Date.now()) {
  return product.approved && !!product.measurements.trim() && !!product.releaseAt &&
    Date.parse(product.releaseAt) <= now && product.variants.some(v=>v.price !== null);
}
export function money(cents: number) {
  return new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(cents / 100);
}
