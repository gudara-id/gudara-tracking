import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "GUDARA Production & Sewing Tracker",
  description: "Internal tracker for production PO and sewing (jahit) output",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
