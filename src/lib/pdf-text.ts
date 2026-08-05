export type PageText = { page: number; text: string };

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export async function getPdfPageCount(data: ArrayBuffer): Promise<number> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const count = doc.numPages;
  await doc.cleanup();
  return count;
}

/**
 * يستخرج نص ملف PDF صفحة بصفحة مع احترام نطاق الصفحات.
 * يعمل على دفعات صغيرة مع إعادة التحكم للمتصفح كي لا تتجمد الواجهة.
 */
export async function extractPdfText(
  data: ArrayBuffer,
  options: { pageFrom?: number | null; pageTo?: number | null; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ pages: PageText[]; totalPages: number }> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const totalPages = doc.numPages;

  const from = Math.max(1, Math.min(options.pageFrom ?? 1, totalPages));
  const to = Math.max(from, Math.min(options.pageTo ?? totalPages, totalPages));

  const pages: PageText[] = [];
  for (let n = from; n <= to; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    page.cleanup();
    if (text) pages.push({ page: n, text });
    options.onProgress?.(n - from + 1, to - from + 1);
    if ((n - from) % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }

  await doc.cleanup();
  return { pages, totalPages };
}

/** يبني نصاً واحداً مع علامات أرقام الصفحات لدعم التوثيق والمصدر. */
export function buildSourceText(pages: PageText[], maxChars = 120_000): string {
  let out = "";
  for (const p of pages) {
    const block = `\n[صفحة ${p.page}]\n${p.text}\n`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out.trim();
}
