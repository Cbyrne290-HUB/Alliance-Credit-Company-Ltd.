import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

/**
 * Blocks until the user types the exact phrase, or the process exits.
 * Pass --yes on the command line to skip (for scripted/CI use) — but
 * that's opt-in per invocation, never a default.
 */
export async function confirmOrExit(phrase: string, message: string) {
  if (process.argv.includes("--yes")) {
    console.log(`(--yes passed, skipping confirmation prompt)`);
    return;
  }

  console.log(message);
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`Type "${phrase}" to continue, anything else to abort: `);
  rl.close();

  if (answer.trim() !== phrase) {
    console.log("Aborted — no changes made.");
    process.exit(1);
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
