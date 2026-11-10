import Link from "next/link";
import {ownerSession} from "@/lib/auth";
import {ownerEmail} from "@/lib/email";
import {ownerOrders,shipmentStage} from "@/lib/order-view";
import {money} from "@/lib/catalog";
import {SignIn,SignOut} from "./components";
import {Arrow} from "../components/icons";

const states=["All","Ready to ship","Label ready","In transit","Delivered","Needs attention","Refunded"];
export default async function Admin({searchParams}:{searchParams:Promise<{view?:string}>}) {
  if (!await ownerSession()) return <section className="wrap small-page"><p className="eyebrow">DUBBCLUB / OWNER ACCESS</p>
    <h1>Owner sign-in.</h1><SignIn configured={!!(process.env.DATABASE_URL&&ownerEmail()&&process.env.RESEND_API_KEY&&process.env.RESEND_FROM)}/></section>;
  const [orders,{view}]=await Promise.all([ownerOrders(),searchParams]);
  const selected=states.includes(view??"")?view:"All";
  const display=selected==="All"?orders:orders.filter(order=>shipmentStage(order)===selected);
  return <section className="wrap admin-page">
    <p className="eyebrow">DUBBCLUB / OPERATIONS</p><div className="admin-heading"><h1>Orders.</h1><div><Link href="/admin/catalog" className="button dark">Inventory <Arrow/></Link><SignOut/></div></div>
    <p className="intro">Review payments, buy labels, and track shipments.</p>
    <nav className="tabs admin-tabs" aria-label="Order status">{states.map(state=><Link key={state} href={state==="All"?"/admin":`/admin?view=${encodeURIComponent(state)}`} aria-current={selected===state?"page":undefined}>{state}</Link>)}</nav>
    <div className="admin-panel order-table">
      {display.length?<><div className="order-head"><span>Order</span><span>Customer</span><span>Status</span><span>Total</span></div>
      {display.map(order=><Link className="order-table-row" href={`/admin/orders/${order.id}`} key={order.id}>
        <strong>#{order.id.slice(0,8).toUpperCase()}</strong><span>{order.email??"No email"}</span>
        <span className="order-status">{shipmentStage(order)}</span>
        <span>{order.total_cents===null?"—":money(order.total_cents)}</span></Link>)}</>:<p className="admin-empty">No orders in this view.</p>}
    </div>
  </section>;
}
