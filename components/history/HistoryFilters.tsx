"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

type Props = {
  initialQ?: string;
  initialStatus?: string;
};

export default function HistoryFilters({ initialQ = "", initialStatus = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);

  // Debounced push for search only
  useEffect(() => {
    const id = setTimeout(() => {
      const sp = new URLSearchParams(params?.toString());
      if (q) sp.set("q", q); else sp.delete("q");
      if (status) sp.set("status", status); else sp.delete("status");
      sp.delete("page"); // Reset to page 1 when search changes
      router.replace(`${pathname}?${sp.toString()}`);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onStatus = useCallback((next: string) => {
    setStatus((cur) => {
      const nextStatus = cur === next ? "" : next;
      const sp = new URLSearchParams(params?.toString());
      if (q) sp.set("q", q); else sp.delete("q");
      if (nextStatus) sp.set("status", nextStatus); else sp.delete("status");
      sp.delete("page"); // Reset to page 1 when filter changes
      router.replace(`${pathname}?${sp.toString()}`);
      return nextStatus;
    });
  }, [params, pathname, q, router]);

  const statusDefs = useMemo(
    () => [
      { key: "", label: "All" },
      { key: "PENDING", label: "Pending" },
      { key: "SUCCEEDED", label: "Succeeded" },
      { key: "FAILED", label: "Failed" },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--primary-foreground))]/80 sm:text-[hsl(var(--muted-foreground))]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search filename…"
            className="h-9 w-64 rounded-md border border-[hsl(var(--border))] bg-white/90 pl-8 pr-3 text-sm outline-none focus:border-[hsl(var(--ring))]"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {statusDefs.map((s) => (
          <Button
            key={s.key || "ALL"}
            size="sm"
            variant={status === s.key ? "secondary" : "ghost"}
            className={status === s.key ? "border border-[hsl(var(--border))]" : ""}
            onClick={() => onStatus(s.key)}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}


