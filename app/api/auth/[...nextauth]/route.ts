import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import type { NextRequest } from "next/server";

// NextAuth v4 App Router - NextAuth actually returns a single handler function that works for both GET and POST
// The handler automatically handles the request method internally
const handler = (NextAuth as unknown as (
  options: typeof authOptions
) => (req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) => Promise<Response>)(authOptions);

// Export the same handler for both GET and POST - NextAuth handles method routing internally
export const GET = handler;
export const POST = handler;


