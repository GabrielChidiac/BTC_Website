import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { TipThanksPoller } from "@/components/tip/TipThanksPoller";

interface ThanksPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

const SESSION_ID_RE = /^cs_(live|test)_[a-zA-Z0-9]+$/;

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export const metadata = {
  title: "Thanks | BTC Today",
  description: "Tip confirmation",
};

export default async function ThanksPage({ searchParams }: ThanksPageProps) {
  const { session_id } = await searchParams;

  return (
    <main className="relative min-h-[calc(100vh-200px)] px-4 pt-16 pb-24">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="inline-block h-1 w-8 rounded-full"
              style={{ backgroundColor: "var(--color-accent)" }}
              aria-hidden="true"
            />
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Confirmation
            </span>
          </div>
        </header>

        <ThanksContent sessionId={session_id} />

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
            style={{ color: "var(--color-accent)" }}
          >
            Back to today&apos;s brief
          </Link>
        </div>
      </div>
    </main>
  );
}

async function ThanksContent({ sessionId }: { sessionId: string | undefined }) {
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <h2
          className="mb-2 font-[family-name:var(--font-heading)] text-2xl font-medium tracking-[-0.04em]"
          style={{ color: "var(--color-text-primary)" }}
        >
          Session not found.
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          If you completed a payment, your card statement will show BTC TODAY TIP. Email{" "}
          <a
            href="mailto:hello@btctoday.co"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--color-accent)" }}
          >
            hello@btctoday.co
          </a>{" "}
          if anything looks off.
        </p>
      </div>
    );
  }

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("stripe_tips")
    .select("paid, amount_cents")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (!row) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <h2
          className="mb-2 font-[family-name:var(--font-heading)] text-2xl font-medium tracking-[-0.04em]"
          style={{ color: "var(--color-text-primary)" }}
        >
          Looks like that session expired.
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          If you completed a payment, your card statement will show BTC TODAY TIP. Email{" "}
          <a
            href="mailto:hello@btctoday.co"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--color-accent)" }}
          >
            hello@btctoday.co
          </a>{" "}
          if anything looks off.
        </p>
      </div>
    );
  }

  if (row.paid) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          borderColor: "var(--color-border)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 30px -16px rgba(0,0,0,0.12)",
        }}
      >
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--color-bullish)",
            boxShadow: "0 0 0 8px rgba(20,184,166,0.12)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path
              d="M7 14.5L12 19.5L21 9.5"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2
          className="mb-2 font-[family-name:var(--font-heading)] text-3xl font-medium tabular-nums tracking-[-0.04em]"
          style={{ color: "var(--color-text-primary)" }}
        >
          Received {formatUsd(row.amount_cents)}.
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Thank you. The brief continues.
        </p>
      </div>
    );
  }

  return <TipThanksPoller sessionId={sessionId} />;
}
