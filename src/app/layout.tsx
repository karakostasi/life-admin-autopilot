import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import el from "@/messages/el.json";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "greek"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: el.meta.title,
  description: el.meta.description,
  applicationName: "Θύμισέ μου",
  appleWebApp: { capable: true, title: "Θύμισέ μου", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/icon.svg?v=2", type: "image/svg+xml" }, { url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png?v=2" },
};

export const viewport: Viewport = { themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el" className={inter.variable}>
      <body className="font-sans antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
