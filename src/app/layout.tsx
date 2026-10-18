import type { Metadata } from "next";
import el from "@/messages/el.json";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: el.meta.title,
  description: el.meta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body className="bg-white text-slate-900 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
