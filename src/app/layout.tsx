import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, Geist } from "next/font/google";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BTC Today | AI-Curated Bitcoin Intelligence",
  description:
    "Daily AI-curated Bitcoin intelligence for investors: market data, institutional flows, macro analysis, and expert insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(spaceGrotesk.variable, ibmPlexSans.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-screen">
        <ScrollProgress />
        {children}
      </body>
    </html>
  );
}
