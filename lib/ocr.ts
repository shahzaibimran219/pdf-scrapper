// Lightweight OCR/raster utilities with dynamic imports to avoid hard failures if deps are missing.

interface PdfjsDocumentLike {
  getPage(pageNumber: number): Promise<{
    getViewport(options: { scale: number }): { width: number; height: number };
    render(params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
  }>;
}

interface PdfjsModuleLike {
  getDocument?: (options: { data: Uint8Array }) => { promise: Promise<PdfjsDocumentLike> };
  default?: {
    getDocument: (options: { data: Uint8Array }) => { promise: Promise<PdfjsDocumentLike> };
  };
}

export async function rasterizeFirstPageToPng(pdfBytes: Uint8Array, dpi = 170): Promise<Buffer | null> {
  try {
    const pdfjsLib = (await import("pdfjs-dist")) as unknown as PdfjsModuleLike;
    const { createCanvas } = await import("canvas");

    // Configure pdfjs for Node
    const getDocument = pdfjsLib.getDocument ?? pdfjsLib.default?.getDocument;
    if (!getDocument) throw new Error("pdfjs getDocument not available");
    const loadingTask = getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context not available");

    await page.render({ canvasContext: context, viewport }).promise;

    const pngBuffer: Buffer = canvas.toBuffer("image/png");
    return pngBuffer;
  } catch (e: unknown) {
    const msg = typeof e === 'object' && e && 'message' in e ? String((e as Record<string, unknown>).message) : String(e);
    console.error("[ocr] rasterizeFirstPageToPng failed (missing deps?)", msg);
    return null;
  }
}

export async function ocrPngWithTesseract(pngBuffer: Buffer): Promise<string | null> {
  try {
    const Tesseract = await import("tesseract.js");
    const maybe = (Tesseract as unknown as { default?: { createWorker?: (lang: string) => Promise<{ recognize: (buf: Buffer) => Promise<{ data?: { text?: string } }> ; terminate: () => Promise<void> }> }; createWorker?: (lang: string) => Promise<{ recognize: (buf: Buffer) => Promise<{ data?: { text?: string } }> ; terminate: () => Promise<void> }> });
    const createWorker = maybe.default?.createWorker ?? maybe.createWorker;
    if (!createWorker) throw new Error("Tesseract createWorker not available");

    const worker = await createWorker("eng");
    const { data } = await worker.recognize(pngBuffer);
    await worker.terminate();
    const text: string = data?.text ?? "";
    return text.trim() || null;
  } catch (e: unknown) {
    const msg = typeof e === 'object' && e && 'message' in e ? String((e as Record<string, unknown>).message) : String(e);
    console.error("[ocr] ocrPngWithTesseract failed (missing deps?)", msg);
    return null;
  }
}
