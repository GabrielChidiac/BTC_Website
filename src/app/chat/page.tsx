import { cookies } from "next/headers";
import { Header } from "@/components/layout/Header";
import { ChatContent } from "./ChatContent";
import { COOKIE_NAME } from "@/lib/session";

export default async function ChatPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;

  let initialSession: { email: string } | null = null;
  if (sessionCookie) {
    try {
      const { email } = JSON.parse(sessionCookie);
      if (email) initialSession = { email };
    } catch { /* invalid cookie */ }
  }

  return (
    <>
      <Header />
      <ChatContent initialSession={initialSession} />
    </>
  );
}
