"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { SubscriberGate } from "@/components/chat/SubscriberGate";
import { ChatInterface } from "@/components/chat/ChatInterface";

function ChatContent() {
  const [session, setSession] = useState<{ email: string; token: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const magicToken = searchParams.get("token");
    const magicEmail = searchParams.get("email");

    // If magic link params present, verify them
    if (magicToken && magicEmail) {
      setVerifying(true);
      fetch("/api/chat/verify-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail, token: magicToken }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.token) {
            localStorage.setItem("btc-today-email", magicEmail);
            localStorage.setItem("btc-today-token", data.token);
            setSession({ email: magicEmail, token: data.token });
            router.replace("/chat");
          } else {
            setVerifyError(data.error || "Invalid or expired link.");
          }
        })
        .catch(() => {
          setVerifyError("Network error. Please try again.");
        })
        .finally(() => {
          setVerifying(false);
          setLoaded(true);
        });
      return;
    }

    // Otherwise check localStorage for existing session
    const savedEmail = localStorage.getItem("btc-today-email");
    const savedToken = localStorage.getItem("btc-today-token");
    if (savedEmail && savedToken) {
      setSession({ email: savedEmail, token: savedToken });
    }
    setLoaded(true);
  }, [searchParams, router]);

  function handleVerified(email: string, token: string) {
    setSession({ email, token });
  }

  if (!loaded || verifying) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        {verifying && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Verifying your access...
          </p>
        )}
      </main>
    );
  }

  return (
    <main>
      {session ? (
        <ChatInterface email={session.email} token={session.token} />
      ) : (
        <SubscriberGate onVerified={handleVerified} verifyError={verifyError} />
      )}
    </main>
  );
}

export default function ChatPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="flex min-h-[60vh] items-center justify-center" />
        }
      >
        <ChatContent />
      </Suspense>
    </>
  );
}
