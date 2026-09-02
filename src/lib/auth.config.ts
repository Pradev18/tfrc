import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);
const authSecret = process.env.AUTH_SECRET;

if (
  process.env.NODE_ENV === "production" &&
  (!authSecret ||
    authSecret.length < 32 ||
    /^(change|replace)|change-me|replace-with/i.test(authSecret))
) {
  throw new Error("AUTH_SECRET must be a unique production secret of at least 32 characters");
}

/** Edge-safe auth config — no Prisma/bcrypt (used by middleware). */
export const authConfig = {
  pages: { signIn: "/admin/login" },
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return new URL(url, baseUrl).toString();
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        /* fall through to the safe admin destination */
      }
      return new URL("/admin", baseUrl).toString();
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isAdmin =
        pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
      const isLogin = pathname.startsWith("/admin/login");

      if (isLogin && auth?.user) {
        const roles = (auth.user as { roles?: string[] }).roles ?? [];
        if (roles.some((role) => ADMIN_ROLES.has(role))) {
          return NextResponse.redirect(new URL("/admin", request.url));
        }
      }

      if (isAdmin && !isLogin && !auth?.user) {
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set(
          "callbackUrl",
          `${request.nextUrl.pathname}${request.nextUrl.search}`
        );
        return NextResponse.redirect(loginUrl);
      }

      if (isAdmin && !isLogin && auth?.user) {
        const roles = (auth.user as { roles?: string[] }).roles ?? [];
        if (!roles.some((role) => ADMIN_ROLES.has(role))) {
          return new NextResponse("Forbidden", {
            status: 403,
            headers: { "Cache-Control": "no-store" },
          });
        }
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.roles = (user as { roles?: string[] }).roles ?? [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { roles?: string[] }).roles = (token.roles as string[]) ?? [];
      }
      return session;
    },
  },
  secret: authSecret,
} satisfies NextAuthConfig;
