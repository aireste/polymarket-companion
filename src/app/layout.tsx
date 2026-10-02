import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import "./app.css";
import "./desk.css";
import "./type.css";
import "./shape.css";
import "./pages.css";
import { AppShell } from "@/components/AppShell";
import { THEME_BOOT } from "@/components/ThemeToggle";

// Only for real code (MCP URL, commands, key hints).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HedgePredict",
  description:
    "A calm prediction-market companion. See today's markets worth a look, and where an honest read finds an edge worth hedging.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} h-full antialiased`}
      // The theme script below sets data-theme before hydration.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* Satoshi (Indian Type Foundry, ITF Free Font License): loaded from Fontshare's
            own service because this repo is public and the license forbids redistributing
            the font files. Variable cut (weights 300-900). */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@1&display=swap" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
