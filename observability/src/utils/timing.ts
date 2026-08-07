/** Monotonic timing helpers. `Date.now()` is never used for durations. */

export function startTimer(): () => number {
  const started = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - started) / 1_000_000;
}

export async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const stop = startTimer();
  const value = await fn();
  return { ms: stop(), value };
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
