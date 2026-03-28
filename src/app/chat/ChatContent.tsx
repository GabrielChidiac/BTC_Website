"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SubscriberGate } from "@/components/chat/SubscriberGate";
import { ChatInterface } from "@/components/chat/ChatInterface";

function ChatInner({
  initialSession,
}: {
  initialSession: { email: string } | null;
}) {
  const [session, setSession] = useState<{ email: string; legacyToken?: string } | null>(initialSession);
  const [loaded, setLoaded] = useState(!!initialSession);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // If we already have a session (from cookie or prior effect run), skip
    if (initialSession || session) return;

    const magicToken = searchParams.get("token");
    const magicEmail = searchParams.get("email");

    // If magic link params present, verify them
    if (magicToken && magicEmail) {
      setVerifying(true);
      fetch("/api/chat/verify-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail, token: magicToken }),
        credentials: "same-origin",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.token) {
            localStorage.setItem("btc-today-email", magicEmail);
            localStorage.setItem("btc-today-token", data.token);
            setSession({ email: magicEmail });
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

    // Fallback: check localStorage (for users who haven't migrated to cookie yet)
    const savedEmail = localStorage.getItem("btc-today-email");
    const savedToken = localStorage.getItem("btc-today-token");
    if (savedEmail && savedToken) {
      // Pass token so ChatInterface can send it in body for cookie auto-migration
      setSession({ email: savedEmail, legacyToken: savedToken });
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, initialSession]);

  function handleSessionExpired() {
    setSession(null);
    setVerifyError("Your session has expired. Please verify your email again.");
    // Clear stale localStorage
    localStorage.removeItem("btc-today-email");
    localStorage.removeItem("btc-today-token");
  }

  // Keep onVerified reference for SubscriberGate (used via magic link redirect)
  function handleVerified(email: string) {
    setSession({ email });
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
        <ChatInterface email={session.email} legacyToken={session.legacyToken} onSessionExpired={handleSessionExpired} />
      ) : (
        <SubscriberGate onVerified={handleVerified} verifyError={verifyError} />
      )}
    </main>
  );
}

export function ChatContent({
  initialSession,
}: {
  initialSession: { email: string } | null;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center" />
      }
    >
      <ChatInner initialSession={initialSession} />
    </Suspense>
  );
}
