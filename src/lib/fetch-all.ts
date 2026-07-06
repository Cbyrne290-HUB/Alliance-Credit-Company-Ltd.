/**
 * PostgREST caps a single request at 1000 rows by default. Any query that
 * can return more than that (e.g. "every loan for this agent" once an
 * agent's book grows past 1000 rows) silently truncates — no error, just
 * missing rows past the cap — unless it's paged through with .range().
 *
 * Use this instead of a bare .select() wherever the row count isn't
 * comfortably bounded well under 1000.
 *
 * Pass `{ count: "exact" }` as the second argument to the query's
 * `.select(columns, { count: "exact" })` — the first page's response then
 * tells us the total row count, so every remaining page can be requested
 * concurrently instead of one round-trip at a time (sequential paging of a
 * large table is dominated by cumulative round-trip latency, not the
 * actual data transfer). Without a count, this still works correctly, just
 * falls back to the original sequential loop.
 */
const PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
};

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const first = await fetchPage(0, PAGE_SIZE - 1);
  if (first.error) throw new Error(first.error.message);

  const firstPage = first.data ?? [];
  if (firstPage.length < PAGE_SIZE) return firstPage;

  const total = first.count;
  if (total == null) {
    console.warn(
      'fetchAllRows: no exact count returned (pass { count: "exact" } in .select()) — falling back to sequential paging.',
    );
    return fetchRemainingSequentially(fetchPage, firstPage);
  }

  const remainingStarts: number[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) {
    remainingStarts.push(from);
  }

  const remainingPages = await Promise.all(
    remainingStarts.map(async (from) => {
      const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  );

  return firstPage.concat(...remainingPages);
}

async function fetchRemainingSequentially<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  firstPage: T[],
): Promise<T[]> {
  const rows = firstPage.slice();
  let from = PAGE_SIZE;

  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
