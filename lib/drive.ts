// Backup to the person's own Google Drive. Browser only.
// Scope drive.file: the app sees only files it made itself, nothing else in Drive.
// Google's sign-in script loads only when Drive is used (it's the one piece of code not from this site).
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS = "https://accounts.google.com/gsi/client";
const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
export const DRIVE_FILE = "kharcha-backup.json";
export const DRIVE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const driveEnabled = () => !!DRIVE_CLIENT_ID;

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void; callback: (r: TokenResponse) => void };
type Gis = { accounts: { oauth2: { initTokenClient: (o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }) => TokenClient } } };

let loading: Promise<Gis> | null = null;
let token: { value: string; exp: number } | null = null;

/** Loads Google's sign-in script. Call it early (when the backup buttons show) so the tap can open the popup straight away. */
export function prepareDrive(): Promise<Gis> {
  if (!driveEnabled()) return Promise.reject(new Error("off"));
  const g = (window as unknown as { google?: Gis }).google;
  if (g?.accounts?.oauth2) return Promise.resolve(g);
  loading ??= new Promise<Gis>((res, rej) => {
    const s = document.createElement("script");
    s.src = GIS; s.async = true;
    s.onload = () => { const x = (window as unknown as { google?: Gis }).google; if (x?.accounts?.oauth2) res(x); else rej(new Error("gis")); };
    s.onerror = () => { loading = null; rej(new Error("gis")); };
    document.head.append(s);
  });
  return loading;
}

export class DriveError extends Error { constructor(public code: "cancelled" | "offline" | "denied" | "failed" | "none") { super(code); } }

/** Asks Google for access first (inside the tap), before any slow work, so the popup isn't blocked. */
export const connectDrive = () => getToken();

/** A short-lived access token. Opens Google's popup the first time; later taps reuse it for up to an hour. */
async function getToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const g = await prepareDrive().catch(() => { throw new DriveError("offline"); });
  return new Promise<string>((res, rej) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID, scope: SCOPE,
      callback: r => {
        if (!r.access_token) { rej(new DriveError(r.error === "access_denied" ? "denied" : "failed")); return; }
        token = { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 };
        res(r.access_token);
      },
      error_callback: e => rej(new DriveError(e.type === "popup_closed" ? "cancelled" : "failed")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

async function call(url: string, init: RequestInit, f: typeof fetch = fetch): Promise<Response> {
  const t = await getToken();
  let r: Response;
  try { r = await f(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}` } }); } catch { throw new DriveError("offline"); }
  if (r.status === 401) token = null;
  return r;
}

/** The newest backup this app made in Drive, if any. */
export async function findBackup(f: typeof fetch = fetch): Promise<{ id: string; modifiedTime: string } | null> {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and trashed=false`);
  const r = await call(`${API}?q=${q}&spaces=drive&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,modifiedTime)`, {}, f);
  if (!r.ok) throw new DriveError("failed");
  const j = await r.json() as { files?: { id: string; modifiedTime: string }[] };
  return j.files?.[0] ?? null;
}

/** Saves the backup over the previous one (or makes the file the first time). Returns when Drive has it. */
export async function saveToDrive(json: string, f: typeof fetch = fetch): Promise<string> {
  const found = await findBackup(f);
  let r: Response;
  if (found) {
    r = await call(`${UPLOAD}/${found.id}?uploadType=media&fields=id,modifiedTime`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: json }, f);
  } else {
    const boundary = `kharcha${Math.random().toString(36).slice(2)}`;
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: DRIVE_FILE, mimeType: "application/json" })}\r\n`
      + `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
    r = await call(`${UPLOAD}?uploadType=multipart&fields=id,modifiedTime`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body }, f);
  }
  if (!r.ok) throw new DriveError("failed");
  return ((await r.json()) as { modifiedTime?: string }).modifiedTime ?? new Date().toISOString();
}

/** The backup's text, for the usual restore preview. */
export async function loadFromDrive(f: typeof fetch = fetch): Promise<{ text: string; modifiedTime: string }> {
  const found = await findBackup(f);
  if (!found) throw new DriveError("none");
  const r = await call(`${API}/${found.id}?alt=media`, {}, f);
  if (!r.ok) throw new DriveError("failed");
  return { text: await r.text(), modifiedTime: found.modifiedTime };
}

/** For tests: pretend a token was already granted. */
export function _setToken(v: string | null) { token = v ? { value: v, exp: Date.now() + 3600_000 } : null; }
