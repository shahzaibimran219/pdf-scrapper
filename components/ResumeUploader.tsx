"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useBillingStore } from "@/lib/state/billing";

export default function ResumeUploader() {
  const router = useRouter();
  const credits = useBillingStore((s) => s.credits);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle" | "render" | "upload" | "parse">("idle");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipIdx, setTipIdx] = useState(0);

  const tips = useMemo(() => [
    "AI is working its magic…",
    "Analyzing the document…",
    "Dusting pixels…",
    "Finding contact info…",
    "Spotting job titles…",
    "Taming bullet points…",
    "Structuring JSON…",
  ], []);

  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 1400);
    return () => window.clearInterval(id);
  }, [loading, tips.length]);

  const stageText = useMemo(() => {
    if (!loading) return null;
    if (stage === "render") return "Preparing pages in your browser…";
    if (stage === "upload") return "Uploading pages securely…";
    return "Parsing your resume with AI…";
  }, [loading, stage]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Enforce hard 10MB limit client-side
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      toast.error("File too large. Max size is 10 MB.");
      e.target.value = "";
      return;
    }
    if ((credits ?? 0) < 100) {
      toast.error("Insufficient credits! You need at least 100 credits to scrape a PDF.", {
        duration: 5000,
        action: { label: "Upgrade", onClick: () => router.push("/dashboard/settings") },
      });
      return;
    }
    setError(null);
    setLoading(true);
    setStage("render");
    try {
      const pdfjsLib = await import("pdfjs-dist");
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

      const ab = await file.arrayBuffer();
      const pdf = await (pdfjsLib as any).getDocument({ data: ab }).promise;
      const images: string[] = [];

      const maxPages = Math.min(pdf.numPages, 3);
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx as any, viewport }).promise;
        images.push(canvas.toDataURL("image/png"));
      }

      setStage("upload");
      const res = await fetch("/api/extract-resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images, fileName: file.name, fileSize: file.size }),
      });

      setStage("parse");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      toast.success("Extraction complete");
      // Refresh router cache to ensure history page shows new upload
      router.refresh();
      if (json?.resumeId) router.push(`/resumes/${json.resumeId}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to extract resume");
    } finally {
      setLoading(false);
      setStage("idle");
    }
  }

  return (
    <div className="rounded-2xl bg-[hsl(var(--card))] p-6 shadow-sm relative" ref={containerRef}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl z-10">
          <div className="flex items-center gap-2 mb-2 text-[hsl(var(--muted-foreground))]">
            <Sparkles className="h-5 w-5 text-[hsl(var(--primary))] animate-pulse" />
            <span className="text-sm">{tips[tipIdx]}</span>
          </div>
          <h3 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2">Processing your resume…</h3>
          <div className="flex items-center gap-2 text-base text-[hsl(var(--muted-foreground))]">
            <span>{stageText}</span>
            <span className="bouncing-dots"><span className="dot">.</span><span className="dot">.</span><span className="dot">.</span></span>
          </div>
          <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div className="h-full w-1/2 animate-[shimmer_1.2s_infinite] bg-gradient-to-r from-[hsl(var(--primary))/0.3] via-[hsl(var(--primary))] to-[hsl(var(--primary))/0.3]" style={{ backgroundSize: "200% 100%" }} />
          </div>
          <style jsx>{`
            @keyframes shimmer { 0%{ transform: translateX(-50%);} 100%{ transform: translateX(150%);} }
          `}</style>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">(10–20s expected)</p>
        </div>
      )}

      <div 
        className="group relative rounded-xl p-8 text-center cursor-pointer transition-all bg-gradient-to-br from-[hsl(var(--muted))] to-transparent hover:shadow-md focus-visible:outline-none"
        onClick={() => !loading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!loading && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept="application/pdf" 
          onChange={handleFile} 
          className="hidden" 
          disabled={loading}
          aria-label="Upload PDF resume"
        />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] shadow-sm">
          <UploadCloud width="20" height="20" />
        </div>
        <p className="text-sm">
          <span className="font-medium">Drag & drop</span> your PDF here or <span className="underline">browse</span>
        </p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">PDF up to 10 MB • Works for text and scanned PDFs</p>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-6 text-xs text-[hsl(var(--muted-foreground))]">
        <ul className="list-disc space-y-1 pl-5">
          <li>Accepted: PDF only. Maximum size: 10 MB.</li>
          <li>For faster, more accurate results, export resumes to PDF (not photos).</li>
          <li>We never expose your file publicly. Processing happens with short‑lived links.</li>
          <li>You’ll be redirected to the result page as soon as extraction completes.</li>
        </ul>
      </div>
    </div>
  );
}
