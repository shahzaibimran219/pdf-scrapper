"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { LogOut, Loader2 } from "lucide-react";

type Props = {
  email?: string | null;
  image?: string | null;
};

export function UserMenu({ email, image }: Props) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
          className="flex cursor-pointer items-center rounded-full border border-transparent px-1.5 py-1 text-[hsl(var(--primary-foreground))] hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {image ? (
          <Image src={image} alt="avatar" width={30} height={30} className="rounded-full" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-white/30" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium truncate text-zinc-800">{email ?? "Signed in"}</p>
          </div>
          <div className="p-1">
            <Link href="/dashboard" className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100">Dashboard</Link>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-left px-3 py-2 h-auto text-zinc-700"
              onClick={async () => {
                setIsSigningOut(true);
                try {
                  await signOut({ callbackUrl: "/" });
                } catch (error) {
                  console.error("Logging out error:", error);
                  setIsSigningOut(false);
                }
              }}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              {isSigningOut ? "Logging out..." : "Log out"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


