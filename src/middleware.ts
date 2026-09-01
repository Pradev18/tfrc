import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = await auth();
    if (!session?.user) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

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
  matcher: ["/admin/:path*", "/catalogue/:path*", "/product/:path*", "/offers"],
};
