import Link from "next/link";
import { getServerSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import SeeFeaturesButton from "@/components/SeeFeaturesButton";

export default async function Home() {
  const session = await getServerSession();
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container py-24 sm:py-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center text-xs font-medium text-[hsl(var(--secondary-foreground))] ml-1">AI‑Powered Resume Parser</span>
            <h1 className="mt-3 px-0 text-4xl font-semibold tracking-tight sm:text-5xl">
              Extract structured data from any resume PDF
            </h1>
            <p className="mt-4 text-[hsl(var(--muted-foreground))]">
              Upload PDFs up to 10 MB. We parse with OpenAI and keep a complete history. Export JSON or revisit later.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Link href={session ? "/dashboard" : "/signin"}>
                <Button size="lg" variant="primary" className="gap-2">
                  <span>{session ? "Go to Dashboard" : "Sign in to get started"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <SeeFeaturesButton />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[{
            title: "Direct PDF → JSON",
            desc: "Send your PDF straight to OpenAI for robust extraction—no local parsing needed.",
          }, {
            title: "History & Export",
            desc: "We snapshot each run. Review differences and export clean JSON anytime.",
          }, {
            title: "Secure Storage",
            desc: "Supabase private bucket per user, short‑lived uploads, and strict validation.",
          }].map((f) => (
            <div key={f.title} className="rounded-xl border bg-[hsl(var(--card))] p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20">
        <div className="rounded-2xl border bg-gradient-to-tr from-zinc-50 to-white p-8 sm:p-10 shadow-sm">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Ready to parse your first resume?</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Sign in and upload a PDF—get structured JSON in seconds.</p>
            </div>
            <Link href={session ? "/dashboard" : "/signin"}>
              <Button variant="primary" size="lg" className="gap-2 mt-3 sm:mt-0">
                <span>{session ? "Go to Dashboard" : "Sign in"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
