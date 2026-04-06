import type { Metadata } from "next";
import localFont from "next/font/local";
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased selection:bg-primary/30`}
      >
        {children}
      </body>
    </html>
  );
}
