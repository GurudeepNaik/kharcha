// Reads the text in a receipt image, on the phone. The reader (tesseract.js) and its English data are served
// from this site (/ocr/) and kept by the browser after the first use, so later receipts work offline.

export interface Inbox { title: string; text: string; url: string; file: Blob | null }

/** Takes whatever the service worker saved from the share sheet, once (it's removed after reading). */
export async function takeInbox(): Promise<Inbox | null> {
  if (!("caches" in window)) return null;
  const cache = await caches.open("share-inbox");
  const metaRes = await cache.match("/share-inbox/meta");
  if (!metaRes) return null;
  const meta = (await metaRes.json()) as { title?: string; text?: string; url?: string; file?: boolean };
  const fileRes = meta.file ? await cache.match("/share-inbox/file") : undefined;
  const file = fileRes ? await fileRes.blob() : null;
  await Promise.all([cache.delete("/share-inbox/meta"), cache.delete("/share-inbox/file")]);
  return { title: meta.title ?? "", text: meta.text ?? "", url: meta.url ?? "", file };
}

/** The image redrawn `width` pixels wide (only ever shrunk). */
async function resized(blob: Blob, width: number): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, width / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("resize failed"))), "image/png"));
}

/**
 * Reads the receipt at three sizes in "sparse text" mode (the default single-block mode skips the big amount).
 * The ₹ sign is misread differently at different sizes, so lib/receipt.ts compares the readings.
 */
export async function readImageText(blob: Blob): Promise<string[]> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js", corePath: "/ocr", langPath: "/ocr", gzip: true,
    workerBlobURL: false, // a blob: worker would be blocked by the page's security policy
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const out: string[] = [];
    for (const width of [1400, 800, 600]) out.push((await worker.recognize(await resized(blob, width))).data.text);
    return out;
  } finally {
    await worker.terminate();
  }
}
