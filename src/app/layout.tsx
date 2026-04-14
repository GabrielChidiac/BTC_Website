import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Space_Grotesk, Inter, Geist } from "next/font/google";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { SubscribeBanner } from "@/components/subscribe/SubscribeBanner";
import { COOKIE_NAME } from "@/lib/session";
import { safeJsonLd } from "@/lib/json-ld";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.btctoday.co"),
  title: "BTC Today | AI-Curated Bitcoin Intelligence",
  description:
    "Daily AI-curated Bitcoin intelligence for investors: market data, institutional flows, macro analysis, and expert insights.",
  openGraph: {
    title: "BTC Today | AI-Curated Bitcoin Intelligence",
    description:
      "Daily AI-curated Bitcoin intelligence for investors: market data, institutional flows, macro analysis, and expert insights.",
    type: "website",
    siteName: "BTC Today",
    url: "https://www.btctoday.co",
  },
  twitter: {
    card: "summary_large_image",
    title: "BTC Today | AI-Curated Bitcoin Intelligence",
    description:
      "Daily AI-curated Bitcoin intelligence for investors: market data, institutional flows, macro analysis, and expert insights.",
  },
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let isLoggedIn = false;
  try {
    const cookieStore = await cookies();
    isLoggedIn = !!cookieStore.get(COOKIE_NAME)?.value;
  } catch { /* no session */ }

  return (
    <html
      lang="en"
      className={cn(spaceGrotesk.variable, inter.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://www.btctoday.co/#organization",
                  name: "BTC Today",
                  url: "https://www.btctoday.co",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://www.btctoday.co/logo.png",
                  },
                  description:
                    "AI-curated daily Bitcoin intelligence for investors: market data, institutional flows, macro analysis, and expert insights.",
                },
                {
                  "@type": "WebSite",
                  "@id": "https://www.btctoday.co/#website",
                  name: "BTC Today",
                  url: "https://www.btctoday.co",
                  publisher: { "@id": "https://www.btctoday.co/#organization" },
                  description:
                    "Daily AI-curated Bitcoin intelligence for institutional investors.",
                },
              ],
            }),
          }}
        />
        <ScrollProgress />
        {!isLoggedIn && <SubscribeBanner />}
        {children}
      </body>
    </html>
  );
}
