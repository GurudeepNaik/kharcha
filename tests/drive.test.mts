import assert from "node:assert";
const D = (await import("../lib/drive.ts")) as typeof import("../lib/drive");
D._setToken("tok");
type Call = { url: string; method: string; auth: string; body: string; type: string };
function fake(existing: { id: string; modifiedTime: string } | null, opts: { status?: number } = {}) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    const h = (init.headers ?? {}) as Record<string, string>;
    calls.push({ url, method: init.method ?? "GET", auth: h.Authorization ?? "", body: String(init.body ?? ""), type: h["Content-Type"] ?? "" });
    if (opts.status) return new Response("{}", { status: opts.status });
    if (url.includes("?q=")) return Response.json({ files: existing ? [existing] : [] });
    if (url.includes("alt=media")) return new Response('{"kind":"backup"}');
    return Response.json({ id: "new1", modifiedTime: "2026-11-12T10:00:00.000Z" });
  }) as typeof fetch;
  return { f, calls };
}
// First backup: looks for the file, then creates it (multipart, named kharcha-backup.json).
{
  const { f, calls } = fake(null);
  assert.equal(await D.saveToDrive('{"a":1}', f), "2026-11-12T10:00:00.000Z");
  assert.equal(calls.length, 2);
  assert.ok(decodeURIComponent(calls[0]!.url).includes("name='kharcha-backup.json' and trashed=false"));
  assert.ok(calls[1]!.method === "POST" && calls[1]!.url.includes("uploadType=multipart") && calls[1]!.type.startsWith("multipart/related; boundary="));
  assert.ok(calls[1]!.body.includes('"name":"kharcha-backup.json"') && calls[1]!.body.includes('{"a":1}'));
  assert.ok(calls.every(c => c.auth === "Bearer tok"), "every call carries the token");
}
// Later backups replace the same file.
{
  const { f, calls } = fake({ id: "abc", modifiedTime: "2026-11-01T00:00:00.000Z" });
  await D.saveToDrive('{"a":2}', f);
  assert.ok(calls[1]!.method === "PATCH" && calls[1]!.url.includes("/upload/drive/v3/files/abc?uploadType=media") && calls[1]!.body === '{"a":2}');
}
// Restore reads the newest backup; none → a clear error.
{
  const { f } = fake({ id: "abc", modifiedTime: "2026-11-01T00:00:00.000Z" });
  assert.deepEqual(await D.loadFromDrive(f), { text: '{"kind":"backup"}', modifiedTime: "2026-11-01T00:00:00.000Z" });
  await assert.rejects(D.loadFromDrive(fake(null).f), (e: unknown) => e instanceof D.DriveError && e.code === "none");
  await assert.rejects(D.saveToDrive("{}", fake(null, { status: 500 }).f), (e: unknown) => e instanceof D.DriveError && e.code === "failed");
}
console.log("DRIVE OK");
