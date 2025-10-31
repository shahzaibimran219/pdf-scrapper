interface PdfjsTextItem {
  str?: string;
}

interface PdfjsTextContent {
  items?: PdfjsTextItem[];
}

interface PdfjsPage {
  getTextContent(): Promise<PdfjsTextContent>;
}

interface PdfjsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfjsPage>;
}

interface PdfjsModule {
  GlobalWorkerOptions?: {
    workerSrc?: string;
  };
  getDocument(options: { data: Uint8Array; disableWorker: boolean }): {
    promise: Promise<PdfjsDocument>;
  };
}

export async function extractTextWithPdfjs(bytes: Uint8Array): Promise<{ pages: string[]; rawText: string }> {
  // Use pdfjs-dist legacy build for widest Node compatibility
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as PdfjsModule;
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
    const items: PdfjsTextItem[] = textContent.items ?? [];
    const text = items
      .map((it) => (typeof it?.str === "string" ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pageTexts.push(text);
  }
  return { pages: pageTexts, rawText: pageTexts.join("\n\n") };
}


