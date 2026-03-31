import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ChatContent } from "./ChatContent";
import { COOKIE_NAME } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ask AI | BTC Today",
  description: "Ask questions about today's Bitcoin market data, powered by AI.",
  robots: { index: false, follow: true },
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;

  let initialSession: { email: string } | null = null;
  if (sessionCookie) {
    try {
      const { email } = JSON.parse(sessionCookie);
      if (email) initialSession = { email };
    } catch { /* invalid cookie */ }
  }

  // Allow magic link params through (they'll be verified client-side)
  const params = await searchParams;
  const hasMagicLink = params.token && params.email;

  // No session and no magic link → redirect to login
  if (!initialSession && !hasMagicLink) {
    redirect("/sign-in");
  }

  return (
    <>
      <Header />
      <ChatContent initialSession={initialSession} />
    </>
  );
}
