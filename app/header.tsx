import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { getServerSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/header/UserMenu";

export default async function Header() {
  const session = await getServerSession();
  return (
    <header  >
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 sm:gap-4"
          style={{ flexBasis: 0, flexGrow: 1, minWidth: 0 }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-[hsl(var(--primary))]" />
            <span className="font-semibold text-lg tracking-tight hidden sm:inline">Resume AI Scraper</span>
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {session ? (
            <Link href="/dashboard" className="hidden sm:inline opacity-90 hover:opacity-100">Dashboard</Link>
          ) : null}
          {session ? (
            <UserMenu email={session.user.email} image={session.user.image ?? null} />
          ) : (
            <Link href="/signin">
              <Button variant="primary" size="md" >
                <span>{session ? "Go to Dashboard" : "Sign in"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}


