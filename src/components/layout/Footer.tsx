import { Container } from "./Container";
import { BitcoinCoin } from "@/components/hero/BitcoinCoin";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--color-border)] py-10">
      <Container className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-4">
          <BitcoinCoin className="size-7 opacity-50 drop-shadow-[0_2px_8px_rgba(247,147,26,0.25)]" />
          <p className="text-xs text-[var(--color-text-muted)]">
            Data refreshed every day at 2 AM CET.
          </p>
          <BitcoinCoin className="size-7 opacity-50 drop-shadow-[0_2px_8px_rgba(247,147,26,0.25)]" />
        </div>
      </Container>
    </footer>
  );
}
