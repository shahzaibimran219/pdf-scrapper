import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/header/UserMenu";

export default async function Header() {
  const session = await getServerSession();
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--primary))] rounded-b-2xl">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 sm:gap-4"
          style={{ flexBasis: 0, flexGrow: 1, minWidth: 0 }}
        >
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="AI Scraper"
              width={150}
              height={150}
              className=" object-contain"
              priority
            />
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
              <Button size="sm" variant="secondary">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}


