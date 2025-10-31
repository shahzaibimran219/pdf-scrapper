"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { Upload, History, LogOut, Settings } from "lucide-react";

const items = [
  { href: "/dashboard/upload", label: "Scrape", Icon: Upload },
  { href: "/dashboard/history", label: "History", Icon: History },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <div className="flex   flex-col">
      <div className="mb-3">
        <h3 className="text-xs font-medium tracking-wide text-[hsl(var(--muted-foreground))] ">Menu</h3>
      </div>
      <nav className="space-y-2">
        {items.map(({ href, label, Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm border transition-colors " +
                (active
                  ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border-[hsl(var(--border))]"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--border))]")
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-6 ">
        <h3 className="text-xs font-medium tracking-wide text-[hsl(var(--muted-foreground))] mb-2 ">Other</h3>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start text-red-600 hover:bg-red-50"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </Button>
      </div>
    </div>
  );
}


