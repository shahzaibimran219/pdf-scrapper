"use client";
import { Button } from "@/components/ui/button";

type Props = {
  jsonText: string;
  downloadName: string;
};

export function ExportCopyButtons({ jsonText, downloadName }: Props) {
  function handleExport() {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(jsonText);
    } catch {}
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={handleExport}>
        Export JSON
      </Button>
      <Button type="button" size="sm" onClick={handleCopy}>
        Copy
      </Button>
    </div>
  );
}


