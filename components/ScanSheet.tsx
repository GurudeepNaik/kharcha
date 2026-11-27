"use client";

// Scan & pay: the camera looks for a shop's UPI QR code (or reads one from a photo) and hands the payee to the add box.
// Uses the browser's own QR reader (BarcodeDetector, on Android Chrome); the button is hidden where there isn't one.
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { readUpiQr, type UpiPayee } from "@/lib/upi";
import { Sheet, SheetHead, btnLine } from "./ui";

interface Detector { detect: (src: CanvasImageSource | ImageBitmap) => Promise<{ rawValue: string }[]> }
type DetectorCtor = { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };
const ctor = () => (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;

/** True when this browser can read QR codes. */
export async function canScan(): Promise<boolean> {
  const C = ctor();
  if (!C) return false;
  try { return !C.getSupportedFormats || (await C.getSupportedFormats()).includes("qr_code"); } catch { return false; }
}

export function ScanSheet({ open, onClose, onFound }: { open: boolean; onClose: () => void; onFound: (p: UpiPayee) => void }) {
  const { t } = useI18n();
  const S = t.scan;
  const video = useRef<HTMLVideoElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [noCam, setNoCam] = useState(false);
  const done = useRef(false);

  // What a scanned code means: a UPI payee closes the sheet; anything else says so and keeps looking.
  const take = (codes: { rawValue: string }[]) => {
    for (const c of codes) {
      const p = readUpiQr(c.rawValue);
      if (p && !done.current) { done.current = true; onFound(p); return true; }
    }
    if (codes.length) setMsg(S.notUpi);
    return false;
  };

  useEffect(() => {
    if (!open) return;
    done.current = false; setMsg(null); setNoCam(false);
    const C = ctor();
    if (!C) { setMsg(S.noCamera); setNoCam(true); return; }
    const det = new C({ formats: ["qr_code"] });
    let stream: MediaStream | null = null, timer = 0, stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach(x => x.stop()); return; }
        const v = video.current!;
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        const look = async () => {
          if (stopped || done.current) return;
          if (v.readyState >= 2) { try { if (take(await det.detect(v))) return; } catch { /* next frame */ } }
          timer = window.setTimeout(look, 200);
        };
        void look();
      } catch { if (!stopped) { setMsg(S.noCamera); setNoCam(true); } }
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach(x => x.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fromPhoto(f: File | undefined) {
    const C = ctor();
    if (!f || !C) return;
    try {
      const img = await createImageBitmap(f);
      const codes = await new C({ formats: ["qr_code"] }).detect(img);
      img.close();
      if (!codes.length) { setMsg(S.noneInPhoto); return; }
      take(codes);
    } catch { setMsg(S.noneInPhoto); }
  }

  return (
    <Sheet open={open} onClose={onClose} label={S.title}>
      <SheetHead title={S.title} onClose={onClose} />
      <div className={`relative overflow-hidden rounded-2xl bg-black ${noCam ? "hidden" : ""}`} style={{ aspectRatio: "1 / 1" }}>
        <video ref={video} muted playsInline className="size-full object-cover" data-testid="scan-video" />
        <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-[3px] border-white/85" />
      </div>
      <p className={`${noCam ? "" : "mt-3"} text-[15px] ${msg ? "font-medium text-bad" : "text-muted"}`} role={msg ? "alert" : undefined} data-testid="scan-msg">{msg ?? S.help}</p>
      <label className={`${btnLine} mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center text-center focus-within:ring-2 focus-within:ring-accent`}>
        <input type="file" accept="image/*" className="sr-only" data-testid="scan-photo" onChange={e => { void fromPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        {S.photo}
      </label>
    </Sheet>
  );
}
