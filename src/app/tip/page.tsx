import { TipForm } from "@/components/tip/TipForm";
import type { TipMethod } from "@/components/tip/MethodSelector";

interface TipPageProps {
  searchParams: Promise<{
    date?: string;
    source?: string;
    amount?: string;
    method?: string;
  }>;
}

const VALID_SOURCES = ["site", "newsletter", "archive", "footer"] as const;
const VALID_METHODS = ["lightning", "card", "onchain"] as const;
type TipSource = (typeof VALID_SOURCES)[number];

function isValidDate(d: string | undefined): d is string {
  return Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d));
}

function parseSource(s: string | undefined): TipSource {
  if (s && (VALID_SOURCES as readonly string[]).includes(s)) {
    return s as TipSource;
  }
  return "site";
}

function parseAmount(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 21 || n > 1_000_000) return undefined;
  return n;
}

function parseMethod(s: string | undefined): TipMethod {
  if (s && (VALID_METHODS as readonly string[]).includes(s)) {
    return s as TipMethod;
  }
  return "lightning";
}

export const metadata = {
  title: "Tip | BTC Today",
  description:
    "Send a tip to BTC Today via Lightning, card, or on-chain BTC. Tips fund the pipeline.",
};

export default async function TipPage({ searchParams }: TipPageProps) {
  const params = await searchParams;
  const briefingDate = isValidDate(params.date) ? params.date : undefined;
  const source = parseSource(params.source);
  const initialAmount = parseAmount(params.amount);
  const initialMethod = parseMethod(params.method);

  return (
    <main className="relative min-h-[calc(100vh-200px)] px-4 pt-16 pb-24">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute left-1/2 top-[-40%] h-[700px] w-[700px] -translate-x-1/2 rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, var(--color-accent-glow), transparent 70%)",
          }}
        />
      </div>

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
              Reader-funded
            </span>
          </div>

          <h1
            className="mb-3 font-[family-name:var(--font-heading)] text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-5xl"
            style={{ color: "var(--color-text-primary)" }}
          >
            Power the brief.
          </h1>

          <p
            className="max-w-md text-[15px] leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Tips fund the pipeline. AI calls, market data feeds, hosting.
            {briefingDate
              ? ` This one funds the ${briefingDate} briefing specifically.`
              : ""}
          </p>
        </header>

        <TipForm
          briefingDate={briefingDate}
          source={source}
          initialAmount={initialAmount}
          initialMethod={initialMethod}
        />
      </div>
    </main>
  );
}
