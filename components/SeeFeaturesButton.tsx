"use client";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useCallback } from "react";

export default function SeeFeaturesButton() {
  const handleSeeFeatures = useCallback(() => {
    const el = document.getElementById("features");
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);

    const addGlow = () => {
      el.classList.add("feature-highlight");
      setTimeout(() => el.classList.remove("feature-highlight"), 1200);
    };

    if (fullyVisible) {
      addGlow();
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Wait a bit for scroll to settle
      setTimeout(addGlow, 450);
    }
  }, []);

  return (
    <Button variant="secondary" size="lg" className="gap-2 w-full sm:w-auto text-sm sm:text-base" onClick={handleSeeFeatures} type="button">
      <Sparkles className="h-4 w-4 text-[hsl(var(--primary))] flex-shrink-0" />
      <span className="hidden sm:inline">See features</span>
      <span className="sm:hidden">Features</span>
    </Button>
  );
}
