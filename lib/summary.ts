// The month as one picture to share on WhatsApp: what came in, what went out, what's left, where it went.
// Drawn on a canvas on the phone; nothing is uploaded. Fixed light colours so it looks the same in any chat.

export interface SummaryData {
  app: string; month: string; // "November 2026"
  labels: { in: string; spent: string; invested: string; left: string; overspent: string; top: string; inHand: string; madeWith: string };
  moneyIn: number; spent: number; invested: number; inHand: number | null;
  top: { label: string; paise: number }[];
  rupees: (p: number) => string;
}

const W = 1080, H = 1350, PAD = 80;
const C = { bg: "#f6f7f5", card: "#ffffff", fg: "#14181a", muted: "#586064", line: "#e3e6e3", accent: "#0b7a4b", accentSoft: "#e3f2ea", bad: "#b42318" };

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

/** Draws the summary. Returns the canvas (1080 × 1350, a WhatsApp-friendly 4:5). */
export function drawSummary(d: SummaryData, font: string, doc: Document = document): HTMLCanvasElement {
  const cv = doc.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const f = (w: number, s: number) => `${w} ${s}px ${font}`;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  // Header: app mark and month.
  ctx.fillStyle = C.accent; round(ctx, PAD, PAD, 76, 76, 18); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = f(800, 48); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("₹", PAD + 38, PAD + 40);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.muted; ctx.font = f(600, 34); ctx.fillText(d.app, PAD + 100, PAD + 30);
  ctx.fillStyle = C.fg; ctx.font = f(800, 56); ctx.fillText(d.month, PAD + 100, PAD + 84);

  // Big number: left over (or overspent).
  const left = d.moneyIn - d.spent - d.invested;
  let y = PAD + 150;
  ctx.fillStyle = C.card; round(ctx, PAD, y, W - 2 * PAD, 300, 36); ctx.fill();
  ctx.fillStyle = C.muted; ctx.font = f(600, 36); ctx.fillText(left >= 0 ? d.labels.left : d.labels.overspent, PAD + 48, y + 76);
  ctx.fillStyle = left >= 0 ? C.accent : C.bad; ctx.font = f(800, 120); ctx.fillText(d.rupees(Math.abs(left)), PAD + 44, y + 210);
  if (d.inHand !== null) { ctx.fillStyle = C.muted; ctx.font = f(500, 32); ctx.fillText(`${d.labels.inHand}: ${d.inHand < 0 ? "−" : ""}${d.rupees(Math.abs(d.inHand))}`, PAD + 48, y + 268); }

  // Three tiles: in, spent, invested.
  y += 340;
  const tw = (W - 2 * PAD - 2 * 24) / 3;
  ([[d.labels.in, d.moneyIn, C.accent, "+"], [d.labels.spent, d.spent, C.fg, ""], [d.labels.invested, d.invested, C.fg, ""]] as const).forEach(([label, v, col, sign], k) => {
    const x = PAD + k * (tw + 24);
    ctx.fillStyle = C.card; round(ctx, x, y, tw, 170, 28); ctx.fill();
    ctx.fillStyle = C.muted; ctx.font = f(600, 28); ctx.fillText(label, x + 28, y + 56, tw - 56);
    ctx.fillStyle = col; ctx.font = f(800, 44); ctx.fillText(`${v ? sign : ""}${d.rupees(v)}`, x + 28, y + 124, tw - 56);
  });

  // Where it went: top categories with bars.
  y += 210;
  const top = d.top.slice(0, 4);
  if (top.length) {
    ctx.fillStyle = C.card; round(ctx, PAD, y, W - 2 * PAD, 90 + top.length * 92, 36); ctx.fill();
    ctx.fillStyle = C.fg; ctx.font = f(700, 34); ctx.fillText(d.labels.top, PAD + 48, y + 68);
    const max = Math.max(...top.map(c => c.paise), 1), bw = W - 2 * PAD - 96;
    top.forEach((c, k) => {
      const ry = y + 120 + k * 92;
      ctx.fillStyle = C.fg; ctx.font = f(600, 30); ctx.fillText(c.label, PAD + 48, ry, bw * 0.6);
      ctx.textAlign = "right"; ctx.fillText(d.rupees(c.paise), W - PAD - 48, ry); ctx.textAlign = "left";
      ctx.fillStyle = C.accentSoft; round(ctx, PAD + 48, ry + 18, bw, 16, 8); ctx.fill();
      ctx.fillStyle = C.accent; round(ctx, PAD + 48, ry + 18, Math.max(bw * c.paise / max, 16), 16, 8); ctx.fill();
    });
  }

  ctx.fillStyle = C.muted; ctx.font = f(500, 28); ctx.textAlign = "center";
  ctx.fillText(d.labels.madeWith, W / 2, H - 56);
  return cv;
}

export const canvasToPng = (cv: HTMLCanvasElement) => new Promise<Blob>((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error("png"))), "image/png"));
