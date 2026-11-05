/**
 * The real progress behind every loader: how many data requests have started and finished. Bars and
 * rings read this, so what they show comes from work actually happening. Requests share a key, because
 * two sections asking for the same data are one piece of work to the person waiting.
 */
const started = new Set<string>();
const finished = new Set<string>();
const inFlight = new Map<string, number>();
const listeners = new Set<() => void>();
let area: string | null = null;

const notify = () => listeners.forEach((listener) => listener());

export function trackTask(key: string): () => void {
  started.add(key);
  finished.delete(key);
  inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
  notify();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const left = (inFlight.get(key) ?? 1) - 1;
    if (left > 0) {
      inFlight.set(key, left);
    } else {
      inFlight.delete(key);
      finished.add(key);
    }
    notify();
  };
}

export const taskCounts = () => ({ total: started.size, done: finished.size, pending: inFlight.size });

export function onTasksChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The person's area, for messages. Known once their profile has loaded. */
export const setLoadingArea = (name: string | null | undefined) => {
  area = name ?? null;
};
export const loadingArea = () => area;

/**
 * Resolves when nothing is loading. It waits a moment first, so requests the page is about to make count,
 * and gives up at the cap, because a stuck request must never trap someone behind a loader.
 */
export function whenTasksSettle({ graceMs = 150, capMs = 8000 } = {}): Promise<void> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      const age = Date.now() - startedAt;
      if (age >= capMs || (age >= graceMs && inFlight.size === 0)) {
        clearInterval(timer);
        resolve();
      }
    };
    const timer = setInterval(check, 40);
  });
}
