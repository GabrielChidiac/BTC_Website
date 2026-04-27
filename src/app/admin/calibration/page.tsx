import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  BriefingJSON,
  DayClassificationLabel,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ASSERTED_PRIOR: Record<DayClassificationLabel, number> = {
  mostly_noise: 0.7,
  mixed: 0.15,
  risk_change: 0.1,
  thesis_shift: 0.05,
};

const LABEL_ORDER: DayClassificationLabel[] = [
  "mostly_noise",
  "mixed",
  "risk_change",
  "thesis_shift",
];

type DayRow = {
  date: string;
  label: DayClassificationLabel | "unclassified";
  depth_weight: string;
  confidence: number | null;
  crosses: {
    etf_z: boolean;
    funding_pct: boolean;
    fg_30d: boolean;
    price_vs_30d: boolean;
    move_24h: boolean;
    vol_jump: boolean;
  };
  cross_count: number;
};

function checkCrosses(b: BriefingJSON): DayRow["crosses"] {
  const c = b.comparative ?? null;
  const m = b.market_snapshot ?? null;

  const etfZ = c?.etf_flows_30d_z_score;
  const fundingPct = c?.funding_rate_30d_percentile;
  const fgChange = c?.fear_greed_30d_change;
  const priceVs30d = c?.price_vs_30d_avg_pct;
  const move24h = m?.change_24h_pct;
  const rv30 = c?.realized_vol_30d_pct;
  const rv90 = c?.realized_vol_90d_pct;

  return {
    etf_z: etfZ != null && Math.abs(etfZ) >= 1.0,
    funding_pct:
      fundingPct != null && (fundingPct >= 90 || fundingPct <= 10),
    fg_30d: fgChange != null && Math.abs(fgChange) >= 15,
    price_vs_30d: priceVs30d != null && Math.abs(priceVs30d) >= 5,
    move_24h: move24h != null && Math.abs(move24h) >= 3,
    vol_jump: rv30 != null && rv90 != null && rv90 > 0 && rv30 / rv90 >= 1.5,
  };
}

function pct(n: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null) return "—";
  return n.toFixed(digits);
}

async function fetchRows(): Promise<DayRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("daily_briefings")
    .select("date, content")
    .order("date", { ascending: false })
    .limit(90);

  if (error || !data) return [];

  return data.map((row): DayRow => {
    const b = row.content as BriefingJSON;
    const dc = b.day_classification ?? null;
    const crosses = checkCrosses(b);
    const cross_count = Object.values(crosses).filter(Boolean).length;

    return {
      date: row.date,
      label: dc?.label ?? "unclassified",
      depth_weight: dc?.depth_weight ?? "—",
      confidence: dc?.confidence ?? null,
      crosses,
      cross_count,
    };
  });
}

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || params.key !== adminKey) {
    notFound();
  }

  const rows = await fetchRows();
  const total = rows.length;
  const classified = rows.filter((r) => r.label !== "unclassified");

  const counts: Record<string, number> = {
    mostly_noise: 0,
    mixed: 0,
    risk_change: 0,
    thesis_shift: 0,
    unclassified: 0,
  };
  for (const r of rows) counts[r.label] = (counts[r.label] ?? 0) + 1;

  const crossTotals = {
    etf_z: 0,
    funding_pct: 0,
    fg_30d: 0,
    price_vs_30d: 0,
    move_24h: 0,
    vol_jump: 0,
  };
  for (const r of rows) {
    if (r.crosses.etf_z) crossTotals.etf_z++;
    if (r.crosses.funding_pct) crossTotals.funding_pct++;
    if (r.crosses.fg_30d) crossTotals.fg_30d++;
    if (r.crosses.price_vs_30d) crossTotals.price_vs_30d++;
    if (r.crosses.move_24h) crossTotals.move_24h++;
    if (r.crosses.vol_jump) crossTotals.vol_jump++;
  }

  const earnedAny = rows.filter((r) => r.cross_count > 0).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 font-mono text-sm text-neutral-900">
      <header className="mb-8 border-b border-neutral-300 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Day Classifier Calibration
        </h1>
        <p className="mt-1 text-neutral-600">
          Last {total} briefings. Distribution drift vs. asserted prior, and
          threshold cross-rates per metric.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold uppercase tracking-wider text-neutral-700">
          Label distribution
        </h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-300 text-neutral-500">
              <th className="py-2">Label</th>
              <th className="py-2">Count</th>
              <th className="py-2">Actual</th>
              <th className="py-2">Asserted prior</th>
              <th className="py-2">Drift</th>
            </tr>
          </thead>
          <tbody>
            {LABEL_ORDER.map((label) => {
              const count = counts[label] ?? 0;
              const actual = classified.length > 0 ? count / classified.length : 0;
              const prior = ASSERTED_PRIOR[label];
              const drift = actual - prior;
              const driftColor =
                Math.abs(drift) >= 0.1
                  ? "text-red-600"
                  : Math.abs(drift) >= 0.05
                  ? "text-amber-600"
                  : "text-neutral-500";
              return (
                <tr key={label} className="border-b border-neutral-200">
                  <td className="py-2">{label}</td>
                  <td className="py-2">{count}</td>
                  <td className="py-2">{(actual * 100).toFixed(1)}%</td>
                  <td className="py-2 text-neutral-500">
                    {(prior * 100).toFixed(0)}%
                  </td>
                  <td className={`py-2 ${driftColor}`}>
                    {drift >= 0 ? "+" : ""}
                    {(drift * 100).toFixed(1)} pts
                  </td>
                </tr>
              );
            })}
            {counts.unclassified > 0 && (
              <tr className="border-b border-neutral-200 text-neutral-500">
                <td className="py-2">unclassified</td>
                <td className="py-2">{counts.unclassified}</td>
                <td className="py-2" colSpan={3}>
                  pre-classifier briefings (excluded from drift calc)
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-neutral-500">
          Drift {">"} 10 pts = prior likely miscalibrated. Drift {">"} 5 pts =
          worth watching. Sample size: {classified.length} classified days.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold uppercase tracking-wider text-neutral-700">
          Threshold cross-rates
        </h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-300 text-neutral-500">
              <th className="py-2">Threshold</th>
              <th className="py-2">Days crossed</th>
              <th className="py-2">Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200">
              <td className="py-2">|ETF flow z-score| ≥ 1.0</td>
              <td className="py-2">{crossTotals.etf_z}</td>
              <td className="py-2">{pct(crossTotals.etf_z, total)}</td>
            </tr>
            <tr className="border-b border-neutral-200">
              <td className="py-2">Funding 30d percentile ≥ 90 or ≤ 10</td>
              <td className="py-2">{crossTotals.funding_pct}</td>
              <td className="py-2">{pct(crossTotals.funding_pct, total)}</td>
            </tr>
            <tr className="border-b border-neutral-200">
              <td className="py-2">|F&amp;G 30d change| ≥ 15</td>
              <td className="py-2">{crossTotals.fg_30d}</td>
              <td className="py-2">{pct(crossTotals.fg_30d, total)}</td>
            </tr>
            <tr className="border-b border-neutral-200">
              <td className="py-2">|Price vs 30d avg| ≥ 5%</td>
              <td className="py-2">{crossTotals.price_vs_30d}</td>
              <td className="py-2">{pct(crossTotals.price_vs_30d, total)}</td>
            </tr>
            <tr className="border-b border-neutral-200">
              <td className="py-2">|24h change| ≥ 3%</td>
              <td className="py-2">{crossTotals.move_24h}</td>
              <td className="py-2">{pct(crossTotals.move_24h, total)}</td>
            </tr>
            <tr className="border-b border-neutral-200">
              <td className="py-2">Realized vol 30d ≥ 1.5× 90d</td>
              <td className="py-2">{crossTotals.vol_jump}</td>
              <td className="py-2">{pct(crossTotals.vol_jump, total)}</td>
            </tr>
            <tr className="border-b border-neutral-200 font-semibold">
              <td className="py-2">Any threshold crossed (earned-significance)</td>
              <td className="py-2">{earnedAny}</td>
              <td className="py-2">{pct(earnedAny, total)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-neutral-500">
          If "any threshold crossed" rate ≪ (mixed + risk_change + thesis_shift)
          rate, Claude is labeling material days that the gates would not back.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold uppercase tracking-wider text-neutral-700">
          Per-day detail
        </h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-300 text-neutral-500">
              <th className="py-2">Date</th>
              <th className="py-2">Label</th>
              <th className="py-2">Depth</th>
              <th className="py-2">Conf</th>
              <th className="py-2">ETF z</th>
              <th className="py-2">Fund %</th>
              <th className="py-2">F&amp;G Δ</th>
              <th className="py-2">Px/30d</th>
              <th className="py-2">24h</th>
              <th className="py-2">Vol×</th>
              <th className="py-2">#</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const labelColor =
                r.label === "thesis_shift"
                  ? "text-purple-700 font-semibold"
                  : r.label === "risk_change"
                  ? "text-red-600 font-semibold"
                  : r.label === "mixed"
                  ? "text-amber-700"
                  : r.label === "mostly_noise"
                  ? "text-neutral-500"
                  : "text-neutral-400 italic";
              const cell = (hit: boolean) =>
                hit ? "bg-amber-100 text-amber-900 font-semibold" : "text-neutral-400";
              return (
                <tr key={r.date} className="border-b border-neutral-200">
                  <td className="py-1.5">{r.date}</td>
                  <td className={`py-1.5 ${labelColor}`}>{r.label}</td>
                  <td className="py-1.5 text-neutral-600">{r.depth_weight}</td>
                  <td className="py-1.5 text-neutral-600">
                    {r.confidence != null ? r.confidence.toFixed(2) : "—"}
                  </td>
                  <td className={`px-1 py-1.5 ${cell(r.crosses.etf_z)}`}>
                    {r.crosses.etf_z ? "✓" : "·"}
                  </td>
                  <td className={`px-1 py-1.5 ${cell(r.crosses.funding_pct)}`}>
                    {r.crosses.funding_pct ? "✓" : "·"}
                  </td>
                  <td className={`px-1 py-1.5 ${cell(r.crosses.fg_30d)}`}>
                    {r.crosses.fg_30d ? "✓" : "·"}
                  </td>
                  <td className={`px-1 py-1.5 ${cell(r.crosses.price_vs_30d)}`}>
                    {r.crosses.price_vs_30d ? "✓" : "·"}
                  </td>
                  <td className={`px-1 py-1.5 ${cell(r.crosses.move_24h)}`}>
                    {r.crosses.move_24h ? "✓" : "·"}
                  </td>
                  <td className={`px-1 py-1.5 ${cell(r.crosses.vol_jump)}`}>
                    {r.crosses.vol_jump ? "✓" : "·"}
                  </td>
                  <td className="py-1.5 text-neutral-700">{r.cross_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <footer className="mt-10 border-t border-neutral-300 pt-4 text-xs text-neutral-500">
        Read me first: the asserted prior (70/15/10/5) is what the day-classifier
        prompt tells Claude. The "Actual" column is what the classifier produced.
        Threshold cross-rates are independent: they show how often the data
        actually moved enough to warrant a non-noise label, regardless of what
        Claude chose. Compare the two to spot calibration drift.
      </footer>
    </main>
  );
}
