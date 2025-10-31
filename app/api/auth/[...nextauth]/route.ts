import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth v4 App Router - NextAuth is callable but TypeScript doesn't recognize it
// Type assertion needed due to NextAuth's export structure
const NextAuthFn = NextAuth as unknown as (options: typeof authOptions) => {
  GET: (req: Request, context?: unknown) => Promise<Response>;
  POST: (req: Request, context?: unknown) => Promise<Response>;
};
const handler = NextAuthFn(authOptions);

export { handler as GET, handler as POST };


