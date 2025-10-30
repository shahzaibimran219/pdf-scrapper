"use client";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { supabaseClient } from "@/lib/supabase-client";
import { Loader2 } from "lucide-react";
import { useBillingStore } from "@/lib/state/billing";
import { UploadCloud } from "lucide-react";

type Props = {
  maxBytes?: number;
};

export function Uploader({ maxBytes = 10 * 1024 * 1024 }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  // Avoid frequent re-renders: update progress via DOM refs instead of state
  const progressBarRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const setProgressDom = (p: number) => {
    const bar = progressBarRef.current;
    if (bar) bar.style.width = `${p}%`;
    const pct = percentRef.current;
    if (pct) pct.textContent = `${p}%`;
  };
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [stage, setStage] = useState<
    | "idle"
    | "uploading"
    | "uploadComplete"
    | "hashing"
    | "extracting"
    | "saving"
    | "redirecting"
  >("idle");
  const setStageSafe = (next: typeof stage) => setStage((cur) => (cur === next ? cur : next));
  const inputRef = useRef<HTMLInputElement>(null);
  // Rotating message refs to avoid re-renders
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipTimerRef = useRef<number | null>(null);
  const tips = useRef<string[]>([
    "Parsing contact info and links…",
    "Extracting experience bullets with dates…",
    "Detecting education and normalizing years…",
    "Spotting skills and technologies…",
    "Structuring JSON to match schema v2.0.0…",
  ]);
  const startTips = () => {
    // Prevent duplicate timers
    if (tipTimerRef.current) return;
    let i = 0;
    const el = tipRef.current;
    if (!el) return;
    el.textContent = tips.current[i % tips.current.length];
    tipTimerRef.current = window.setInterval(() => {
      i += 1;
      if (tipRef.current) tipRef.current.textContent = tips.current[i % tips.current.length];
    }, 1500) as unknown as number;
  };
  const stopTips = () => {
    if (tipTimerRef.current) {
      window.clearInterval(tipTimerRef.current);
      tipTimerRef.current = null;
    }
    if (tipRef.current) tipRef.current.textContent = "";
  };

  const onFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    if (file.size > maxBytes) {
      toast.error("File exceeds 10 MB limit");
      return;
    }
    // Client-side guard: ensure at least 100 credits before any upload/work
    try {
      const credits = useBillingStore.getState().credits;
      if (typeof credits === "number" && credits < 100) {
        toast.error("You need at least 100 credits to upload.", {
          duration: 5000,
          action: {
            label: "Upgrade",
            onClick: () => (window.location.href = "/dashboard/settings"),
          },
        });
        return;
      }
    } catch {}
    try {
      setIsUploading(true);
      setProgressDom(0);
      setStageSafe("uploading");
      setFileName(file.name);
      setFileSize(file.size);

      // Small path: direct to server (form-data) with real upload progress using XHR
      if (file.size <= 4 * 1024 * 1024) {
        await new Promise<void>((resolve, reject) => {
          const fd = new FormData();
          fd.set("file", file);
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/extract-small", true);
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              setProgressDom(Math.max(1, Math.round((evt.loaded / evt.total) * 100)));
            }
          };
          xhr.upload.onload = () => {
            setStageSafe("extracting");
            startTips();
          };
          xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText || "{}");
                  toast.success("Extraction complete");
                  setStageSafe("redirecting");
                  stopTips();
                  window.location.href = `/resumes/${data.resumeId}`;
                  resolve();
                } catch (e) {
                  reject(new Error("Failed to parse response"));
                }
              } else {
                try {
                  const err = JSON.parse(xhr.responseText || "{}");
                  reject(new Error(err?.message ?? "Extraction failed"));
                } catch {
                  reject(new Error("Extraction failed"));
                }
              }
            }
          };
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(fd);
        });
        return;
      }

      const res = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? "Failed to get upload URL");
      }
      const { signedUrl, token, storagePath } = await res.json();

      // Use Supabase client helper to upload to signed URL
      // Large path: upload to Supabase signed URL with progress via XHR
      await new Promise<void>((resolve, reject) => {
        const fd2 = new FormData();
        fd2.append("token", token);
        fd2.append("file", file);
        const xhr2 = new XMLHttpRequest();
        xhr2.open("POST", signedUrl, true);
        xhr2.upload.onprogress = (evt) => {
          if (evt.lengthComputable) setProgressDom(Math.max(1, Math.round((evt.loaded / evt.total) * 100)));
        };
        xhr2.upload.onload = () => {
          setStageSafe("uploadComplete");
        };
        xhr2.onreadystatechange = () => {
          if (xhr2.readyState === 4) {
            if (xhr2.status >= 200 && xhr2.status < 300) resolve();
            else reject(new Error("Upload failed"));
          }
        };
        xhr2.onerror = () => reject(new Error("Network error during upload"));
        xhr2.send(fd2);
      });

      toast.success("Upload complete. Starting extraction...");

      // Compute content hash (client-side, bytes only)
      setStageSafe("hashing");
      startTips();
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(buf));
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

      setStageSafe("extracting");
      const extract = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storagePath, sourceHash: hex, mode: "sync" }),
      });
      if (!extract.ok) {
        const e = await extract.json().catch(() => ({}));
        if (e?.code === "INSUFFICIENT_CREDITS") {
          toast.error("Insufficient credits! You need at least 100 credits to scrape a PDF. Please upgrade your plan.", {
            duration: 5000,
            action: {
              label: "Upgrade",
              onClick: () => window.location.href = "/dashboard/settings"
            }
          });
        } else {
          toast.error(e?.message ?? "Extraction failed");
        }
      } else {
        const data = await extract.json();
        toast.success("Extraction complete");
        setStageSafe("redirecting");
        stopTips();
        window.location.href = `/resumes/${data.resumeId}`;
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setIsUploading(false);
      setProgressDom(0);
      setStageSafe("idle");
      stopTips();
    }
  }, [maxBytes]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="rounded-2xl bg-[hsl(var(--card))] p-6 shadow-sm">
      <div
        className="group relative rounded-xl p-8 text-center cursor-pointer transition-all bg-gradient-to-br from-[hsl(var(--muted))] to-transparent hover:shadow-md focus-visible:outline-none"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] shadow-sm">
          <UploadCloud className="h-5 w-5" />
        </div>
        <p className="text-sm">
          <span className="font-medium">Drag & drop</span> your PDF here or
          <button type="button" className="ml-1 underline">browse</button>
        </p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">PDF up to {Math.floor(maxBytes / (1024 * 1024))} MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={onInputChange}
          className="hidden"
          disabled={isUploading}
        />
        {fileName && (
          <div className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
            Selected: <span className="font-medium text-[hsl(var(--foreground))]">{fileName}</span> · {(fileSize / 1024).toFixed(0)} KB
          </div>
        )}
      </div>

      {isUploading && (
        <div className="mt-6">
          <div className="h-2 w-full rounded bg-[hsl(var(--muted))]">
            <div ref={progressBarRef} className="h-2 rounded bg-[hsl(var(--primary))] transition-all" style={{ width: `0%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
            <span>
              {stage === "uploading" && "Uploading PDF…"}
              {stage === "uploadComplete" && "Upload complete. Preparing extraction…"}
              {stage === "hashing" && "Computing file fingerprint…"}
              {stage === "extracting" && "Scraping and analyzing your resume…"}
              {stage === "saving" && "Saving results…"}
              {stage === "redirecting" && "Opening result…"}
            </span>
            <span ref={percentRef}>0%</span>
          </div>
          {/* Engaging rotating tips while waiting */}
          {stage !== "uploading" && stage !== "idle" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span ref={tipRef} />
            </div>
          )}
        </div>
      )}

      {/* Helper text */}
      <div className="mt-6 text-xs text-[hsl(var(--muted-foreground))]">
        <ul className="list-disc space-y-1 pl-5">
          <li>Accepted: PDF only. Maximum size: {Math.floor(maxBytes / (1024 * 1024))} MB.</li>
          <li>For faster, more accurate results, export resumes to PDF (not scans).</li>
          <li>We never expose your file publicly. Uploads go to a private bucket under your account.</li>
          <li>You’ll be redirected to the result page as soon as extraction completes.</li>
        </ul>
      </div>
    </div>
  );
}


