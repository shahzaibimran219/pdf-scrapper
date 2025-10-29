"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

type Props = {
  jsonText: string;
  initiallyCollapsed?: boolean;
  anchorId?: string;
};

export function CollapsibleJson({ jsonText, initiallyCollapsed = true, anchorId }: Props) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);

  // Expand if the hash points to this block
  React.useEffect(() => {
    function expandIfHashMatches() {
      if (!anchorId) return;
      if (typeof window !== "undefined" && window.location.hash === `#${anchorId}`) {
        setCollapsed(false);
      }
    }
    expandIfHashMatches();
    window.addEventListener("hashchange", expandIfHashMatches);
    return () => window.removeEventListener("hashchange", expandIfHashMatches);
  }, [anchorId]);

  return (
    <div className="rounded-xl border bg-[hsl(var(--card))]" id={anchorId}>
      <div className="flex items-center justify-between p-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium hover:opacity-80"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Raw JSON
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? "Show" : "Hide"}
          </Button>
        </div>
      </div>
      {!collapsed && (
        <div className="border-t">
          <pre className="text-xs bg-gray-50 p-4 rounded-b-xl overflow-auto">
{jsonText}
          </pre>
        </div>
      )}
    </div>
  );
}


