// Lightweight OCR/raster utilities with dynamic imports to avoid hard failures if deps are missing.

export async function rasterizeFirstPageToPng(pdfBytes: Uint8Array, dpi = 170): Promise<Buffer | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    const { createCanvas } = await import("canvas");

    // Configure pdfjs for Node
    const getDocument = pdfjsLib.getDocument || (pdfjsLib as any).default.getDocument;
    const loadingTask = getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    const renderContext = { canvasContext: context as any, viewport };
    await page.render(renderContext as any).promise;

    const pngBuffer: Buffer = canvas.toBuffer("image/png");
    return pngBuffer;
  } catch (e) {
    console.error("[ocr] rasterizeFirstPageToPng failed (missing deps?)", (e as any)?.message);
    return null;
  }
}

export async function ocrPngWithTesseract(pngBuffer: Buffer): Promise<string | null> {
  try {
    const Tesseract = await import("tesseract.js");
    const { createWorker } = (Tesseract as any).default || (Tesseract as any);
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(pngBuffer);
    await worker.terminate();
    const text: string = data?.text ?? "";
    return text.trim() || null;
  } catch (e) {
    console.error("[ocr] ocrPngWithTesseract failed (missing deps?)", (e as any)?.message);
    return null;
  }
}
