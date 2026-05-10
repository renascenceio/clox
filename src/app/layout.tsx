import type { Metadata } from "next";
import localFont from "next/font/local";
import { Newsreader } from "next/font/google";
import "./globals.css";
import CookieConsent from "@/components/cookie-consent/CookieConsent";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
// Editorial display face — used for titles, AI mark, and pull quotes.
// Loaded in italic at 400/500 since the system uses italic almost exclusively.
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "500"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Clox Studio – AI Aggregator", template: "%s | Clox Studio" },
  description: "Generate text, images, video, and audio with 50+ AI models in one workspace.",
  keywords: ["AI aggregator", "image generation", "text AI", "video AI", "audio AI"],
  openGraph: { type: "website", locale: "en_US", images: ["/og-image.png"] },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://clox.studio" }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * `suppressHydrationWarning` is REQUIRED here. The inline pre-paint
     * bootstrap below mutates `data-theme`, `data-palette`, and the
     * `.dark` class on <html> synchronously before React hydrates.
     * Without this attribute, React would reconcile those mutations
     * against the JSX-declared values during hydration and silently
     * reset `data-theme` back to "pearl" + strip `.dark`. The visible
     * symptom was: dark-mode users seeing light-mode text colours
     * (Tailwind `text-ink`/`bg-bg` tokens locked to pearl palette)
     * for the brief moment between hydration and the next render
     * that re-applied the user's stored palette. Keeping the JSX
     * default at "pearl" so SSR has a sensible fallback for users
     * who land with localStorage blocked or empty; the bootstrap
     * overrides it for everyone else.
     */
    <html lang="en" className="bg-bg" data-theme="pearl" suppressHydrationWarning>
      <head>
        {/*
          Pre-paint theme bootstrap — runs synchronously before the first
          paint so we never render the wrong palette and then "flip" it
          after hydration. Without this, dark-mode users would see a
          fraction of a second of light theme on every reload, and worse
          — Tailwind tokens like `text-ink` only update when the
          `.dark` class or `data-theme="onyx"` attribute is applied,
          while the rest of the app uses inline-styled palettes keyed
          off `localStorage`. The mismatch is what produced "dark text
          on dark background after reload" until you toggled the theme
          again.
          The script is tiny and dependency-free on purpose: any failure
          here would block hydration. We keep it idempotent so future
          calls to `setStoredPalette` overwrite cleanly.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var key = localStorage.getItem('clox-palette');
                  // Honour the legacy ThemeToggle which only knows 'theme'.
                  if (!key) {
                    var legacy = localStorage.getItem('theme');
                    if (legacy === 'dark') key = 'dark';
                  }
                  if (!key) return;
                  var html = document.documentElement;
                  // The CSS in globals.css reacts to two signals:
                  // (a) the .dark class for the dark palette,
                  // (b) [data-theme='onyx'|'pearl-light'|...] for alternates.
                  var attrMap = {
                    dark: 'onyx',
                    pearlLight: 'pearl-light',
                    pearlNeutral: 'pearl-neutral',
                  };
                  var attr = attrMap[key] || key;
                  html.setAttribute('data-theme', attr);
                  html.setAttribute('data-palette', key);
                  if (key === 'dark') html.classList.add('dark');
                  else html.classList.remove('dark');
                } catch (_) { /* localStorage may be blocked — fall back to SSR default */ }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} font-sans antialiased text-ink bg-bg selection:bg-accent/25`}
      >
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
