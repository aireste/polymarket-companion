import type { Metadata } from "next";
import { Geist_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import "./app.css";
import "./desk.css";
import "./type.css";
import "./shape.css";
import "./pages.css";
import { AppShell } from "@/components/AppShell";
import { Analytics } from "@vercel/analytics/next";
import { THEME_BOOT } from "@/components/ThemeToggle";

// Only for real code (MCP URL, commands, key hints).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
// Hedge Lab's display type (OFL): wide, rounded, chunky. Only the Lab and its tour scene use it.
const labFont = Unbounded({ variable: "--font-lab", subsets: ["latin"], display: "swap", preload: false });

const DESCRIPTION = "Free calls on Polymarket US markets: which prices look off and how sure we are, plus a sandbox to test a bet before you place it.";

// What a shared link shows: the title, this description, and the card from opengraph-image.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://hedgepredict.co"),
  title: "HedgePredict",
  description: DESCRIPTION,
  openGraph: { title: "HedgePredict: find the price that's off", description: DESCRIPTION, siteName: "HedgePredict", type: "website", url: "/" },
  twitter: { card: "summary_large_image", title: "HedgePredict: find the price that's off", description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${labFont.variable} h-full antialiased`}
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
        <Analytics />
      </body>
    </html>
  );
}
