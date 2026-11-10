export const metadata={title:"Owner dashboard",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export const dynamic="force-dynamic";
export default function AdminLayout({children}:{children:React.ReactNode}) {return <div className="admin-area">{children}</div>;}
