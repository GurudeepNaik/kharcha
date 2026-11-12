import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Note what you spend in one line and see where your money goes.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Once installed on Android, the app appears in the share sheet: share a payment or its receipt from a UPI app.
    // Accepts receipt images (read on the phone) as well as text.
    share_target: {
      action: "/share-target", method: "POST", enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "receipt", accept: ["image/*"] }] },
    },
    // Long-press the app icon for these.
    shortcuts: [
      { name: "Add a spend", short_name: "Add", url: "/?add=1", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "This month", short_name: "Month", url: "/#month", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "People", short_name: "People", url: "/#people", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
    background_color: "#f6f7f5",
    theme_color: "#0b7a4b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
