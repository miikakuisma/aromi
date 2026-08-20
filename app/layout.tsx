import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Familjen_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

const display = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meilahden ala-aste — ruokalista",
  description:
    "Meilahden ala-asteen kouluruokalista viikoittain. Tiedot Helsingin kaupungin Aromi-palvelusta.",
  applicationName: "Ruokalista",
  appleWebApp: {
    capable: true,
    title: "Ruokalista",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    title: "Meilahden ala-aste — ruokalista",
    description: "Mitä koulussa syödään tällä viikolla?",
    locale: "fi_FI",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
  // iOS 16.4 ja uudemmat lukevat manifestin, vanhemmat tarvitsevat tämän.
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDF2F9" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1725" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fi" dir="ltr" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
