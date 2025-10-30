import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInButtons } from "@/components/auth/SignInButtons";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";

export default async function SignInPage() {
  const session = await getServerSession();
  if (session) redirect("/dashboard");
  return (
    <main className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          {/* Left: Sign in form */}
          <div className="mx-auto w-full max-w-md ">
            <div className="mb-8 text-center">
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-1 text-sm text-zinc-600">Sign in to continue</p>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-white/90 backdrop-blur-lg p-10 shadow-lg flex flex-col items-center">
              <SignInButtons />
              <p className="mt-6 text-xs text-zinc-500 text-center">
                By continuing, you agree to our <a className="underline" href="#">Terms</a> and <a className="underline" href="#">Privacy Policy</a>.
              </p>
            </div>
          </div>

          {/* Right: Premium text-based card */}
          <div className="mx-auto w-full max-w-md md:max-w-none">
            <div className="rounded-2xl border border-zinc-200 bg-[hsl(var(--card))] p-6 shadow-sm md:p-8">
              <div className="mb-4 flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium">Resume PDF AI Scraper</p>
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
      </div>
    </main>
  );
}


