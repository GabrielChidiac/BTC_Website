import { Container } from "./Container";
import { BitcoinCoin } from "@/components/hero/BitcoinCoin";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--color-border)] py-10">
      <Container className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-4">
          <BitcoinCoin className="relative z-10 size-10 drop-shadow-[0_2px_8px_rgba(247,147,26,0.35)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Data refreshed every day at 2 AM CET.
          </p>
          <BitcoinCoin className="relative z-10 size-10 drop-shadow-[0_2px_8px_rgba(247,147,26,0.35)]" />
        </div>
      </Container>
    </footer>
  );
}
