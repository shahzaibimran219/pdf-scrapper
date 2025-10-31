import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth v4 App Router - Type assertion to resolve TypeScript call signature issue
const handler = (NextAuth as unknown as (options: typeof authOptions) => {
  GET: (req: Request, context: { params: Promise<{ nextauth: string[] }> }) => Promise<Response>;
  POST: (req: Request, context: { params: Promise<{ nextauth: string[] }> }) => Promise<Response>;
})(authOptions);

// Export GET and POST handlers for Next.js App Router
export { handler as GET, handler as POST };


