"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  TIP_PRESETS_SATS,
  TIP_MIN_SATS,
  TIP_MAX_SATS,
  TIP_MESSAGE_MAX_LEN,
  BTC_TIP_ADDRESS,
} from "@/lib/constants";
import { MethodSelector, type TipMethod } from "./MethodSelector";
import { CardPanel } from "./CardPanel";
import { OnChainPanel } from "./OnChainPanel";

interface TipFormProps {
  briefingDate?: string;
  source: "site" | "newsletter" | "archive" | "footer";
  initialAmount?: number;
  initialMethod?: TipMethod;
}

interface InvoiceData {
  payment_hash: string;
  bolt11: string;
  amount_sats: number;
  expires_at: string;
}

type ScreenState = "form" | "invoice" | "success" | "expired";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

function formatSats(sats: number): string {
  return new Intl.NumberFormat("en-US").format(sats);
}

function formatTimeLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TipForm({ briefingDate, source, initialAmount, initialMethod = "lightning" }: TipFormProps) {
  const [method, setMethod] = useState<TipMethod>(initialMethod);
  const [state, setState] = useState<ScreenState>("form");
  const [amountSats, setAmountSats] = useState<number>(initialAmount ?? 21_000);
  const [customAmount, setCustomAmount] = useState(
    initialAmount && !TIP_PRESETS_SATS.includes(initialAmount as never)
      ? String(initialAmount)
      : ""
  );
  const [usingCustom, setUsingCustom] = useState(
    Boolean(initialAmount && !TIP_PRESETS_SATS.includes(initialAmount as never))
  );
  const [tipperName, setTipperName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paidHash, setPaidHash] = useState<string>("");
  const [timeLeftMs, setTimeLeftMs] = useState(POLL_TIMEOUT_MS);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  function effectiveAmount(): number {
    if (!usingCustom) return amountSats;
    const n = parseInt(customAmount, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function clearTimers() {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  useEffect(() => () => clearTimers(), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amt = effectiveAmount();
    if (amt < TIP_MIN_SATS) {
      setError(`Minimum tip is ${TIP_MIN_SATS} sats`);
      return;
    }
    if (amt > TIP_MAX_SATS) {
      setError(`Maximum tip is ${formatSats(TIP_MAX_SATS)} sats`);
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        amount_sats: amt,
        source,
      };
      if (tipperName.trim()) body.tipper_name = tipperName.trim();
      if (message.trim()) body.message = message.trim();
      if (briefingDate) body.briefing_date = briefingDate;

      const res = await fetch("/api/tips/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Could not generate invoice");
        return;
      }

      setInvoice({
        payment_hash: data.payment_hash,
        bolt11: data.bolt11,
        amount_sats: data.amount_sats,
        expires_at: data.expires_at,
      });
      setState("invoice");
      startedAtRef.current = Date.now();
      setTimeLeftMs(POLL_TIMEOUT_MS);
      startPolling(data.payment_hash, data.amount_sats);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function startPolling(hash: string, amt: number) {
    clearTimers();

    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/tips/${hash}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.paid) {
          clearTimers();
          setPaidAmount(data.amount_sats ?? amt);
          setPaidHash(hash);
          setState("success");
        }
      } catch {
        // network blip; keep polling
      }
    }, POLL_INTERVAL_MS);

    tickRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const left = POLL_TIMEOUT_MS - elapsed;
      setTimeLeftMs(left);
      if (left <= 0) {
        clearTimers();
        setState("expired");
      }
    }, 1000);
  }

  function reset() {
    clearTimers();
    setInvoice(null);
    setTipperName("");
    setMessage("");
    setError(null);
    setCopied(false);
    setPaidHash("");
    setState("form");
  }

  async function copyBolt11() {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice.bolt11);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard denied; non-fatal
    }
  }

  return (
    <div className="relative">
      <MethodSelector
        method={method}
        onChange={setMethod}
        disabled={method === "lightning" && state === "invoice"}
      />

      {method === "card" && <CardPanel briefingDate={briefingDate} source={source} />}
      {method === "onchain" && <OnChainPanel address={BTC_TIP_ADDRESS} />}

      {method === "lightning" && (
      <AnimatePresence mode="wait" initial={false}>
        {state === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <FormView
              amountSats={amountSats}
              setAmountSats={(n) => {
                setAmountSats(n);
                setUsingCustom(false);
                setCustomAmount("");
              }}
              customAmount={customAmount}
              setCustomAmount={(v) => {
                setCustomAmount(v);
                setUsingCustom(v.length > 0);
              }}
              usingCustom={usingCustom}
              tipperName={tipperName}
              setTipperName={setTipperName}
              message={message}
              setMessage={setMessage}
              loading={loading}
              error={error}
              onSubmit={handleSubmit}
            />
          </motion.div>
        )}

        {state === "invoice" && invoice && (
          <motion.div
            key="invoice"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <InvoiceView
              invoice={invoice}
              copied={copied}
              onCopy={copyBolt11}
              onCancel={reset}
              timeLeftMs={timeLeftMs}
            />
          </motion.div>
        )}

        {state === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <SuccessView
              amountSats={paidAmount}
              paymentHash={paidHash}
              onReset={reset}
            />
          </motion.div>
        )}

        {state === "expired" && (
          <motion.div
            key="expired"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ExpiredView onReset={reset} />
          </motion.div>
        )}
      </AnimatePresence>
      )}
    </div>
  );
}

interface FormViewProps {
  amountSats: number;
  setAmountSats: (n: number) => void;
  customAmount: string;
  setCustomAmount: (v: string) => void;
  usingCustom: boolean;
  tipperName: string;
  setTipperName: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
}

function FormView({
  amountSats,
  setAmountSats,
  customAmount,
  setCustomAmount,
  usingCustom,
  tipperName,
  setTipperName,
  message,
  setMessage,
  loading,
  error,
  onSubmit,
}: FormViewProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border p-6 sm:p-8"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        borderColor: "var(--color-border)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 30px -16px rgba(0,0,0,0.12)",
      }}
    >
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <label
            htmlFor="tip-name"
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Name (optional)
          </label>
          <span
            className="font-mono text-[10px] tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            {tipperName.length}/80
          </span>
        </div>
        <input
          id="tip-name"
          type="text"
          maxLength={80}
          value={tipperName}
          onChange={(e) => setTipperName(e.target.value)}
          placeholder="Anonymous"
          className="h-10 w-full rounded-lg border px-3 text-sm outline-none placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent)]/50"
          style={{
            backgroundColor: "var(--color-bg-base)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-primary)",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
        />
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          Amount
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          sats
        </span>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {TIP_PRESETS_SATS.map((preset) => {
          const selected = !usingCustom && amountSats === preset;
          const isFlagship = preset === 21_000;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setAmountSats(preset)}
              className="relative flex h-12 items-center justify-center rounded-lg border font-[family-name:var(--font-heading)] text-sm font-medium tabular-nums tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
              style={{
                backgroundColor: selected
                  ? "var(--color-accent)"
                  : "var(--color-bg-base)",
                color: selected ? "#FFFFFF" : "var(--color-text-primary)",
                borderColor: selected
                  ? "var(--color-accent)"
                  : "var(--color-border)",
                transition:
                  "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
              }}
            >
              {formatSats(preset)}
              {isFlagship && !selected && (
                <span
                  className="absolute -top-1.5 right-1 font-mono text-[8px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--color-accent)" }}
                  aria-hidden="true"
                >
                  21M
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-6">
        <div
          className="flex h-10 items-center rounded-lg border px-3"
          style={{
            backgroundColor: "var(--color-bg-base)",
            borderColor: usingCustom
              ? "var(--color-accent)"
              : "var(--color-border)",
            transition: "border-color 150ms ease",
          }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Custom
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={customAmount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 7);
              setCustomAmount(v);
            }}
            className="ml-3 flex-1 bg-transparent text-right font-[family-name:var(--font-heading)] text-sm font-medium tabular-nums tracking-tight outline-none placeholder:text-[var(--color-text-muted)]"
            style={{ color: "var(--color-text-primary)" }}
            aria-label="Custom amount in sats"
          />
          <span
            className="ml-2 font-mono text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            sats
          </span>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <label
            htmlFor="tip-message"
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Note (optional)
          </label>
          <span
            className="font-mono text-[10px] tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            {message.length}/{TIP_MESSAGE_MAX_LEN}
          </span>
        </div>
        <textarea
          id="tip-message"
          rows={2}
          maxLength={TIP_MESSAGE_MAX_LEN}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A line, if you'd like."
          className="w-full resize-none rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent)]/50"
          style={{
            backgroundColor: "var(--color-bg-base)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-primary)",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
        />
      </div>

      <motion.button
        type="submit"
        disabled={loading}
        whileTap={{ scale: 0.98 }}
        className="flex h-12 w-full items-center justify-center rounded-lg font-[family-name:var(--font-heading)] text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 disabled:opacity-60"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "#FFFFFF",
          boxShadow: "0 8px 20px -10px var(--color-accent-glow-strong)",
          transition: "background-color 150ms ease",
        }}
      >
        {loading ? (
          <span className="font-mono text-xs uppercase tracking-[0.18em]">
            Generating
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <BoltGlyph />
            <span>Generate invoice</span>
          </span>
        )}
      </motion.button>

      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--color-bearish)" }}>
          {error}
        </p>
      )}

      <div
        className="mt-6 border-t pt-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          Don&apos;t have a Lightning wallet? Try{" "}
          <a
            href="https://cash.app/"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Cash App
          </a>
          ,{" "}
          <a
            href="https://phoenix.acinq.co/"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Phoenix
          </a>
          , or{" "}
          <a
            href="https://www.walletofsatoshi.com/"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Wallet of Satoshi
          </a>
          .
        </p>
      </div>
    </form>
  );
}

interface InvoiceViewProps {
  invoice: InvoiceData;
  copied: boolean;
  onCopy: () => void;
  onCancel: () => void;
  timeLeftMs: number;
}

function InvoiceView({
  invoice,
  copied,
  onCopy,
  onCancel,
  timeLeftMs,
}: InvoiceViewProps) {
  const lightningUri = `lightning:${invoice.bolt11}`;
  const truncated =
    invoice.bolt11.slice(0, 14) + "..." + invoice.bolt11.slice(-10);

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
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Invoice
          </span>
          <span
            className="font-[family-name:var(--font-heading)] text-xl font-medium tabular-nums tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {formatSats(invoice.amount_sats)}
          </span>
          <span
            className="font-mono text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            sats
          </span>
        </div>
        <span
          className="font-mono text-[10px] tabular-nums"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="Time remaining"
        >
          {formatTimeLeft(timeLeftMs)}
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
              value={invoice.bolt11.toUpperCase()}
              size={232}
              level="M"
              marginSize={0}
              fgColor="#0A0A0C"
              bgColor="#FFFFFF"
            />
            <div
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--color-accent)",
                boxShadow: "0 4px 12px var(--color-accent-glow-strong)",
              }}
              aria-hidden="true"
            >
              <BoltGlyph fill="#FFFFFF" />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="flex h-10 items-center justify-center rounded-lg border font-mono text-[11px] uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
          style={{
            backgroundColor: copied
              ? "rgba(20,184,166,0.1)"
              : "var(--color-bg-base)",
            borderColor: copied
              ? "var(--color-bullish)"
              : "var(--color-border)",
            color: copied
              ? "var(--color-bullish)"
              : "var(--color-text-primary)",
            transition:
              "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
          }}
        >
          {copied ? "Copied" : "Copy invoice"}
        </button>
        <a
          href={lightningUri}
          className="flex h-10 items-center justify-center rounded-lg font-mono text-[11px] uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "#FFFFFF",
          }}
        >
          Open in wallet
        </a>
      </div>

      <div
        className="mb-4 flex flex-col items-center gap-3 border-y py-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <TickerIndicator />
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Status
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-accent)" }}
          >
            Awaiting payment
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <code
          className="truncate font-mono text-[10px]"
          style={{ color: "var(--color-text-muted)" }}
          title={invoice.bolt11}
        >
          {truncated}
        </code>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-[10px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          style={{ color: "var(--color-text-muted)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SuccessView({
  amountSats,
  paymentHash,
  onReset,
}: {
  amountSats: number;
  paymentHash: string;
  onReset: () => void;
}) {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");

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
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 200 }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          backgroundColor: "var(--color-bullish)",
          boxShadow: "0 0 0 8px rgba(20,184,166,0.12)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <motion.path
            d="M7 14.5L12 19.5L21 9.5"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
          />
        </svg>
      </motion.div>

      <h2
        className="mb-2 font-[family-name:var(--font-heading)] text-3xl font-medium tabular-nums tracking-[-0.04em]"
        style={{ color: "var(--color-text-primary)" }}
      >
        Received {formatSats(amountSats)} sats.
      </h2>
      <p
        className="mb-6 text-sm leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Thank you. The brief continues.
      </p>

      <div
        className="mb-3 flex items-center justify-between rounded-lg border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums"
        style={{
          backgroundColor: "var(--color-bg-base)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-muted)",
        }}
      >
        <span>{hh}:{mm}:{ss}</span>
        <span style={{ color: "var(--color-bullish)" }}>Settled</span>
        <span>{formatSats(amountSats)} sats</span>
      </div>

      {paymentHash && (
        <div className="mb-6 text-left">
          <p
            className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Payment hash
          </p>
          <code
            className="block break-all rounded-lg border px-3 py-2 font-mono text-[10px] leading-relaxed"
            style={{
              backgroundColor: "var(--color-bg-base)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            {paymentHash}
          </code>
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
        style={{ color: "var(--color-accent)" }}
      >
        Send another
      </button>
    </div>
  );
}

function ExpiredView({ onReset }: { onReset: () => void }) {
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
        Invoice expired.
      </h2>
      <p
        className="mb-6 text-sm leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Lightning invoices have a 10 minute window. Generate a fresh one when you&apos;re ready.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="h-10 rounded-lg px-5 font-[family-name:var(--font-heading)] text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "#FFFFFF",
        }}
      >
        Try again
      </button>
    </div>
  );
}

function TickerIndicator() {
  const blocks = [0, 1, 2, 3, 4];
  return (
    <div className="flex items-center gap-1.5" aria-label="Polling for payment" role="status">
      {blocks.map((i) => (
        <motion.span
          key={i}
          className="block h-2 w-6 rounded-[2px]"
          initial={{ opacity: 0.18 }}
          animate={{ opacity: [0.18, 1, 0.18] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
          style={{ backgroundColor: "var(--color-accent)" }}
        />
      ))}
    </div>
  );
}

function BoltGlyph({ fill = "currentColor" }: { fill?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M8 1L2.5 7.5H6.5L5 13L11 6H7.5L9 1H8Z" fill={fill} />
    </svg>
  );
}
