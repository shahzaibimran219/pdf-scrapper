import Link from "next/link";
import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInButtons } from "@/components/auth/SignInButtons";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - PDF Resume Scrapper",
  description: "Sign in to start extracting structured data from PDF resumes",
};

export default async function SignInPage() {
  const session = await getServerSession();
  if (session) redirect("/dashboard");
  return (
    <main className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-zinc-50 relative">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          {/* Left: Sign in form */}
          <div className="w-full relative">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] blur-2xl opacity-80" aria-hidden>
              <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(700px_280px_at_10%_-10%,theme(colors.blue.100),transparent),radial-gradient(600px_240px_at_90%_-20%,theme(colors.zinc.100),transparent)]" />
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/80 md:p-8 h-full flex flex-col">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))/0.1]">
                  <Sparkles className="h-5 w-5 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <h1 className="text-base font-semibold leading-none">Sign in to PDF Resume Scrapper</h1>
                  <p className="mt-0.5 text-xs text-zinc-500">Fast, structured PDF parsing</p>
                </div>
              </div>

              <div className="space-y-6 flex-1 flex flex-col">
                <div className="flex justify-center">
                  <SignInButtons />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden>
                    <div className="w-full border-t border-dashed border-zinc-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white/90 px-2 text-zinc-500">or</span>
                  </div>
                </div>

                <div className="rounded-md border border-zinc-200 bg-zinc-50/70 p-3 text-xs text-zinc-600">
                  Trouble signing in? <Link href="#" className="underline">Contact support</Link> or read our <Link href="/privacy" className="underline">privacy</Link>.
                </div>

                <p className="text-xs text-zinc-500 text-center">
                  By continuing, you agree to our <Link className="underline" href="/terms">Terms</Link> and <Link className="underline" href="/privacy">Privacy Policy</Link>.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Premium text-based card */}
          <div className="w-full">
            <div className="rounded-2xl border border-zinc-200 bg-[hsl(var(--card))] p-6 shadow-sm md:p-8 h-full flex flex-col">
              <div className="mb-4 flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium">PDF Resume Scrapper</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Fast. Accurate. Private.</p>
                </div>
              </div>
              <h2 className="text-lg font-semibold tracking-tight">Premium resume parsing, built for you</h2>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Upload PDFs and get structured, schema-validated JSON instantly. Designed for recruiters and developers who need reliable data.
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                  <span><span className="font-medium">Fast and accurate</span> resume extraction</span>
                </li>
                <li className="flex items-start gap-3">
                  <Zap className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>Real-time upload progress and instant results</span>
                </li>
                <li className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>Your files stay private and secure</span>
                </li>
              </ul>
              <div className="mt-5 rounded-lg bg-[hsl(var(--muted))] p-4 text-xs text-[hsl(var(--muted-foreground))]">
                Tip: New to the platform? Sign in with Google and start with a simple PDF to see structured results in seconds.
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}


