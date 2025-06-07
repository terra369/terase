import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AutoplayManager } from "@/components/AutoplayManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "terase - Voice Gratitude Journal",
  description: "A gratitude journal SNS with personal rainbow JARVIS companion",
  manifest: "/manifest.json",
  themeColor: "#1a1e27",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "terase",
  },
  icons: {
    apple: "/apple-touch-icon-180x180.png",
  },
};

export const viewport = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
      >
        <AutoplayManager>
          {children}
        </AutoplayManager>
      </body>
    </html>
  );
}
