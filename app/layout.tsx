import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { APP_NAME, APP_URL } from "@/lib/brand";
import { inter, mono } from "./fonts";
import "./globals.css";

const description = `Note what you spend in one line, like "chai 20", and see where your money goes each month. Free, no sign-up, works offline, and nothing leaves your phone.`;
const title = `${APP_NAME} · simple expense tracker`;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: title, template: `%s · ${APP_NAME}` },
  description,
  applicationName: APP_NAME,
  keywords: ["expense tracker", "daily expense tracker", "spending tracker", "money manager", "budget", "kharcha", "offline", "India", "rupees"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: APP_NAME, title, description, url: APP_URL },
  twitter: { card: "summary_large_image", title, description },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // Android: the page shrinks above the keyboard, so the docked add box stays visible.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0f0e" },
  ],
};

// Runs before paint so the saved or system theme applies without a flash.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
