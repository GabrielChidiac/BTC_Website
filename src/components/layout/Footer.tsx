import { Container } from "./Container";
import { SubscribeForm } from "../subscribe/SubscribeForm";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--color-border)] py-10">
      <Container className="flex flex-col items-center gap-6 text-center">
        <SubscribeForm />

        <p className="text-xs text-[var(--color-text-muted)]">
          AI-curated daily Bitcoin intelligence.
          <br />
          Data refreshed every day at 6 AM CET.
        </p>
      </Container>
    </footer>
  );
}
