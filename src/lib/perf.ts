/// <reference types="vite/client" />

const isDev = import.meta.env.DEV;

export function perfStart(label: string): number {
  const t = performance.now();
  if (isDev) console.log(`[perf] ▶ ${label}`);
  return t;
}

export function perfEnd(label: string, start: number): void {
  if (!isDev) return;
  const ms = (performance.now() - start).toFixed(1);
  const icon = Number(ms) > 500 ? "🔴" : Number(ms) > 200 ? "🟡" : "🟢";
  console.log(`[perf] ${icon} ${label} → ${ms}ms`);
}
