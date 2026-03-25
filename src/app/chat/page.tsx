"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { SubscriberGate } from "@/components/chat/SubscriberGate";
import { ChatInterface } from "@/components/chat/ChatInterface";

export default function ChatPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("btc-today-email");
    if (saved) setEmail(saved);
    setLoaded(true);
  }, []);

  // Don't render until we've checked localStorage
  if (!loaded) {
    return (
      <>
        <Header />
        <main />
      </>
    );
  }

  return (
    <>
      <Header />
      <main>
        {email ? (
          <ChatInterface email={email} />
        ) : (
          <SubscriberGate onVerified={setEmail} />
        )}
      </main>
    </>
  );
}
