"use client";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/SidebarNav";

export default function MobileSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white/90 px-3 py-2 text-sm shadow-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-sidebar"
      >
        <Menu className="h-4 w-4" />
        <span>Menu</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div id="mobile-sidebar" className="absolute left-0 top-0 h-full w-[82%] max-w-[300px] rounded-r-2xl bg-[hsl(var(--card))] p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Navigation</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-1 hover:bg-zinc-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav />
          </div>
        </div>
      )}
    </div>
  );
}
