import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getServerSession } from "@/lib/auth";
import MobileSidebar from "@/components/dashboard/MobileSidebar";
import HeaderNav from "@/components/header/HeaderNav";

export default async function Header() {
  const session = await getServerSession();
  return (
    <header  >
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4" style={{ flexBasis: 0, flexGrow: 1, minWidth: 0 }}>
          {session ? (
            <div className="md:hidden">
              <MobileSidebar />
            </div>
          ) : null}
          <Link href="/" prefetch className="hidden md:flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-[hsl(var(--primary))]" />
            <span className="font-semibold text-lg tracking-tight">PDF Resume Scrapper</span>
          </Link>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <HeaderNav
            userEmail={session?.user?.email}
            userImage={session?.user?.image ?? null}
            isSignedIn={!!session}
          />
        </nav>
      </div>
    </header>
  );
}


