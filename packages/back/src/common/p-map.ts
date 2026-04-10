/**
 * Run `fn` over `items` with bounded concurrency. Returns one settled
 * result per item, in the same order as the input. Never throws — failures
 * surface as `{ status: 'rejected', reason }` entries.
 *
 * Tiny p-limit-style helper to avoid pulling in a dependency for the
 * handful of places we need to bound external API fan-out (kDrive deletes,
 * etc.).
 */
export async function pMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  if (items.length === 0) return results;
  let next = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i], i) };
      } catch (e) {
        results[i] = { status: 'rejected', reason: e };
      }
    }
  });
  await Promise.all(workers);
  return results;
}
