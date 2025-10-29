import Link from "next/link";
import { getServerSession } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession();
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(1000px_400px_at_10%_-10%,#dbeafe,transparent),radial-gradient(800px_300px_at_90%_-20%,#f5f5f4,transparent)]" />
        <div className="container py-24 sm:py-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-[hsl(var(--secondary))] px-3 py-1 text-xs font-medium text-[hsl(var(--secondary-foreground))]">AI‑powered resume parser</span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Extract structured data from any resume PDF
            </h1>
            <p className="mt-4 text-[hsl(var(--muted-foreground))]">
              Upload PDFs up to 10 MB. We parse with OpenAI and keep a complete history. Export JSON or revisit later.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Link
                href={session ? "/dashboard" : "/signin"}
                className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-3 text-sm font-medium hover:opacity-90"
              >
                {session ? "Go to Dashboard" : "Sign in to get started"}
              </Link>
              <a
                href="#features"
                className="rounded-md border border-[hsl(var(--border))] px-5 py-3 text-sm font-medium hover:bg-[hsl(var(--muted))]"
              >
                See features
              </a>
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
            <Link
              href={session ? "/dashboard" : "/signin"}
              className="rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-3 text-sm font-medium hover:opacity-90"
            >
              {session ? "Go to Dashboard" : "Sign in"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
