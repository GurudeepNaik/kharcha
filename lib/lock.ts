// App lock: a PIN, and optionally the phone's fingerprint or face unlock, before anything shows.
// It hides the app from someone holding your unlocked phone. It does not encrypt the data on the phone.
// The PIN is never stored: only a salted PBKDF2 hash. Fingerprint uses WebAuthn's platform authenticator
// (the phone's own check); there's no server, so a successful check simply opens the app.

export interface LockData {
  salt: string; hash: string; iter: number;
  /** Fingerprint / face credential id, when turned on. */
  credId: string | null;
  /** Wrong PINs in a row, and when the next try is allowed. */
  fails: number; waitUntil: string | null;
  /** PIN length, so the lock screen opens as soon as the last digit is typed. */
  len: number;
}

const ITER = 150_000;
export const PIN_MIN = 4, PIN_MAX = 6;
export const RELOCK_MS = 60_000; // locks again after a minute away

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export const validPin = (pin: string) => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);

async function derive(pin: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iter }, key, 256));
}

export async function makeLock(pin: string, credId: string | null = null): Promise<LockData> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: await derive(pin, salt, ITER), iter: ITER, credId, fails: 0, waitUntil: null, len: pin.length };
}

/** Seconds to wait after this many wrong PINs in a row: none for 4, then 30 s, doubling, at most an hour. */
export const waitFor = (fails: number) => (fails < 5 ? 0 : Math.min(30 * 2 ** (fails - 5), 3600));

/** Checks a PIN. Returns the lock to save (fail count updated) and whether it matched. */
export async function checkPin(lock: LockData, pin: string, nowMs = Date.now()): Promise<{ ok: boolean; next: LockData; waitSec: number }> {
  if (lock.waitUntil && Date.parse(lock.waitUntil) > nowMs) return { ok: false, next: lock, waitSec: Math.ceil((Date.parse(lock.waitUntil) - nowMs) / 1000) };
  const ok = (await derive(pin, unb64(lock.salt), lock.iter)) === lock.hash;
  if (ok) return { ok, next: { ...lock, fails: 0, waitUntil: null }, waitSec: 0 };
  const fails = lock.fails + 1, w = waitFor(fails);
  return { ok, next: { ...lock, fails, waitUntil: w ? new Date(nowMs + w * 1000).toISOString() : null }, waitSec: w };
}

export function validLock(v: unknown): LockData | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.salt !== "string" || typeof o.hash !== "string" || typeof o.iter !== "number" || o.iter < 10_000) return null;
  return {
    salt: o.salt, hash: o.hash, iter: o.iter, credId: typeof o.credId === "string" ? o.credId : null,
    fails: typeof o.fails === "number" && o.fails >= 0 ? o.fails : 0, waitUntil: typeof o.waitUntil === "string" ? o.waitUntil : null,
    len: typeof o.len === "number" && o.len >= PIN_MIN && o.len <= PIN_MAX ? o.len : PIN_MAX,
  };
}

// ---------- Fingerprint / face (browser only) ----------
export async function bioAvailable(): Promise<boolean> {
  try { return typeof PublicKeyCredential !== "undefined" && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

/** Registers the phone's fingerprint / face check for this app. Returns the credential id, or null if cancelled. */
export async function bioRegister(appName: string): Promise<string | null> {
  try {
    const c = await navigator.credentials.create({ publicKey: {
      rp: { name: appName, id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: appName, displayName: appName },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000, attestation: "none",
    } }) as PublicKeyCredential | null;
    return c ? b64(c.rawId) : null;
  } catch { return null; }
}

/** Asks the phone to check the fingerprint / face. True when it passed. */
export async function bioCheck(credId: string): Promise<boolean> {
  try {
    const c = await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: location.hostname,
      allowCredentials: [{ type: "public-key", id: unb64(credId) }], userVerification: "required", timeout: 60_000,
    } });
    return !!c;
  } catch { return false; }
}
