import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import type { NextRequest } from "next/server";

// NextAuth v4 App Router - NextAuth returns a handler object with GET and POST methods
// Type assertion needed due to NextAuth's export structure
const NextAuthFn = NextAuth as unknown as (
  options: typeof authOptions
) => {
  GET: (req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) => Promise<Response>;
  POST: (req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) => Promise<Response>;
};
const handler = NextAuthFn(authOptions);

// Export GET and POST as direct handlers matching Next.js App Router expectations
export const GET = (req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) => handler.GET(req, context);
export const POST = (req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) => handler.POST(req, context);


