import {NextRequest,NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
export function proxy(request:NextRequest) {
  const password=process.env.STORE_PREVIEW_PASSWORD;
  if (process.env.STORE_PUBLIC==="true" || (!password && process.env.RENDER!=="true")) return NextResponse.next();
  if (!password) return new NextResponse("Private preview is awaiting configuration.",{status:503});
  const expected=Buffer.from(`Basic ${Buffer.from(`dubbclub:${password}`).toString("base64")}`);
  const supplied=Buffer.from(request.headers.get("authorization")??"");
  if (expected.length===supplied.length && timingSafeEqual(expected,supplied)) {
    const response=NextResponse.next();
    response.headers.set("X-Robots-Tag","noindex, nofollow");
    response.headers.set("Cache-Control","private, no-store");
    return response;
  }
  return new NextResponse("DUBBCLUB private preview.",{status:401,headers:{"WWW-Authenticate":'Basic realm="DUBBCLUB preview"', "X-Robots-Tag":"noindex, nofollow"}});
}
export const config={matcher:["/((?!api/webhooks/|api/health|_next/static|_next/image|favicon.ico).*)"]};
