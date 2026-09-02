import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { authConfig } from "./auth.config";
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from "@/lib/login-throttle";

const DUMMY_PASSWORD_HASH =
  "$2b$12$CkjYPjLSdLgyQVGmHrz08eQFNTrAHVFBc3bTDHyOhCoof/Nfjgtjm";
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        const ipAddress =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";

        if (email.length > 254 || password.length > 256) return null;
        if (await isLoginBlocked(email, ipAddress)) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { roles: { include: { role: true } } },
        });

        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        const roles = user?.roles.map((assignment) => assignment.role.name) ?? [];
        const isAdmin = roles.some((role) => ADMIN_ROLES.has(role));
        if (!user || !user.isActive || !valid || !isAdmin) {
          await recordLoginFailure(email, ipAddress);
          return null;
        }

        await Promise.all([
          clearLoginFailures(email, ipAddress),
          prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }),
        ]);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles,
        };
      },
    }),
  ],
});
