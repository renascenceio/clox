import type { Metadata } from "next";
import localFont from "next/font/local";
import { Newsreader } from "next/font/google";
import "./globals.css";

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
    <html lang="en" className="bg-bg" data-theme="pearl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} font-sans antialiased text-ink bg-bg selection:bg-accent/25`}
      >
        {children}
      </body>
    </html>
  );
}
