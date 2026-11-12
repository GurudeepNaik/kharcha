// Fallback for a share that arrives before the service worker is running (it normally handles /share-target itself).
// Nothing is kept: the app opens and says to share again.
export function POST(req: Request) {
  return Response.redirect(new URL("/?shared=0", req.url), 303);
}
export function GET(req: Request) {
  return Response.redirect(new URL("/", req.url), 303);
}
