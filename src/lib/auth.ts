import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/db";
import { authConfig } from "./auth.config";
import {
  adminEmailApprovalRequired,
  consumeApprovedLoginGrant,
  loginRequestIp,
  verifyAdminCredentials,
} from "@/lib/admin-login-approval";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        approvalGrant: { label: "Approval grant", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        const user = await verifyAdminCredentials(
          email,
          password,
          loginRequestIp(request.headers)
        );
        if (!user) return null;

        if (adminEmailApprovalRequired()) {
          const approved = await consumeApprovedLoginGrant(
            user.id,
            String(credentials.approvalGrant ?? "")
          );
          if (!approved) return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
        };
      },
    }),
  ],
});
