/**
 * Wraps native fetch with an AbortController timeout.
 * Prevents pipeline tasks from hanging indefinitely on slow/dead APIs.
 */
export function fetchWithTimeout(
  input: string | URL | Request,
  init?: RequestInit,
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/**
 * Race a promise against a timeout. Useful for library calls (rss-parser, yahoo-finance)
 * that don't accept an AbortSignal.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}
