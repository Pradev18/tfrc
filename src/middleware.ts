import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/catalogue" || pathname.startsWith("/catalogue/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/product/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/offers") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/catalogue/:path*", "/product/:path*", "/offers"],
};
