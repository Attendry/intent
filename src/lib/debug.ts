/**
 * Debug logging — only outputs in development.
 * Use for verbose processing logs (doc parsing, enrichment, etc.).
 */
const isDev = process.env.NODE_ENV === "development";

export function debugLog(...args: unknown[]): void {
  if (isDev) {
    console.log(...args);
  }
}
