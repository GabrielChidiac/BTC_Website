import { Container } from "./Container";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--color-border)] py-10">
      <Container className="flex flex-col items-center gap-4 text-center">
        <p className="text-xs text-[var(--color-text-muted)]">
          Data refreshed every day at 2 AM CET.
        </p>
      </Container>
    </footer>
  );
}
