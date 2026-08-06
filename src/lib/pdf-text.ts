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

/** يبدأ تحميل محرك PDF مبكراً (عند فتح المكتبة) لتقليل زمن أول عملية. */
export function warmPdfEngine() {
  void getPdfjs().catch(() => null);
}

export async function getPdfPageCount(data: ArrayBuffer): Promise<number> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const count = doc.numPages;
  await doc.cleanup();
  return count;
}

/**
 * يستخرج نص ملف PDF على دفعات متوازية مع احترام نطاق الصفحات.
 * التحليل نفسه يجري في Worker الخاص بـ pdfjs، والدفعات تُعيد التحكم للمتصفح كي لا تتجمد الواجهة.
 */
export async function extractPdfText(
  data: ArrayBuffer,
  options: {
    pageFrom?: number | null;
    pageTo?: number | null;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<{ pages: PageText[]; totalPages: number }> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const totalPages = doc.numPages;

  const from = Math.max(1, Math.min(options.pageFrom ?? 1, totalPages));
  const to = Math.max(from, Math.min(options.pageTo ?? totalPages, totalPages));

  const pages: PageText[] = [];
  const BATCH = 8;
  let done = 0;
  const total = to - from + 1;

  for (let start = from; start <= to; start += BATCH) {
    const end = Math.min(start + BATCH - 1, to);
    const numbers: number[] = [];
    for (let n = start; n <= end; n += 1) numbers.push(n);

    const batch = await Promise.all(
      numbers.map(async (n) => {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        page.cleanup();
        return { page: n, text };
      }),
    );

    for (const item of batch) if (item.text) pages.push(item);
    done += numbers.length;
    options.onProgress?.(Math.min(done, total), total);
    await new Promise((r) => setTimeout(r, 0));
  }

  await doc.cleanup();
  pages.sort((a, b) => a.page - b.page);
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

/* ------------------------------------------------------------------ */
/* تخزين مؤقت محلي للنص المستخرج (IndexedDB) حتى لا يُعاد الاستخراج    */
/* ------------------------------------------------------------------ */

const DB_NAME = "drasti-cache";
const STORE = "pdf-text";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export type CachedPages = { pages: PageText[]; totalPages: number; savedAt: number };

export function pdfCacheKey(documentId: string, from: number | null, to: number | null) {
  return `${documentId}:${from ?? "all"}-${to ?? "all"}`;
}

export async function getCachedPages(key: string): Promise<CachedPages | null> {
  const cached = await idbGet<CachedPages>(key);
  if (!cached) return null;
  // صلاحية أسبوع
  if (Date.now() - cached.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
  return cached;
}

export async function setCachedPages(key: string, pages: PageText[], totalPages: number) {
  await idbSet(key, { pages, totalPages, savedAt: Date.now() } satisfies CachedPages);
}
