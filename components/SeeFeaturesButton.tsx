"use client";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useCallback } from "react";

export default function SeeFeaturesButton() {
  const handleSeeFeatures = useCallback(() => {
    const features = document.getElementById("features");
    if (features) {
      features.scrollIntoView({ behavior: "smooth", block: "center" });
      features.classList.add("ring-2", "ring-[hsl(var(--primary))]", "transition-shadow");
      setTimeout(() => {
        features.classList.remove("ring-2", "ring-[hsl(var(--primary))]", "transition-shadow");
      }, 800);
    }
  }, []);
  return (
    <Button variant="secondary" size="lg" className="gap-2" onClick={handleSeeFeatures} type="button">
      <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
      See features
    </Button>
  );
}
