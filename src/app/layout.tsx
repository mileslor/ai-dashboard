import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/lang-context";

export const metadata: Metadata = {
  title: "AI Dashboard",
  description: "AI Team Dashboard - Local-first",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
