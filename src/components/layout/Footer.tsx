import { Container } from "./Container";
import { BitcoinCoin } from "@/components/hero/BitcoinCoin";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--color-border)] py-10">
      <Container className="flex flex-col items-center gap-4 text-center">
        <p className="text-xs text-[var(--color-accent)]/70">
          Data refreshed every day at 2 AM CET.
        </p>
        <BitcoinCoin className="size-8 opacity-60 drop-shadow-[0_2px_8px_rgba(247,147,26,0.25)]" />
      </Container>
    </footer>
  );
}
