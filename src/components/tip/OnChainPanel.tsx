"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface OnChainPanelProps {
  address: string;
}

export function OnChainPanel({ address }: OnChainPanelProps) {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  if (!address) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <p
          className="font-mono text-[11px] uppercase tracking-[0.16em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          On-chain tipping not configured
        </p>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Try Lightning or Card instead.
        </p>
      </div>
    );
  }

  const bip21 = `bitcoin:${address}?label=BTC%20Today%20tip`;
  const truncated = `${address.slice(0, 10)}...${address.slice(-8)}`;

  async function copy(value: string, which: "address" | "uri") {
    try {
      await navigator.clipboard.writeText(value);
      if (which === "address") {
        setCopiedAddress(true);
        window.setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        setCopiedUri(true);
        window.setTimeout(() => setCopiedUri(false), 2000);
      }
    } catch {
      // clipboard denied; non-fatal
    }
  }

  return (
    <div
      className="rounded-2xl border p-6 sm:p-8"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        borderColor: "var(--color-border)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 30px -16px rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="mb-6 flex items-baseline justify-between border-b pb-3"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          On-chain BTC
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          Mainnet
        </span>
      </div>

      <div className="mb-5 flex justify-center">
        <div className="relative">
          <div
            className="absolute inset-0 -z-10 rounded-2xl blur-2xl"
            style={{
              backgroundColor: "var(--color-accent-glow)",
              transform: "scale(0.92)",
            }}
            aria-hidden="true"
          />
          <div
            className="relative rounded-2xl border bg-white p-4"
            style={{
              borderColor: "var(--color-border)",
              boxShadow: "0 12px 40px -16px rgba(247,147,26,0.25)",
            }}
          >
            <QRCodeSVG
              value={bip21}
              size={232}
              level="M"
              marginSize={0}
              fgColor="#0A0A0C"
              bgColor="#FFFFFF"
            />
          </div>
        </div>
      </div>

      <div className="mb-3">
        <p
          className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          Address
        </p>
        <code
          className="block break-all rounded-lg border px-3 py-2 font-mono text-[11px] leading-relaxed"
          style={{
            backgroundColor: "var(--color-bg-base)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-primary)",
          }}
          title={address}
        >
          {address}
        </code>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => copy(address, "address")}
          className="flex h-10 items-center justify-center rounded-lg border font-mono text-[11px] uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
          style={{
            backgroundColor: copiedAddress
              ? "rgba(20,184,166,0.1)"
              : "var(--color-bg-base)",
            borderColor: copiedAddress
              ? "var(--color-bullish)"
              : "var(--color-border)",
            color: copiedAddress
              ? "var(--color-bullish)"
              : "var(--color-text-primary)",
            transition:
              "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
          }}
        >
          {copiedAddress ? "Copied" : "Copy address"}
        </button>
        <a
          href={bip21}
          className="flex h-10 items-center justify-center rounded-lg font-mono text-[11px] uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "#FFFFFF",
          }}
        >
          Open in wallet
        </a>
      </div>

      <button
        type="button"
        onClick={() => copy(bip21, "uri")}
        className="mb-5 w-full text-center font-mono text-[10px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
        style={{
          color: copiedUri ? "var(--color-bullish)" : "var(--color-text-muted)",
        }}
      >
        {copiedUri ? "URI copied" : `Copy BIP21 URI (${truncated})`}
      </button>

      <div
        className="border-t pt-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          We don&apos;t track on-chain tips. The tipper knows it landed; we don&apos;t know who. Send a note to{" "}
          <a
            href="mailto:hello@btctoday.co"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--color-text-secondary)" }}
          >
            hello@btctoday.co
          </a>{" "}
          if you&apos;d like attribution.
        </p>
        <p
          className="mt-2 text-xs leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          Mainnet only. Do not send testnet or fork-coin BTC.
        </p>
      </div>
    </div>
  );
}
