import { getServerSession as getNextAuthServerSession } from "next-auth/next";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user }: { token: Record<string, unknown> & { userId?: string }; user?: { id: string } | null }) {
      if (user) {
        // Persist the user id on the token at login
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: { user?: { id: string } }; token: { userId?: string } }) {
      if (session.user && token) {
        if (typeof token.userId === 'string' && token.userId) {
          session.user.id = token.userId;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
} as const;

export function getServerSession(): Promise<import("next-auth").Session | null> {
  // Casting options due to adapter typing mismatches across auth versions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getNextAuthServerSession(authOptions as any);
}


