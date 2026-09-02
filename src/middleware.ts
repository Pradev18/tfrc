import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
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
});

export const config = {
  matcher: ["/admin/:path*", "/catalogue/:path*", "/product/:path*", "/offers"],
};
