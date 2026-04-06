import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSubscriberTier } from "@/lib/tier";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SignInContent } from "./SignInContent";

export const metadata: Metadata = {
  title: "Login | BTC Today",
  description: "Login to access your BTC Today Pro subscription.",
  robots: { index: false, follow: true },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  // If arriving via magic link, always show the page so the client
  // component can verify the token (even if an old cookie exists).
  const params = await searchParams;
  const hasMagicLink = params.token && params.email;

  if (!hasMagicLink) {
    // Only redirect if the session is actually valid (verified against DB)
    const { email } = await getSubscriberTier();
    if (email) redirect("/");
  }

  return (
    <>
      <Header />
      <SignInContent />
      <Footer />
    </>
  );
}
