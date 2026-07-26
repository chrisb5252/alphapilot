import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlphaPilot | Your AI Investment Copilot",
  description: "Understand your portfolio with educational, AI-powered insights."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClerkProvider><html lang="en"><body><SiteNav />{children}</body></html></ClerkProvider>;
}
