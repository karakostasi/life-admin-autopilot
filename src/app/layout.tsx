import type { Metadata } from "next";
import { Inter } from "next/font/google";
import el from "@/messages/el.json";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "greek"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: el.meta.title,
  description: el.meta.description,
};

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
