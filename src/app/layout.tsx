import type { Metadata, Viewport } from "next";
import { Baloo_2, Bangers } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo",
  display: "swap",
});

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bangers",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Bookly",
    template: "%s · Bookly",
  },
  description: "Your personal library: upload books, organize them, and listen to AI narration.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fdf3df",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${baloo.variable} ${bangers.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
