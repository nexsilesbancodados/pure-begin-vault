// Lightweight stale-while-revalidate cache backed by sessionStorage.
// Use for dashboard payloads to provide instant paint on reloads/navigations.

type Entry<T> = { v: T; t: number };

const PREFIX = "lvc:"; // lovable cache

export function readCache<T>(key: string, maxAgeMs = 5 * 60_000): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.v;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(
      PREFIX + key,
      JSON.stringify({ v: value, t: Date.now() } satisfies Entry<T>),
    );
  } catch {
    // ignore quota / serialization errors
  }
}

export function invalidateCache(prefix?: string) {
  try {
    if (!prefix) {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => sessionStorage.removeItem(k));
      return;
    }
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX + prefix))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}
