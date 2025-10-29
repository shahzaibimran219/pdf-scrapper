export async function extractTextWithPdfjs(bytes: Uint8Array): Promise<{ pages: string[]; rawText: string }> {
  // Use pdfjs-dist legacy build for widest Node compatibility
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Ensure workers are disabled in server environments
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = undefined;
  }

  const loadingTask = pdfjs.getDocument({ data: bytes, disableWorker: true });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items: any[] = textContent.items ?? [];
    const text = items
      .map((it) => (typeof it?.str === "string" ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pageTexts.push(text);
  }
  return { pages: pageTexts, rawText: pageTexts.join("\n\n") };
}


